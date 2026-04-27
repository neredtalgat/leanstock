import { Router } from 'express';
import * as transferController from '../controllers/transfer.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { CreateTransferInput } from '../schemas/transfer.schema';

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

export default router;
