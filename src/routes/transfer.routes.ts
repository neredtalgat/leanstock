import { Router } from 'express';
import * as transferController from '../controllers/transfer.controller';
import { validate, validateParams } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import {
  CreateTransferInput,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveTransferInput,
  TransferIdParamSchema,
} from '../schemas/transfer.schema';

const router = Router();

/**
 * GET /transfers
 * List all transfers
 */
router.get(
  '/',
  authenticate,
  injectTenant,
  transferController.listTransfers,
);

/**
 * GET /transfers/:id
 * Get transfer by ID
 */
router.get(
  '/:id',
  authenticate,
  injectTenant,
  transferController.getTransfer,
);

/**
 * POST /transfers
 * Create a new transfer (atomic with SELECT FOR UPDATE)
 */
router.post(
  '/',
  authenticate,
  injectTenant,
  requirePermission('orders:create'),
  validate(CreateTransferInput),
  transferController.createTransfer,
);

router.post(
  '/:id/approve',
  authenticate,
  injectTenant,
  requirePermission('orders:approve'),
  validateParams(TransferIdParamSchema),
  validate(ApproveTransferInput),
  transferController.approveTransfer,
);

router.post(
  '/:id/ship',
  authenticate,
  injectTenant,
  requirePermission('orders:update'),
  validateParams(TransferIdParamSchema),
  validate(ShipTransferInput),
  transferController.shipTransfer,
);

router.post(
  '/:id/receive',
  authenticate,
  injectTenant,
  requirePermission('orders:update'),
  validateParams(TransferIdParamSchema),
  validate(ReceiveTransferInput),
  transferController.receiveTransfer,
);

export default router;
