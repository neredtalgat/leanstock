import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant, requirePermission } from '../middleware/rbac';

const router = Router();

// All inventory routes require authentication and tenant injection
router.use(authenticate);
router.use(injectTenant);

/**
 * GET /inventory
 * Get inventory for a product at a location
 */
router.get(
  '/',
  requirePermission('inventory:read'),
  (req, res) => inventoryController.getInventory(req, res)
);

/**
 * POST /inventory/movements
 * Record an inventory movement
 */
router.post(
  '/movements',
  requirePermission('inventory:update'),
  (req, res) => inventoryController.recordMovement(req, res)
);

/**
 * GET /inventory/low-stock
 * Check for low stock items
 */
router.get(
  '/low-stock',
  requirePermission('inventory:read'),
  (req, res) => inventoryController.checkLowStock(req, res)
);

export default router;
