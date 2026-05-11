import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  type: z.enum(['WAREHOUSE', 'STORE', 'DISTRIBUTION_CENTER']),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).optional(),
  type: z.enum(['WAREHOUSE', 'STORE', 'DISTRIBUTION_CENTER']).optional(),
});

export const locationIdParamSchema = z.object({
  id: z.string().min(1, 'Location ID is required'),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
