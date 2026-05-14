import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string()
    .min(2, 'Tenant name must be at least 2 characters')
    .max(120, 'Tenant name is too long'),

  // Optional: create tenant admin user
  adminEmail: z.string().email('Invalid email address').optional(),
  adminFirstName: z.string().min(1, 'First name required if creating admin').optional(),
  adminLastName: z.string().min(1, 'Last name required if creating admin').optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
