import { Router } from 'express';
import * as locationController from '../controllers/location.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { createLocationSchema } from '../schemas/location.schema';

const router = Router();

/**
 * GET /locations
 * List all locations for tenant
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  locationController.listLocations,
);

/**
 * POST /locations
 * Create a new location (requires locations:create permission)
 */
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('locations:create'),
  validate(createLocationSchema),
  locationController.createLocation,
);

export default router;
