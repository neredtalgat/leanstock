import { z } from 'zod';

export const TransferItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
});

export const CreateTransferInput = z.object({
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  items: z.array(TransferItemSchema).min(1),
  notes: z.string().optional(),
});

export const ReceiveItemInput = z.object({
  productId: z.string().cuid(),
  quantityReceived: z.number().int().nonnegative(),
});

export const ReceiveTransferInput = z.object({
  items: z.array(ReceiveItemInput).min(1),
});

export const ShipTransferInput = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
});

export const ApproveTransferInput = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const TransferIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateTransferInput = z.infer<typeof CreateTransferInput>;
export type ReceiveItemInput = z.infer<typeof ReceiveItemInput>;
export type ShipTransferInput = z.infer<typeof ShipTransferInput>;
export type ApproveTransferInput = z.infer<typeof ApproveTransferInput>;
