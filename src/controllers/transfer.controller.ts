import { Response } from 'express';
import { transferService } from '../services/transfer.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { CreateTransferInput } from '../schemas/transfer.schema';

export const createTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as CreateTransferInput;
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const transfer = await transferService.create(data, userId, tenantId);

    res.status(201).json(transfer);
  } catch (error: any) {
    logger.error('Create transfer error:', error);

    if (error.message === 'SAME_LOCATION') {
      res.status(400).json({ code: 'SAME_LOCATION', message: 'Source and destination cannot be the same' });
      return;
    }
    if (error.message === 'INVALID_LOCATION') {
      res.status(400).json({ code: 'INVALID_LOCATION', message: 'Invalid location' });
      return;
    }
    if (error.message?.startsWith('INSUFFICIENT_STOCK')) {
      res.status(409).json({ code: 'INSUFFICIENT_STOCK', message: 'Not enough stock available' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const listTransfers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const status = req.query.status as string | undefined;

    const transfers = await transferService.list(tenantId, status);
    res.status(200).json(transfers);
  } catch (error) {
    logger.error('List transfers error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
