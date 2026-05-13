import { tenantDb } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { UserRole } from '@prisma/client';

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

  /**
   * Get managers for a tenant to send email notifications
   */
  private async getManagersForEmail(tenantId: string): Promise<Array<{ email: string; firstName: string }>> {
    const managers = await (tenantDb as any).user.findMany({
      where: {
        tenantId,
        role: { in: [UserRole.TENANT_ADMIN, UserRole.REGIONAL_MANAGER, UserRole.STORE_MANAGER] },
        isActive: true,
      },
      select: { email: true, firstName: true },
    });
    return managers;
  }

  // ==================== BUSINESS EVENT NOTIFICATIONS ====================

  /**
   * 1. LOW STOCK ALERT - Email + In-app notification
   */
  async notifyLowStock(
    tenantId: string,
    productId: string,
    productName: string,
    locationName: string,
    currentStock: number,
    minStockLevel: number,
    recommendedQuantity: number
  ): Promise<Notification> {
    const message = `Low stock alert: ${productName} at ${locationName} is below minimum level (${currentStock}/${minStockLevel})`;
    
    // Create in-app notification
    const notification = await this.create(tenantId, {
      type: 'LOW_STOCK',
      message,
      metadata: { productId, currentStock, minStockLevel, locationName, recommendedQuantity },
    });

    // Send email to managers
    try {
      const managers = await this.getManagersForEmail(tenantId);
      for (const manager of managers) {
        emailService.sendBusinessEvent({
          to: manager.email,
          firstName: manager.firstName || 'Manager',
          eventType: 'warning',
          title: '⚠️ Low Stock Alert',
          message: `${productName} at ${locationName} is running low on stock. Please review and consider placing a new order.`,
          details: {
            'Product': productName,
            'Location': locationName,
            'Current Stock': currentStock,
            'Minimum Level': minStockLevel,
            'Recommended Order': recommendedQuantity,
            'Status': 'ACTION REQUIRED',
          },
        }).catch(err => {
          logger.error({ err, email: manager.email }, 'Failed to send low stock email');
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to notify managers about low stock');
    }

    return notification;
  }

  /**
   * 2. TRANSFER APPROVAL REQUIRED - Email + In-app notification
   */
  async notifyTransferApprovalRequired(
    tenantId: string,
    transferId: string,
    fromLocation: string,
    toLocation: string,
    totalValue: number,
    itemCount: number,
    createdBy: string
  ): Promise<Notification> {
    const message = `Transfer from ${fromLocation} to ${toLocation} ($${totalValue.toFixed(2)}) requires your approval`;

    // Create in-app notification
    const notification = await this.create(tenantId, {
      type: 'TRANSFER_APPROVAL_REQUIRED',
      message,
      metadata: { transferId, fromLocation, toLocation, totalValue, itemCount },
    });

    // Send email to managers
    try {
      const managers = await this.getManagersForEmail(tenantId);
      for (const manager of managers) {
        emailService.sendBusinessEvent({
          to: manager.email,
          firstName: manager.firstName || 'Manager',
          eventType: 'warning',
          title: '🔔 Transfer Approval Required',
          message: `A new transfer order has been created and requires your approval before it can be processed.`,
          details: {
            'Transfer ID': transferId,
            'From Location': fromLocation,
            'To Location': toLocation,
            'Total Value': `$${totalValue.toFixed(2)}`,
            'Number of Items': itemCount,
            'Created By': createdBy,
            'Status': 'PENDING APPROVAL',
          },
        }).catch(err => {
          logger.error({ err, email: manager.email }, 'Failed to send transfer approval email');
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to notify managers about transfer approval');
    }

    return notification;
  }

  /**
   * 3. DEAD STOCK DISCOUNT APPLIED - Email + In-app notification
   */
  async notifyDeadStockDiscount(
    tenantId: string,
    productId: string,
    productName: string,
    daysInInventory: number,
    oldPrice: number,
    newPrice: number,
    discountPercent: number
  ): Promise<Notification> {
    const message = `Dead stock discount applied: ${productName} price reduced by ${discountPercent}% ($${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)})`;

    // Create in-app notification
    const notification = await this.create(tenantId, {
      type: 'DEAD_STOCK_DISCOUNT',
      message,
      metadata: { productId, daysInInventory, oldPrice, newPrice, discountPercent },
    });

    // Send email to managers
    try {
      const managers = await this.getManagersForEmail(tenantId);
      for (const manager of managers) {
        emailService.sendBusinessEvent({
          to: manager.email,
          firstName: manager.firstName || 'Manager',
          eventType: 'success',
          title: '💰 Dead Stock Discount Applied',
          message: `An automatic discount has been applied to ${productName} to help move dead stock inventory.`,
          details: {
            'Product': productName,
            'Days in Inventory': daysInInventory,
            'Old Price': `$${oldPrice.toFixed(2)}`,
            'New Price': `$${newPrice.toFixed(2)}`,
            'Discount': `${discountPercent}%`,
            'Status': 'AUTO-APPLIED',
          },
        }).catch(err => {
          logger.error({ err, email: manager.email }, 'Failed to send dead stock discount email');
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to notify managers about dead stock discount');
    }

    return notification;
  }

  // ==================== ADDITIONAL NOTIFICATIONS ====================

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
