import { tenantDb } from '../config/database';
import { logger } from '../config/logger';
import { CreateTransferInput, ReceiveItemInput, ShipTransferInput, ApproveTransferInput } from '../schemas/transfer.schema';

export interface TransferOrder {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: string;
  totalValue: number;
  requiresApproval: boolean;
  items: Array<{
    productId: string;
    quantity: number;
    quantityShipped: number;
    receivedQuantity: number;
  }>;
}

class TransferService {
  /**
   * Create transfer with atomic inventory check using SELECT FOR UPDATE
   */
  async create(data: CreateTransferInput, userId: string, tenantId: string): Promise<TransferOrder> {
    try {
      return await tenantDb.$transaction(
        async (tx: any) => {
          // 1. Validate source != destination
          if (data.fromLocationId === data.toLocationId) {
            throw new Error('SAME_LOCATION');
          }

          // 2. Validate locations belong to tenant
          const locations = await tx.location.findMany({
            where: {
              id: { in: [data.fromLocationId, data.toLocationId] },
              tenantId,
            },
          });

          if (locations.length !== 2) {
            throw new Error('INVALID_LOCATION');
          }

          // 3. For each item: check availability with SELECT FOR UPDATE
          let totalValue = 0;
          const transferItems = [];

          for (const item of data.items) {
            // SELECT FOR UPDATE to lock inventory row - prevents concurrent modifications
            const inventory = await tx.$queryRaw`
              SELECT * FROM inventory 
              WHERE "productId" = ${item.productId} 
                AND "locationId" = ${data.fromLocationId}
                AND "tenantId" = ${tenantId}
              FOR UPDATE
            `;

            if (!inventory || (inventory as any[]).length === 0) {
              throw new Error(`PRODUCT_NOT_IN_LOCATION:${item.productId}`);
            }

            const inv = (inventory as any[])[0];
            const available = inv.quantity - inv.reservedQuantity;
            if (available < item.quantity) {
              throw new Error(`INSUFFICIENT_STOCK:${item.productId}`);
            }

            // Get product for value calculation
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { retailPrice: true },
            });

            if (product) {
              totalValue += product.retailPrice * item.quantity;
            }

            transferItems.push({
              productId: item.productId,
              quantity: item.quantity,
              quantityShipped: 0,
              quantityReceived: 0,
            });
          }

          // 4. Determine if approval required (value > 1000)
          const requiresApproval = totalValue > 1000;
          const status = requiresApproval ? 'PENDING_APPROVAL' : 'DRAFT';

          // 5. Create TransferOrder
          const transfer = await tx.transferOrder.create({
            data: {
              tenantId,
              fromLocationId: data.fromLocationId,
              toLocationId: data.toLocationId,
              status,
              totalValue,
              requiresApproval,
              notes: data.notes,
              createdBy: userId,
              items: {
                create: transferItems,
              },
            },
            include: {
              items: true,
            },
          });

          logger.info(`Transfer created: ${transfer.id} in tenant ${tenantId}`);
          return transfer as TransferOrder;
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to create transfer');
      throw error;
    }
  }

  /**
   * Approve or reject transfer
   */
  async approve(
    transferId: string,
    data: ApproveTransferInput,
    userId: string,
    tenantId: string,
  ): Promise<TransferOrder> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });

    if (!transfer) {
      throw new Error('TRANSFER_NOT_FOUND');
    }

    if (transfer.status !== 'PENDING_APPROVAL') {
      throw new Error('INVALID_STATUS');
    }

    if (data.approved) {
      // Approve: change status to APPROVED
      const updated = await tenantDb.transferOrder.update({
        where: { id: transferId },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: { items: true },
      });
      logger.info(`Transfer approved: ${transferId}`);
      return updated as TransferOrder;
    } else {
      // Reject: cancel and return stock
      await tenantDb.$transaction(async (tx: any) => {
        await tx.transferOrder.update({
          where: { id: transferId },
          data: {
            status: 'CANCELLED',
            approvedBy: userId,
            approvedAt: new Date(),
            rejectionReason: data.reason,
          },
        });
        // Stock was not reserved yet, no rollback needed
      });
      logger.info(`Transfer rejected: ${transferId}`);
      return { ...transfer, status: 'CANCELLED' } as TransferOrder;
    }
  }

  /**
   * Ship transfer
   */
  async ship(transferId: string, data: ShipTransferInput, tenantId: string): Promise<TransferOrder> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });

    if (!transfer) {
      throw new Error('TRANSFER_NOT_FOUND');
    }

    if (transfer.status !== 'APPROVED') {
      throw new Error('INVALID_STATUS');
    }

    return await tenantDb.$transaction(async (tx: any) => {
      // Decrement available, increment inTransit at source
      for (const item of transfer.items) {
        await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            locationId: transfer.fromLocationId,
            tenantId,
          },
          data: {
            quantity: { decrement: item.quantity },
            inTransit: { increment: item.quantity },
          },
        });

        // Update TransferItem
        await tx.transferItem.update({
          where: { id: item.id },
          data: { quantityShipped: item.quantity },
        });
      }

      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: {
          status: 'IN_TRANSIT',
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
          shippedAt: new Date(),
        },
        include: { items: true },
      });

      logger.info(`Transfer shipped: ${transferId}`);
      return updated as TransferOrder;
    });
  }

  /**
   * Receive transfer
   */
  async receive(transferId: string, items: ReceiveItemInput[], tenantId: string): Promise<TransferOrder> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });

    if (!transfer) {
      throw new Error('TRANSFER_NOT_FOUND');
    }

    if (transfer.status !== 'IN_TRANSIT') {
      throw new Error('INVALID_STATUS');
    }

    return await tenantDb.$transaction(async (tx: any) => {
      let allReceived = true;

      for (const receivedItem of items) {
        const transferItem = transfer.items.find((ti: any) => ti.productId === receivedItem.productId);
        if (!transferItem) {
          throw new Error(`ITEM_NOT_FOUND:${receivedItem.productId}`);
        }

        if (receivedItem.quantityReceived > transferItem.quantity) {
          throw new Error(`EXCESS_RECEIVED:${receivedItem.productId}`);
        }

        // Update inventory at destination
        await tx.inventory.updateMany({
          where: {
            productId: receivedItem.productId,
            locationId: transfer.toLocationId,
            tenantId,
          },
          data: {
            quantity: { increment: receivedItem.quantityReceived },
          },
        });

        // Update inventory at source (decrement inTransit)
        await tx.inventory.updateMany({
          where: {
            productId: receivedItem.productId,
            locationId: transfer.fromLocationId,
            tenantId,
          },
          data: {
            inTransit: { decrement: receivedItem.quantityReceived },
          },
        });

        // Update TransferItem
        await tx.transferItem.update({
          where: { id: transferItem.id },
          data: { quantityReceived: receivedItem.quantityReceived },
        });

        if (receivedItem.quantityReceived < transferItem.quantity) {
          allReceived = false;
        }
      }

      const status = allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: {
          status,
          receivedAt: new Date(),
        },
        include: { items: true },
      });

      logger.info(`Transfer received: ${transferId}, status: ${status}`);
      return updated as TransferOrder;
    });
  }

  /**
   * List transfers for tenant
   */
  async list(tenantId: string, status?: string): Promise<TransferOrder[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const transfers = await tenantDb.transferOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return transfers as TransferOrder[];
  }
}

export const transferService = new TransferService();
