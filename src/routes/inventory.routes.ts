import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller';
import * as movementController from '../controllers/inventory-movement.controller';
import { validate, validateQuery, validateParams } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  adjustInventorySchema,
  listInventorySchema,
  inventoryIdParamSchema,
  createInventorySchema,
  updateInventorySchema,
} from '../schemas/inventory.schema';
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
  validateQuery(listInventorySchema),
  inventoryController.listInventory,
);

router.get(
  '/:id',
  authenticate,
  injectTenant,
  validateParams(inventoryIdParamSchema),
  inventoryController.getInventoryById,
);

router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('inventory:create'),
  validate(createInventorySchema),
  inventoryController.createInventory,
);

router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('inventory:update'),
  validateParams(inventoryIdParamSchema),
  validate(updateInventorySchema),
  inventoryController.updateInventory,
);

router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('inventory:delete'),
  validateParams(inventoryIdParamSchema),
  inventoryController.deleteInventory,
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
