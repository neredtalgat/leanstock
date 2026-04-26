import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().optional(),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().optional(),
  category: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  costPrice: z.number().positive('Cost price must be positive').optional(),
  unit: z.string().default('piece'),
  reorderPoint: z.number().nonnegative().default(10),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
});

export const updateProductSchema = createProductSchema.partial();

export const productImageSchema = z.object({
  isPrimary: z.boolean().default(false),
});

export const listProductsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
