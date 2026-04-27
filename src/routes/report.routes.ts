import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';

const router = Router();

/**
 * GET /reports/low-stock
 * Get low stock report
 */
router.get(
  '/low-stock',
  authenticate,
  injectTenant,
  reportController.getLowStockReport,
);

export default router;
