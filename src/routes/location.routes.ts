import { Router } from 'express';
import * as locationController from '../controllers/location.controller';
import { validate, validateParams } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { createLocationSchema, updateLocationSchema, locationIdParamSchema } from '../schemas/location.schema';

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

router.get(
  '/:id',
  authenticate,
  injectTenant,
  validateParams(locationIdParamSchema),
  locationController.getLocation,
);

router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('locations:update'),
  validateParams(locationIdParamSchema),
  validate(updateLocationSchema),
  locationController.updateLocation,
);

router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('locations:delete'),
  validateParams(locationIdParamSchema),
  locationController.deleteLocation,
);

export default router;
