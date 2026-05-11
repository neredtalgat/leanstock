import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';

const router = Router();

/**
 * GET /audit-logs
 * List audit logs (requires audit:read permission)
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  requirePermission('audit:read'),
  auditController.listAuditLogs,
);

export default router;
