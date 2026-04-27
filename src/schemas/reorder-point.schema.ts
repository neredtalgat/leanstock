import { z } from 'zod';

export const createReorderPointSchema = z.object({
  body: z.object({
    productId: z.string(),
    locationId: z.string(),
    minQuantity: z.number().int().min(0),
    maxQuantity: z.number().int().min(0),
  }),
});

export const updateReorderPointSchema = z.object({
  body: z.object({
    minQuantity: z.number().int().min(0).optional(),
    maxQuantity: z.number().int().min(0).optional(),
  }),
});

export const listReorderPointsSchema = z.object({
  productId: z.string().optional(),
  locationId: z.string().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
});

export type CreateReorderPointInput = z.infer<typeof createReorderPointSchema>['body'];
export type UpdateReorderPointInput = z.infer<typeof updateReorderPointSchema>['body'];
export type ListReorderPointsQuery = z.infer<typeof listReorderPointsSchema>;
