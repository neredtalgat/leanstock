import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission, injectTenant } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} from '../schemas/product.schema';

const router = Router();

// All product routes require authentication and tenant injection
router.use(authenticate);
router.use(injectTenant);

/**
 * POST /products
 * Create a new product
 */
router.post(
  '/',
  requirePermission('products:create'),
  validate(createProductSchema),
  (req, res) => productController.create(req, res)
);

/**
 * GET /products
 * List products with pagination
 */
router.get(
  '/',
  requirePermission('products:read'),
  (req, res) => productController.list(req, res)
);

/**
 * GET /products/:id
 * Get a specific product
 */
router.get(
  '/:id',
  requirePermission('products:read'),
  (req, res) => productController.getById(req, res)
);

/**
 * PATCH /products/:id
 * Update a product
 */
router.patch(
  '/:id',
  requirePermission('products:update'),
  validate(updateProductSchema),
  (req, res) => productController.update(req, res)
);

/**
 * DELETE /products/:id
 * Delete a product
 */
router.delete(
  '/:id',
  requirePermission('products:delete'),
  (req, res) => productController.delete(req, res)
);

export default router;
