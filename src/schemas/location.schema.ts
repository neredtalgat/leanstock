import { z } from 'zod';

const LOCATION_TYPES = ['WAREHOUSE', 'STORE', 'DISTRIBUTION_CENTER'] as const;

const locationTypeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => LOCATION_TYPES.includes(value as (typeof LOCATION_TYPES)[number]), {
    message: 'Invalid location type',
  });

export const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  type: locationTypeSchema,
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).optional(),
  type: locationTypeSchema.optional(),
});

export const locationIdParamSchema = z.object({
  id: z.string().min(1, 'Location ID is required'),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
