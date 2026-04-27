import { z } from 'zod';

export const listPurchaseOrderSchema = z.object({
  query: z.object({
    status: z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVING', 'COMPLETED', 'CANCELLED']).optional(),
  }),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid(),
    expectedDeliveryDate: z.string().datetime().optional(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    ).min(1),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVING', 'COMPLETED', 'CANCELLED']).optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
  }),
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantityReceived: z.number().int().positive(),
      })
    ).min(1),
  }),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>['body'];
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>['body'];
export type ReceiveItemsInput = z.infer<typeof receivePurchaseOrderSchema>['body'];
