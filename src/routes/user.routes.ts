import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission, requireRole } from '../middleware/rbac';
import { validate, validateParams } from '../middleware/validate';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/user.controller';
import { UserRole } from '@prisma/client';
import { createUserSchema, updateUserSchema, userIdParamSchema } from '../schemas/user.schema';

const router = Router();

router.get('/', authenticate, injectTenant, requireRole(UserRole.TENANT_ADMIN), getUsers);
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('users:create'),
  validate(createUserSchema),
  createUser,
);
router.patch(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('users:update'),
  validateParams(userIdParamSchema),
  validate(updateUserSchema),
  updateUser,
);
router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('users:delete'),
  validateParams(userIdParamSchema),
  deleteUser,
);

export default router;
