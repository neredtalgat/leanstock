import { z } from 'zod';

export const createLocationSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    address: z.string().max(255).optional(),
    type: z.enum(['WAREHOUSE', 'STORE', 'DISTRIBUTION_CENTER']),
  }),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>['body'];
