import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  cleanupNotifications,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission, requireRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(injectTenant);

// User routes
router.get('/', requirePermission('notifications:read'), listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

// Admin only routes
router.post('/', requireRole(UserRole.TENANT_ADMIN), createNotification);
router.post('/cleanup', requireRole(UserRole.TENANT_ADMIN), cleanupNotifications);

export default router;
