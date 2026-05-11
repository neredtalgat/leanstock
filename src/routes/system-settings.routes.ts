import { Router } from 'express';
import {
  getGlobalLimits,
  updateGlobalLimits,
  getTenantLimits,
  getSystemStatus,
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

export default router;
