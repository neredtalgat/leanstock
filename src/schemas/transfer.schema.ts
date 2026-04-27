import { z } from 'zod';

export const TransferItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const CreateTransferInput = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  items: z.array(TransferItemSchema).min(1),
  notes: z.string().optional(),
});

export const ReceiveItemInput = z.object({
  productId: z.string().uuid(),
  quantityReceived: z.number().int().nonnegative(),
});

export const ShipTransferInput = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
});

export const ApproveTransferInput = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export type CreateTransferInput = z.infer<typeof CreateTransferInput>;
export type ReceiveItemInput = z.infer<typeof ReceiveItemInput>;
export type ShipTransferInput = z.infer<typeof ShipTransferInput>;
export type ApproveTransferInput = z.infer<typeof ApproveTransferInput>;
