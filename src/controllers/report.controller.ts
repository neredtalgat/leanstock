import { Response } from 'express';
import { reportService } from '../services/report.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const getLowStockReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const items = await reportService.getLowStock(tenantId);
    res.status(200).json(items);
  } catch (error) {
    logger.error('Low stock report error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
