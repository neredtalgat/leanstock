import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateNotificationInput {
  type: string;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  type: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: Date;
  userId?: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  types: Record<string, boolean>;
}

class NotificationService {
  async list(tenantId: string, userId?: string, unreadOnly?: boolean): Promise<Notification[]> {
    const where: any = { tenantId };
    
    if (userId) {
      where.OR = [
        { userId },
        { userId: null }, // Broadcast notifications
      ];
    }
    
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await (tenantDb as any).notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return notifications;
  }

  async getById(tenantId: string, notificationId: string): Promise<Notification | null> {
    const notification = await (tenantDb as any).notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    return notification;
  }

  async create(
    tenantId: string,
    input: CreateNotificationInput
  ): Promise<Notification> {
    const notification = await (tenantDb as any).notification.create({
      data: {
        tenantId,
        type: input.type,
        message: input.message,
        metadata: input.metadata || {},
        userId: input.userId,
        isRead: false,
      },
    });

    logger.info(`Notification created: ${notification.id} for tenant ${tenantId}`);

    return notification;
  }

  async markAsRead(tenantId: string, notificationId: string, userId: string): Promise<Notification> {
    const notification = await (tenantDb as any).notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    // Check if notification is for this user or is a broadcast
    if (notification.userId && notification.userId !== userId) {
      throw new Error('NOTIFICATION_NOT_FOR_USER');
    }

    const updated = await (tenantDb as any).notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    logger.info(`Notification marked as read: ${notificationId}`);

    return updated;
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const result = await (tenantDb as any).notification.updateMany({
      where: {
        tenantId,
        OR: [
          { userId },
          { userId: null },
        ],
        isRead: false,
      },
      data: { isRead: true },
    });

    logger.info(`Marked ${result.count} notifications as read for user ${userId}`);

    return result.count;
  }

  async delete(tenantId: string, notificationId: string, userId: string): Promise<void> {
    const notification = await (tenantDb as any).notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    // Check if notification is for this user or is a broadcast
    if (notification.userId && notification.userId !== userId) {
      throw new Error('NOTIFICATION_NOT_FOR_USER');
    }

    await (tenantDb as any).notification.delete({
      where: { id: notificationId },
    });

    logger.info(`Notification deleted: ${notificationId}`);
  }

  async getUnreadCount(tenantId: string, userId?: string): Promise<number> {
    const where: any = { tenantId, isRead: false };
    
    if (userId) {
      where.OR = [
        { userId },
        { userId: null },
      ];
    }

    const count = await (tenantDb as any).notification.count({ where });
    return count;
  }

  async createBulk(
    tenantId: string,
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<Notification[]> {
    const notifications = await Promise.all(
      userIds.map(userId =>
        this.create(tenantId, { ...input, userId })
      )
    );

    logger.info(`Created ${notifications.length} bulk notifications for tenant ${tenantId}`);
    return notifications;
  }

  // Notification templates for common events
  async notifyLowStock(
    tenantId: string,
    productId: string,
    productName: string,
    currentStock: number,
    minStockLevel: number,
    userIds?: string[]
  ): Promise<Notification> {
    const message = `Low stock alert: ${productName} is below minimum level (${currentStock}/${minStockLevel})`;
    
    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'LOW_STOCK',
        message,
        metadata: { productId, currentStock, minStockLevel },
      });
    }

    return this.create(tenantId, {
      type: 'LOW_STOCK',
      message,
      metadata: { productId, currentStock, minStockLevel },
    });
  }

  async notifyTransferCreated(
    tenantId: string,
    transferId: string,
    fromLocation: string,
    toLocation: string,
    totalValue: number,
    requiresApproval: boolean,
    userIds?: string[]
  ): Promise<Notification> {
    const message = requiresApproval
      ? `New transfer from ${fromLocation} to ${toLocation} requires approval ($${totalValue.toFixed(2)})`
      : `New transfer created from ${fromLocation} to ${toLocation}`;

    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'TRANSFER_CREATED',
        message,
        metadata: { transferId, fromLocation, toLocation, totalValue, requiresApproval },
      });
    }

    return this.create(tenantId, {
      type: 'TRANSFER_CREATED',
      message,
      metadata: { transferId, fromLocation, toLocation, totalValue, requiresApproval },
    });
  }

  async notifyTransferApproved(
    tenantId: string,
    transferId: string,
    approvedBy: string,
    userIds?: string[]
  ): Promise<Notification> {
    const message = `Transfer ${transferId} has been approved by ${approvedBy}`;

    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'TRANSFER_APPROVED',
        message,
        metadata: { transferId, approvedBy },
      });
    }

    return this.create(tenantId, {
      type: 'TRANSFER_APPROVED',
      message,
      metadata: { transferId, approvedBy },
    });
  }

  async notifyPurchaseOrderStatus(
    tenantId: string,
    orderId: string,
    supplierName: string,
    status: string,
    userIds?: string[]
  ): Promise<Notification> {
    const message = `Purchase order from ${supplierName} is now ${status}`;

    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'PURCHASE_ORDER_STATUS',
        message,
        metadata: { orderId, supplierName, status },
      });
    }

    return this.create(tenantId, {
      type: 'PURCHASE_ORDER_STATUS',
      message,
      metadata: { orderId, supplierName, status },
    });
  }

  async notifyDeadStock(
    tenantId: string,
    productId: string,
    productName: string,
    daysInInventory: number,
    userIds?: string[]
  ): Promise<Notification> {
    const message = `Dead stock alert: ${productName} has not moved in ${daysInInventory} days`;

    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'DEAD_STOCK',
        message,
        metadata: { productId, daysInInventory },
      });
    }

    return this.create(tenantId, {
      type: 'DEAD_STOCK',
      message,
      metadata: { productId, daysInInventory },
    });
  }

  async notifyReorderPoint(
    tenantId: string,
    productId: string,
    productName: string,
    currentQuantity: number,
    reorderPoint: number,
    userIds?: string[]
  ): Promise<Notification> {
    const message = `Reorder point reached: ${productName} (${currentQuantity}/${reorderPoint})`;

    if (userIds && userIds.length > 0) {
      await this.createBulk(tenantId, userIds, {
        type: 'REORDER_POINT',
        message,
        metadata: { productId, currentQuantity, reorderPoint },
      });
    }

    return this.create(tenantId, {
      type: 'REORDER_POINT',
      message,
      metadata: { productId, currentQuantity, reorderPoint },
    });
  }

  async cleanupOldNotifications(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await (tenantDb as any).notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}

export const notificationService = new NotificationService();
