import { Router } from 'express';
import * as controller from '../controllers/reorder-point.controller';
import { validate, validateQuery } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  createReorderPointSchema,
  updateReorderPointSchema,
  listReorderPointsSchema,
} from '../schemas/reorder-point.schema';

const router = Router();

router.get('/', authenticate, injectTenant, validateQuery(listReorderPointsSchema), controller.listReorderPoints);
router.get('/:id', authenticate, injectTenant, controller.getReorderPoint);
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('reorder-points:create'),
  validate(createReorderPointSchema),
  controller.createReorderPoint,
);
router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('reorder-points:update'),
  validate(updateReorderPointSchema),
  controller.updateReorderPoint,
);
router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('reorder-points:delete'),
  controller.deleteReorderPoint,
);

export default router;
