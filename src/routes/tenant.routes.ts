import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { UserRole } from '@prisma/client';
import { createTenant } from '../controllers/tenant.controller';
import { createTenantSchema } from '../schemas/tenant.schema';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  validate(createTenantSchema),
  createTenant,
);

export default router;
