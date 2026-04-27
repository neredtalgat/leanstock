import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller';
import * as movementController from '../controllers/inventory-movement.controller';
import { validate, validateQuery } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { adjustInventorySchema, listInventorySchema } from '../schemas/inventory.schema';
import { listMovementsSchema } from '../schemas/inventory-movement.schema';

const router = Router();

/**
 * GET /inventory
 * List all inventory with filters
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  validate(listInventorySchema),
  inventoryController.listInventory,
);

/**
 * POST /inventory/adjust
 * Adjust inventory quantity (requires inventory:adjust permission)
 */
router.post(
  '/adjust',
  authenticate,
  injectTenant,
  requirePermission('inventory:adjust'),
  validate(adjustInventorySchema),
  inventoryController.adjustInventory,
);

/**
 * GET /inventory/movements
 * List inventory movements with filters
 */
router.get(
  '/movements',
  authenticate,
  injectTenant,
  validateQuery(listMovementsSchema),
  movementController.listMovements,
);

/**
 * GET /inventory/movements/:id
 * Get single movement by ID
 */
router.get('/movements/:id', authenticate, injectTenant, movementController.getMovement);

export default router;
