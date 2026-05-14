import { Response } from 'express';
import { notificationService } from '../services/notification.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.query.userId as string | undefined;
    const unreadOnly = req.query.unread === 'true';
    
    const notifications = await notificationService.list(tenantId, userId, unreadOnly);
    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    logger.error({ err: error }, 'List notifications error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to list notifications',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getUnreadCount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    
    const count = await notificationService.getUnreadCount(tenantId, userId);
    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get unread count error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get unread count',
      timestamp: new Date().toISOString(),
    });
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const notification = await notificationService.markAsRead(tenantId, id, userId);
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Mark notification as read error');
    if (error.message === 'NOTIFICATION_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'NOTIFICATION_NOT_FOR_USER') {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'This notification is not for you',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to mark notification as read',
      timestamp: new Date().toISOString(),
    });
  }
};

export const markAllAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    
    const count = await notificationService.markAllAsRead(tenantId, userId);
    res.status(200).json({
      success: true,
      data: { markedAsRead: count },
    });
  } catch (error) {
    logger.error({ err: error }, 'Mark all notifications as read error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to mark notifications as read',
      timestamp: new Date().toISOString(),
    });
  }
};

export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    
    await notificationService.delete(tenantId, id, userId);
    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Delete notification error');
    if (error.message === 'NOTIFICATION_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Notification not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'NOTIFICATION_NOT_FOR_USER') {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'This notification is not for you',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete notification',
      timestamp: new Date().toISOString(),
    });
  }
};

// Admin only - create notification
export const createNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const notification = await notificationService.create(tenantId, req.body);
    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error({ err: error }, 'Create notification error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create notification',
      timestamp: new Date().toISOString(),
    });
  }
};

// Admin only - cleanup old notifications
export const cleanupNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const count = await notificationService.cleanupOldNotifications(days);
    res.status(200).json({
      success: true,
      data: { deleted: count },
    });
  } catch (error) {
    logger.error({ err: error }, 'Cleanup notifications error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to cleanup notifications',
      timestamp: new Date().toISOString(),
    });
  }
};
