import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import {
  listDeadStockRules, createDeadStockRule, updateDeadStockRule, deleteDeadStockRule
} from '../controllers/deadStock.controller';

const DeadStockRuleSchema = z.object({
  name: z.string().min(1),
  daysThreshold: z.number().int().min(1),
  discountPercent: z.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

const router = Router();

router.get('/', authenticate, injectTenant, listDeadStockRules);
router.post('/', authenticate, injectTenant, requirePermission('settings:manage'), validate(DeadStockRuleSchema), createDeadStockRule);
router.put('/:id', authenticate, injectTenant, requirePermission('settings:manage'), validate(DeadStockRuleSchema), updateDeadStockRule);
router.delete('/:id', authenticate, injectTenant, requirePermission('settings:manage'), deleteDeadStockRule);

export default router;
