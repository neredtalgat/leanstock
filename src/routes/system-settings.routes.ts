import { Router } from 'express';
import {
  getGlobalLimits,
  updateGlobalLimits,
  getTenantLimits,
  getSystemStatus,
  getMailQueueStatus,
  getFailedMailJobs,
  retryMailJob,
  cleanMailJobs,
  testSmtp,
} from '../controllers/system-settings.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.SUPER_ADMIN));

router.get('/limits', getGlobalLimits);
router.put('/limits', updateGlobalLimits);
router.get('/limits/tenants/:tenantId', getTenantLimits);
router.get('/status', getSystemStatus);

// Mail queue management routes
router.get('/mail-queue/status', getMailQueueStatus);
router.get('/mail-queue/failed', getFailedMailJobs);
router.post('/mail-queue/retry/:jobId', retryMailJob);
router.post('/mail-queue/clean', cleanMailJobs);

// SMTP test route - доступен любому авторизованному пользователю для тестирования
router.post('/test-smtp', authenticate, testSmtp);

export default router;
