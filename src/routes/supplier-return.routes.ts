import { Router } from 'express';
import {
  listReturns,
  getReturn,
  createReturn,
  updateReturn,
  shipReturn,
  markReceived,
  cancelReturn,
} from '../controllers/supplier-return.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.use(injectTenant);

// List all returns
router.get('/', requirePermission('orders:read'), listReturns);

// Get single return
router.get('/:id', requirePermission('orders:read'), getReturn);

// Create return
router.post('/', requirePermission('orders:create'), createReturn);

// Update return
router.put('/:id', requirePermission('orders:update'), updateReturn);

// Ship return
router.post('/:id/ship', requirePermission('orders:update'), shipReturn);

// Mark as received by supplier
router.post('/:id/receive', requirePermission('orders:update'), markReceived);

// Cancel return
router.post('/:id/cancel', requirePermission('orders:delete'), cancelReturn);

export default router;
