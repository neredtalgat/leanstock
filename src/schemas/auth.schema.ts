import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum([
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'REGIONAL_MANAGER',
    'STORE_MANAGER',
    'STORE_ASSOCIATE',
    'SUPPLIER',
  ]).default('STORE_ASSOCIATE'),
  tenantId: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Invalid refresh token'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
