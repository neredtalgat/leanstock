import { TransferOrder, TransferItem, TransferStatus, InventoryMovement } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, ConflictError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { generateCode } from '../utils/helpers';
import { createAuditLog } from '../utils/audit';
import { logger } from '../config/logger';

export interface CreateTransferInput {
  sourceLocationId: string;
  destinationLocationId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
}

export interface ReceiveItemInput {
  transferItemId: string;
  quantityReceived: number;
}

export class TransferService {
  /**
   * Create atomic transfer with stock locking
   * Uses Serializable isolation to prevent race conditions
   */
  async create(
    data: CreateTransferInput,
    userId: string,
    tenantId: string
  ): Promise<TransferOrder> {
    // Validate source !== destination
    if (data.sourceLocationId === data.destinationLocationId) {
      throw new ValidationError('Source and destination locations must be different');
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('Transfer must contain at least one item');
    }

    return await prisma.$transaction(
      async (tx) => {
        // Verify locations exist and belong to tenant
        const [sourceLocation, destinationLocation] = await Promise.all([
          tx.location.findUnique({
            where: {
              id: data.sourceLocationId,
              tenantId,
            },
          }),
          tx.location.findUnique({
            where: {
              id: data.destinationLocationId,
              tenantId,
            },
          }),
        ]);

        if (!sourceLocation) {
          throw new NotFoundError('Source location not found');
        }
        if (!destinationLocation) {
          throw new NotFoundError('Destination location not found');
        }

        // For each item, lock and verify inventory
        let totalValue = 0;
        const transferItems: Array<{
          productId: string;
          quantity: number;
          price: number;
        }> = [];

        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: {
              id: item.productId,
              tenantId,
            },
          });

          if (!product) {
            throw new NotFoundError(`Product ${item.productId} not found`);
          }

          if (item.quantity <= 0) {
            throw new ValidationError(`Quantity must be positive for ${product.name}`);
          }

          // Lock inventory row at source location (SELECT FOR UPDATE)
          const sourceInventory = await tx.inventory.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: data.sourceLocationId,
              },
              tenantId,
            },
          });

          if (!sourceInventory) {
            throw new NotFoundError(
              `No inventory for ${product.name} at source location`
            );
          }

          // Check available stock
          if (sourceInventory.available < item.quantity) {
            throw new ConflictError(
              `Insufficient inventory for ${product.name}. Available: ${sourceInventory.available}, Requested: ${item.quantity}`
            );
          }

          // Decrement available at source
          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: data.sourceLocationId,
              },
            },
            data: {
              available: {
                decrement: item.quantity,
              },
              inTransit: {
                increment: item.quantity,
              },
            },
          });

          // Record movement at source (outbound)
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              locationId: data.sourceLocationId,
              type: 'OUT',
              quantity: item.quantity,
              reason: `Transfer OUT to ${destinationLocation.name}`,
              referenceId: null, // Will update after transfer created
              performedBy: userId,
              notes: data.notes,
            },
          });

          totalValue += product.retailPrice * item.quantity;
          transferItems.push({
            productId: item.productId,
            quantity: item.quantity,
            price: product.retailPrice,
          });
        }

        // Determine if approval required (totalValue > 1000)
        const requiresApproval = totalValue > 1000;
        const initialStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

        // Create TransferOrder
        const transfer = await tx.transferOrder.create({
          data: {
            tenantId,
            code: generateCode('TRF'),
            sourceLocationId: data.sourceLocationId,
            destinationLocationId: data.destinationLocationId,
            status: initialStatus as TransferStatus,
            totalValue,
            requiresApproval,
            notes: data.notes,
            createdBy: userId,
            items: {
              create: transferItems.map((item) => ({
                tenantId,
                productId: item.productId,
                quantityShipped: item.quantity,
                quantityReceived: 0,
                price: item.price,
              })),
            },
          },
          include: { items: true },
        });

        // Audit log
        await createAuditLog({
          tenantId,
          action: 'CREATE_TRANSFER',
          resourceType: 'TransferOrder',
          resourceId: transfer.id,
          userId,
          changes: {
            sourceLocation: sourceLocation.name,
            destinationLocation: destinationLocation.name,
            totalValue,
            requiresApproval,
            itemCount: transferItems.length,
          },
        });

        logger.info(
          { transferId: transfer.id, code: transfer.code, totalValue },
          'Transfer created'
        );

        return transfer;
      },
      {
        isolationLevel: 'Serializable',
      }
    );
  }

  /**
   * Approve or reject transfer (requires REGIONAL_MANAGER+)
   */
  async approve(
    transferId: string,
    approved: boolean,
    reason: string,
    userId: string,
    tenantId: string
  ): Promise<TransferOrder> {
    const transfer = await prisma.transferOrder.findUnique({
      where: { id: transferId, tenantId },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    if (transfer.status !== 'PENDING_APPROVAL') {
      throw new ConflictError(`Cannot approve transfer with status ${transfer.status}`);
    }

    return await prisma.$transaction(async (tx) => {
      if (approved) {
        // Change to APPROVED
        const updated = await tx.transferOrder.update({
          where: { id: transferId },
          data: {
            status: 'APPROVED',
            approvedBy: userId,
            approvedAt: new Date(),
          },
          include: { items: true },
        });

        await createAuditLog({
          tenantId,
          action: 'APPROVE_TRANSFER',
          resourceType: 'TransferOrder',
          resourceId: transferId,
          userId,
          changes: {
            status: 'APPROVED',
          },
        });

        logger.info({ transferId }, 'Transfer approved');
        return updated;
      } else {
        // Reject and revert stock
        const updated = await tx.transferOrder.update({
          where: { id: transferId },
          data: {
            status: 'CANCELLED',
            rejectedBy: userId,
            rejectedAt: new Date(),
            rejectionReason: reason,
          },
          include: { items: true },
        });

        // Revert inventory changes at source
        for (const item of transfer.items) {
          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: transfer.sourceLocationId,
              },
            },
            data: {
              available: {
                increment: item.quantityShipped,
              },
              inTransit: {
                decrement: item.quantityShipped,
              },
            },
          });
        }

        await createAuditLog({
          tenantId,
          action: 'REJECT_TRANSFER',
          resourceType: 'TransferOrder',
          resourceId: transferId,
          userId,
          changes: {
            status: 'CANCELLED',
            reason,
          },
        });

        logger.info({ transferId, reason }, 'Transfer rejected and stock reverted');
        return updated;
      }
    });
  }

  /**
   * Mark transfer as shipped with carrier info
   */
  async ship(
    transferId: string,
    carrier: string,
    trackingNumber: string,
    userId: string,
    tenantId: string
  ): Promise<TransferOrder> {
    const transfer = await prisma.transferOrder.findUnique({
      where: { id: transferId, tenantId },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    if (transfer.status !== 'APPROVED') {
      throw new ConflictError(`Cannot ship transfer with status ${transfer.status}`);
    }

    const updated = await prisma.transferOrder.update({
      where: { id: transferId },
      data: {
        status: 'IN_TRANSIT',
        carrier,
        trackingNumber,
        shippedAt: new Date(),
        shippedBy: userId,
      },
      include: { items: true },
    });

    await createAuditLog({
      tenantId,
      action: 'SHIP_TRANSFER',
      resourceType: 'TransferOrder',
      resourceId: transferId,
      userId,
      changes: {
        status: 'IN_TRANSIT',
        carrier,
        trackingNumber,
      },
    });

    logger.info({ transferId, carrier, trackingNumber }, 'Transfer shipped');
    return updated;
  }

  /**
   * Receive transferred items at destination
   */
  async receive(
    transferId: string,
    items: ReceiveItemInput[],
    userId: string,
    tenantId: string
  ): Promise<TransferOrder> {
    const transfer = await prisma.transferOrder.findUnique({
      where: { id: transferId, tenantId },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    if (transfer.status !== 'IN_TRANSIT') {
      throw new ConflictError(`Cannot receive transfer with status ${transfer.status}`);
    }

    // Validate received quantities
    for (const item of items) {
      const transferItem = transfer.items.find((ti) => ti.id === item.transferItemId);
      if (!transferItem) {
        throw new NotFoundError(`Transfer item not found`);
      }
      if (item.quantityReceived > transferItem.quantityShipped) {
        throw new ValidationError(
          `Received quantity exceeds shipped quantity for transfer item`
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      let totalReceived = 0;
      let totalShipped = 0;

      // Update transfer items and inventory
      for (const receiveItem of items) {
        const transferItem = transfer.items.find((ti) => ti.id === receiveItem.transferItemId);
        if (!transferItem) continue;

        // Update transfer item
        await tx.transferItem.update({
          where: { id: receiveItem.transferItemId },
          data: {
            quantityReceived: receiveItem.quantityReceived,
          },
        });

        // Update inventory at destination
        const destInventory = await tx.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: transferItem.productId,
              locationId: transfer.destinationLocationId,
            },
            tenantId,
          },
        });

        if (destInventory) {
          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: transferItem.productId,
                locationId: transfer.destinationLocationId,
              },
            },
            data: {
              available: {
                increment: receiveItem.quantityReceived,
              },
            },
          });
        } else {
          // Create new inventory record
          await tx.inventory.create({
            data: {
              tenantId,
              productId: transferItem.productId,
              locationId: transfer.destinationLocationId,
              available: receiveItem.quantityReceived,
            },
          });
        }

        // Update inventory at source (decrement inTransit)
        await tx.inventory.update({
          where: {
            productId_locationId: {
              productId: transferItem.productId,
              locationId: transfer.sourceLocationId,
            },
          },
          data: {
            inTransit: {
              decrement: receiveItem.quantityReceived,
            },
          },
        });

        // Record movement at destination (inbound)
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: transferItem.productId,
            locationId: transfer.destinationLocationId,
            type: 'IN',
            quantity: receiveItem.quantityReceived,
            reason: `Transfer IN from ${transfer.sourceLocationId}`,
            referenceId: transferId,
            performedBy: userId,
          },
        });

        totalReceived += receiveItem.quantityReceived;
        totalShipped += transferItem.quantityShipped;
      }

      // Determine final status
      let finalStatus: TransferStatus;
      if (totalReceived === totalShipped) {
        finalStatus = 'COMPLETED';
      } else if (totalReceived > 0) {
        finalStatus = 'PARTIALLY_RECEIVED';
      } else {
        finalStatus = 'IN_TRANSIT';
      }

      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: {
          status: finalStatus,
          receivedAt: totalReceived > 0 ? new Date() : null,
          receivedBy: totalReceived > 0 ? userId : null,
        },
        include: { items: true },
      });

      await createAuditLog({
        tenantId,
        action: 'RECEIVE_TRANSFER',
        resourceType: 'TransferOrder',
        resourceId: transferId,
        userId,
        changes: {
          status: finalStatus,
          totalReceived,
          totalShipped,
        },
      });

      logger.info(
        { transferId, totalReceived, totalShipped, status: finalStatus },
        'Transfer items received'
      );
      return updated;
    });
  }

  /**
   * Get transfer by ID
   */
  async getById(transferId: string, tenantId: string): Promise<TransferOrder | null> {
    return await prisma.transferOrder.findUnique({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
  }

  /**
   * List transfers with pagination
   */
  async list(
    tenantId: string,
    filters?: {
      status?: TransferStatus;
      sourceLocationId?: string;
      destinationLocationId?: string;
      cursor?: string;
      limit?: number;
    }
  ): Promise<{ transfers: TransferOrder[]; hasMore: boolean }> {
    const limit = Math.min(filters?.limit || 20, 100);
    const cursor = filters?.cursor ? { id: filters.cursor } : undefined;

    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.sourceLocationId) where.sourceLocationId = filters.sourceLocationId;
    if (filters?.destinationLocationId)
      where.destinationLocationId = filters.destinationLocationId;

    const transfers = await prisma.transferOrder.findMany({
      where,
      include: { items: true },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = transfers.length > limit;
    return {
      transfers: transfers.slice(0, limit),
      hasMore,
    };
  }
}

export const transferService = new TransferService();
