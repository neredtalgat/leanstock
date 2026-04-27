import { Response } from 'express';
import { auditService } from '../services/audit.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { productId, userId, action, limit } = req.query;

    const logs = await auditService.list(tenantId, {
      productId: productId as string,
      userId: userId as string,
      action: action as string,
      limit: limit ? Number(limit) : 50,
    });

    res.status(200).json(logs);
  } catch (error) {
    logger.error('List audit logs error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
