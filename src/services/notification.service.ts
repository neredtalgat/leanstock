import { dbClient } from '../config/database';
import { logger } from '../config/logger';

export class NotificationService {
  async createNotification(data: {
    tenantId: string;
    userId?: string;
    type: string;
    title: string;
    message: string;
  }) {
    const notification = await dbClient.notification.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
      },
    });

    logger.info({
      msg: 'Notification created',
      notificationId: notification.id,
      type: data.type,
    });

    return notification;
  }

  async getUserNotifications(userId: string, tenantId: string) {
    return dbClient.notification.findMany({
      where: {
        userId,
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, tenantId: string) {
    return dbClient.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string, tenantId: string) {
    return dbClient.notification.updateMany({
      where: {
        userId,
        tenantId,
        read: false,
      },
      data: { read: true },
    });
  }

  async getTenantNotifications(tenantId: string) {
    return dbClient.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
