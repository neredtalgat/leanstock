import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { validate, validateQuery, validateParams } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productIdParamSchema,
} from '../schemas/product.schema';

const router = Router();

/**
 * GET /products
 * List all products with pagination
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  validateQuery(productQuerySchema),
  productController.listProducts,
);

/**
 * GET /products/:id
 * Get a single product by ID
 */
router.get(
  '/:id',
  authenticate,
  injectTenant,
  validateParams(productIdParamSchema),
  productController.getProduct,
);

/**
 * POST /products
 * Create a new product (requires products:create permission)
 */
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('products:create'),
  validate(createProductSchema),
  productController.createProduct,
);

/**
 * PUT /products/:id
 * Update a product (requires products:update permission)
 */
router.put(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('products:update'),
  validateParams(productIdParamSchema),
  validate(updateProductSchema),
  productController.updateProduct,
);

/**
 * DELETE /products/:id
 * Delete a product (requires products:delete permission)
 */
router.delete(
  '/:id',
  authenticate,
  injectTenant,
  requirePermission('products:delete'),
  validateParams(productIdParamSchema),
  productController.deleteProduct,
);

/**
 * POST /products/:id/images
 * Upload product image (requires products:update permission)
 */
router.post(
  '/:id/images',
  authenticate,
  injectTenant,
  requirePermission('products:update'),
  validateParams(productIdParamSchema),
  productController.uploadProductImage,
);

export default router;
