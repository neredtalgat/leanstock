import { z } from 'zod';

export const listInventorySchema = z.object({
  productId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
});

export const adjustInventorySchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(1).max(255),
});

export const inventoryIdParamSchema = z.object({
  id: z.string().min(1, 'Inventory ID is required'),
});

export const createInventorySchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.number().int().min(0).default(0),
  reservedQuantity: z.number().int().min(0).default(0),
  inTransit: z.number().int().min(0).default(0),
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0).optional(),
  reservedQuantity: z.number().int().min(0).optional(),
  inTransit: z.number().int().min(0).optional(),
});

export type ListInventoryQuery = z.infer<typeof listInventorySchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
