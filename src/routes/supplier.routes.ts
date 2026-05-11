import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  createSupplierSchema,
  updateSupplierSchema,
  addSupplierProductSchema,
} from '../schemas/supplier.schema';

const router = Router();

/**
 * GET /suppliers
 * List all suppliers for tenant
 */
router.get('/', authenticate, injectTenant, supplierController.listSuppliers);

/**
 * GET /suppliers/:id
 * Get supplier by ID with products
 */
router.get('/:id', authenticate, injectTenant, supplierController.getSupplier);

/**
 * POST /suppliers
 * Create a new supplier
 */
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('suppliers:create'),
  validate(createSupplierSchema),
  supplierController.createSupplier,
);

/**
 * PUT /suppliers/:id
 * Update supplier
 */
router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('suppliers:update'),
  validate(updateSupplierSchema),
  supplierController.updateSupplier,
);

/**
 * DELETE /suppliers/:id
 * Delete supplier
 */
router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('suppliers:delete'),
  supplierController.deleteSupplier,
);

/**
 * GET /suppliers/:id/products
 * Get supplier products
 */
router.get('/:id/products', authenticate, injectTenant, supplierController.getSupplierProducts);

/**
 * POST /suppliers/:id/products
 * Add product to supplier
 */
router.post(
  '/:id/products',
  authenticate,
  injectTenant,
  requirePermission('suppliers:update'),
  validate(addSupplierProductSchema),
  supplierController.addSupplierProduct,
);

/**
 * DELETE /suppliers/:id/products/:productId
 * Remove product from supplier
 */
router.delete(
  '/:id/products/:productId',
  authenticate,
  injectTenant,
  requirePermission('suppliers:update'),
  supplierController.removeSupplierProduct,
);

export default router;
