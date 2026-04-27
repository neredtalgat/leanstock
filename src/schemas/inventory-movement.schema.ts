import { z } from 'zod';

export const listMovementsSchema = z.object({
  inventoryId: z.string().optional(),
  productId: z.string().optional(),
  locationId: z.string().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'RETURN']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional().transform((v) => (v ? Number(v) : 50)).pipe(z.number().int().min(1).max(100)),
  offset: z.string().optional().transform((v) => (v ? Number(v) : 0)).pipe(z.number().int().min(0)),
});

export type ListMovementsQuery = z.infer<typeof listMovementsSchema>;
