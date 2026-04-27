import { z } from 'zod';

export const listInventorySchema = z.object({
  query: z.object({
    productId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    lowStock: z.enum(['true', 'false']).optional(),
  }),
});

export const adjustInventorySchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    locationId: z.string().uuid(),
    newQuantity: z.number().int().min(0),
    reason: z.string().min(1).max(255),
  }),
});

export type ListInventoryQuery = z.infer<typeof listInventorySchema>['query'];
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>['body'];
