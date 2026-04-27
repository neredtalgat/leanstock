import { Router } from 'express';
import * as purchaseOrderController from '../controllers/purchase-order.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
  listPurchaseOrderSchema,
} from '../schemas/purchase-order.schema';

const router = Router();

/**
 * GET /purchase-orders
 * List all purchase orders
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  validate(listPurchaseOrderSchema),
  purchaseOrderController.listPurchaseOrders,
);

/**
 * POST /purchase-orders
 * Create a new purchase order
 */
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('purchase_orders:create'),
  validate(createPurchaseOrderSchema),
  purchaseOrderController.createPurchaseOrder,
);

/**
 * PUT /purchase-orders/:id
 * Update purchase order status
 */
router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('purchase_orders:update'),
  validate(updatePurchaseOrderSchema),
  purchaseOrderController.updatePurchaseOrder,
);

/**
 * POST /purchase-orders/:id/receive
 * Receive items from purchase order
 */
router.post(
  '/:id/receive',
  authenticate,
  injectTenant,
  requirePermission('purchase_orders:receive'),
  validate(receivePurchaseOrderSchema),
  purchaseOrderController.receivePurchaseOrder,
);

export default router;
