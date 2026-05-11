import { Router } from 'express';
import {
  getCrossTenantAnalytics,
  getSystemMetrics,
  getTimeSeriesAnalytics,
  getTenantDetails,
} from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.SUPER_ADMIN));

router.get('/cross-tenant', getCrossTenantAnalytics);
router.get('/system-metrics', getSystemMetrics);
router.get('/time-series', getTimeSeriesAnalytics);
router.get('/tenants/:tenantId', getTenantDetails);

export default router;
