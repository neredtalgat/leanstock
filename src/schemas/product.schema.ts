import { z } from 'zod';

export const productVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'Variant SKU is required'),
  value: z.string().min(1, 'Variant value is required'),
});

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU must be less than 50 characters'),
  name: z.string().min(1, 'Product name is required').max(255, 'Product name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  baseCost: z.number().positive('Base cost must be positive'),
  retailPrice: z.number().positive('Retail price must be positive'),
  weight: z.number().positive('Weight must be positive').optional(),
  variants: z.array(productVariantSchema).max(5, 'Maximum 5 variants allowed').optional(),
});

export const updateProductSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  baseCost: z.number().positive().optional(),
  retailPrice: z.number().positive().optional(),
  weight: z.number().positive().optional(),
});

export const productQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  locationId: z.string().uuid().optional(),
  lowStock: z.coerce.boolean().optional(),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid('Invalid product ID'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
