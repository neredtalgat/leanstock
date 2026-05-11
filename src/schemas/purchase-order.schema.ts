import { z } from 'zod';

export const listPurchaseOrderSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVING', 'COMPLETED', 'CANCELLED']).optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDeliveryDate: z.string().datetime().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
    })
  ).min(1),
});

export const updatePurchaseOrderSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVING', 'COMPLETED', 'CANCELLED']).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
});

export const receivePurchaseOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantityReceived: z.number().int().positive(),
    })
  ).min(1),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type ReceiveItemsInput = z.infer<typeof receivePurchaseOrderSchema>;
