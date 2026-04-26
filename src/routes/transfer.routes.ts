import { Router } from 'express';
import { transferController } from '../controllers/transfer.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/rbac';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// Schemas
const createTransferSchema = z.object({
  sourceLocationId: z.string().min(1),
  destinationLocationId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().positive(),
    })
  ),
  notes: z.string().optional(),
});

const approveTransferSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

const shipTransferSchema = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
});

const receiveTransferSchema = z.object({
  items: z.array(
    z.object({
      transferItemId: z.string().min(1),
      quantityReceived: z.number().nonnegative(),
    })
  ),
});

// Routes
router.post(
  '/',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler(requirePermission('transfers:create')),
  validate(createTransferSchema),
  asyncHandler((req, res, next) => transferController.create(req, res, next))
);

router.get(
  '/',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler((req, res, next) => transferController.list(req, res, next))
);

router.get(
  '/:id',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler((req, res, next) => transferController.getById(req, res, next))
);

router.post(
  '/:id/approve',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler(requirePermission('transfers:approve')),
  validate(approveTransferSchema),
  asyncHandler((req, res, next) => transferController.approve(req, res, next))
);

router.post(
  '/:id/ship',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler(requirePermission('transfers:ship')),
  validate(shipTransferSchema),
  asyncHandler((req, res, next) => transferController.ship(req, res, next))
);

router.post(
  '/:id/receive',
  asyncHandler(authenticate),
  asyncHandler(injectTenant),
  asyncHandler(requirePermission('transfers:receive')),
  validate(receiveTransferSchema),
  asyncHandler((req, res, next) => transferController.receive(req, res, next))
);

export const transferRoutes = router;
