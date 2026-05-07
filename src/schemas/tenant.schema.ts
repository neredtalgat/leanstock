import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters').max(120, 'Tenant name is too long'),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
