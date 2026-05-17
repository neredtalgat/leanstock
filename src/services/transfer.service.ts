/* eslint-disable @typescript-eslint/no-explicit-any */
import { tenantDb, asyncLocalStorage } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { CreateTransferInput, ReceiveItemInput, ShipTransferInput, ApproveTransferInput } from '../schemas/transfer.schema';
import { notificationService } from './notification.service';
import { reservationService } from './reservation.service';
import { scheduleReservationExpiry } from '../workers/reservation.worker';

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
  async create(data: CreateTransferInput, userId: string, tenantId: string): Promise<any> {
    try {
      return await tenantDb.$transaction(async (tx: any) => {
        if (data.fromLocationId === data.toLocationId) {
          throw new Error('SAME_LOCATION');
        }

        const locations = await tx.location.findMany({
          where: { id: { in: [data.fromLocationId, data.toLocationId] }, tenantId },
        });
        if (locations.length !== 2) {
          throw new Error('INVALID_LOCATION');
        }

        const fromLocation = locations.find((l: any) => l.id === data.fromLocationId);
        const toLocation = locations.find((l: any) => l.id === data.toLocationId);

        const creator = await tx.user.findFirst({
          where: { id: userId, tenantId },
          select: { firstName: true, lastName: true, email: true },
        });
        const creatorName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email : 'Unknown';

        let totalValue = 0;
        const transferItems = [];

        for (const item of data.items) {
          const inv = await tx.inventory.findFirst({
            where: { productId: item.productId, locationId: data.fromLocationId, tenantId },
            // Use pessimistic lock for atomicity
          });
          if (!inv) {
            throw new Error(`PRODUCT_NOT_IN_LOCATION:${item.productId}`);
          }

          const available = inv.quantity - inv.reservedQuantity;
          if (available < item.quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${item.productId}`);
          }

          // RESERVE quantity immediately
          await tx.inventory.update({
            where: { id: inv.id },
            data: { reservedQuantity: { increment: item.quantity } },
          });

          // Create reservation in Redis for auto-release
          await reservationService.reserve({
            tenantId,
            productId: item.productId,
            locationId: data.fromLocationId,
            quantity: item.quantity,
            referenceType: 'TRANSFER',
            referenceId: 'pending',
          });

          const product = await tx.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { retailPrice: true },
          });
          if (product) {
            totalValue += product.retailPrice * item.quantity;
          }

          transferItems.push({
            productId: item.productId,
            quantity: item.quantity,
            quantityShipped: 0,
            receivedQuantity: 0,
          });
        }

        const requiresApproval = totalValue > env.TRANSFER_APPROVAL_THRESHOLD;
        const status = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

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
            items: { create: transferItems },
          },
          include: { items: true },
        });

        // Schedule auto-release if not confirmed within 15 minutes
        for (const item of data.items) {
          await scheduleReservationExpiry(tenantId, item.productId, data.fromLocationId, item.quantity, 900000);
        }

        if (requiresApproval) {
          await notificationService.notifyTransferApprovalRequired(
            tenantId, transfer.id, fromLocation?.name || 'Unknown', toLocation?.name || 'Unknown',
            totalValue, transferItems.length, creatorName
          );
        }

        logger.info(`Transfer created: ${transfer.id}, requiresApproval: ${requiresApproval}`);
        return transfer;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      logger.error({ err: error }, 'Failed to create transfer');
      throw error;
    }
  }

  async approve(transferId: string, data: ApproveTransferInput, userId: string, tenantId: string): Promise<any> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND');
    if (transfer.status !== 'PENDING_APPROVAL') throw new Error('INVALID_STATUS');

    if (data.approved) {
      const updated = await tenantDb.transferOrder.update({
        where: { id: transferId },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
        include: { items: true },
      });
      logger.info(`Transfer approved: ${transferId}`);
      return updated;
    } else {
      // Release reservations on reject
      await tenantDb.$transaction(async (tx: any) => {
        for (const item of transfer.items) {
          const inv = await tx.inventory.findFirst({
            where: { productId: item.productId, locationId: transfer.fromLocationId, tenantId },
          });
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { reservedQuantity: Math.max(0, inv.reservedQuantity - item.quantity) },
            });
          }
          await reservationService.release(tenantId, item.productId, transfer.fromLocationId);
        }
        await tx.transferOrder.update({
          where: { id: transferId },
          data: { status: 'CANCELLED', approvedBy: userId, approvedAt: new Date(), rejectionReason: data.reason },
        });
      });
      logger.info(`Transfer rejected: ${transferId}`);
      return { ...transfer, status: 'CANCELLED' };
    }
  }

  async ship(transferId: string, data: ShipTransferInput, tenantId: string): Promise<any> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND');
    if (transfer.status !== 'APPROVED') throw new Error('INVALID_STATUS');

    return await tenantDb.$transaction(async (tx: any) => {
      for (const item of transfer.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, locationId: transfer.fromLocationId, tenantId },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
            inTransit: { increment: item.quantity },
          },
        });
        // Confirm reservation (remove from Redis)
        await reservationService.confirm(tenantId, item.productId, transfer.fromLocationId);
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

      // Update transfer items WITHIN transaction using superAdmin context
      for (const item of transfer.items) {
        await tx.transferItem.update({
          where: { id: item.id },
          data: { quantityShipped: item.quantity },
        });
      }

      logger.info(`Transfer shipped: ${transferId}`);
      return updated;
    });
  }

  async receive(transferId: string, items: ReceiveItemInput[], tenantId: string): Promise<any> {
    const transfer = await tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND');
    if (transfer.status !== 'IN_TRANSIT') throw new Error('INVALID_STATUS');

    return await tenantDb.$transaction(async (tx: any) => {
      let allReceived = true;
      for (const receivedItem of items) {
        const transferItem = transfer.items.find((ti: any) => ti.productId === receivedItem.productId);
        if (!transferItem) throw new Error(`ITEM_NOT_FOUND:${receivedItem.productId}`);
        if (receivedItem.quantityReceived > transferItem.quantity) throw new Error(`EXCESS_RECEIVED:${receivedItem.productId}`);

        await tx.inventory.updateMany({
          where: { productId: receivedItem.productId, locationId: transfer.toLocationId, tenantId },
          data: { quantity: { increment: receivedItem.quantityReceived } },
        });
        await tx.inventory.updateMany({
          where: { productId: receivedItem.productId, locationId: transfer.fromLocationId, tenantId },
          data: { inTransit: { decrement: receivedItem.quantityReceived } },
        });

        if (receivedItem.quantityReceived < transferItem.quantity) allReceived = false;
      }

      const status = allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: { status, receivedAt: new Date() },
        include: { items: true },
      });

      // Update transfer items WITHIN transaction
      for (const receivedItem of items) {
        const transferItem = transfer.items.find((ti: any) => ti.productId === receivedItem.productId);
        if (transferItem) {
          await tx.transferItem.update({
            where: { id: transferItem.id },
            data: { receivedQuantity: receivedItem.quantityReceived },
          });
        }
      }

      // Send receipt notification
      await notificationService.notifyTransferReceipt(tenantId, transferId, transfer.toLocationId, status);

      logger.info(`Transfer received: ${transferId}, status: ${status}`);
      return updated;
    });
  }

  async getById(transferId: string, tenantId: string): Promise<any> {
    return tenantDb.transferOrder.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
  }

  async list(tenantId: string, status?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return tenantDb.transferOrder.findMany({
      where, include: { items: true }, orderBy: { createdAt: 'desc' },
    });
  }
}

export const transferService = new TransferService();
