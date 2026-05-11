import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

export const addSupplierProductSchema = z.object({
  productId: z.string().min(1),
  supplierSku: z.string().min(1),
  price: z.number().min(0.01),
  leadTimeDays: z.number().int().min(0).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type AddSupplierProductInput = z.infer<typeof addSupplierProductSchema>;
