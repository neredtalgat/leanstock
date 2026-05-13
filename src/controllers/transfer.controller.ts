import { Response } from 'express';
import { transferService } from '../services/transfer.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import {
  CreateTransferInput,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveItemInput,
} from '../schemas/transfer.schema';

export const createTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as CreateTransferInput;
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const transfer = await transferService.create(data, userId, tenantId);

    res.status(201).json(transfer);
  } catch (error: any) {
    logger.error({ err: error }, 'Create transfer error');

    if (error.message === 'SAME_LOCATION') {
      res.status(400).json({ code: 'SAME_LOCATION', message: 'Source and destination cannot be the same' });
      return;
    }
    if (error.message === 'INVALID_LOCATION') {
      res.status(400).json({ code: 'INVALID_LOCATION', message: 'Invalid location' });
      return;
    }
    if (error.message?.startsWith('PRODUCT_NOT_IN_LOCATION')) {
      res.status(400).json({
        code: 'PRODUCT_NOT_IN_LOCATION',
        message: 'Product is not available in source location inventory',
      });
      return;
    }
    if (error.message?.startsWith('INSUFFICIENT_STOCK')) {
      res.status(409).json({ code: 'INSUFFICIENT_STOCK', message: 'Not enough stock available' });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && error?.message ? { details: error.message } : {}),
    });
  }
};

export const getTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const transfer = await transferService.getById(id, tenantId);
    if (!transfer) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Transfer not found' });
      return;
    }
    res.status(200).json(transfer);
  } catch (error) {
    logger.error({ err: error }, 'Get transfer error');
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
    logger.error({ err: error }, 'List transfers error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const approveTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body as ApproveTransferInput;
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const transfer = await transferService.approve(id, data, userId, tenantId);
    res.status(200).json(transfer);
  } catch (error: any) {
    logger.error({ err: error }, 'Approve transfer error');

    if (error.message === 'TRANSFER_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Transfer not found' });
      return;
    }
    if (error.message === 'INVALID_STATUS') {
      res.status(400).json({ code: 'INVALID_STATUS', message: 'Transfer status does not allow this action' });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && error?.message ? { details: error.message } : {}),
    });
  }
};

export const shipTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body as ShipTransferInput;
    const tenantId = req.tenantId!;

    const transfer = await transferService.ship(id, data, tenantId);
    res.status(200).json(transfer);
  } catch (error: any) {
    logger.error({ err: error }, 'Ship transfer error');

    if (error.message === 'TRANSFER_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Transfer not found' });
      return;
    }
    if (error.message === 'INVALID_STATUS') {
      res.status(400).json({ code: 'INVALID_STATUS', message: 'Transfer status does not allow shipping' });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && error?.message ? { details: error.message } : {}),
    });
  }
};

export const receiveTransfer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const items = req.body.items as ReceiveItemInput[];
    const tenantId = req.tenantId!;

    const transfer = await transferService.receive(id, items, tenantId);
    res.status(200).json(transfer);
  } catch (error: any) {
    logger.error({ err: error }, 'Receive transfer error');

    if (error.message === 'TRANSFER_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Transfer not found' });
      return;
    }
    if (error.message === 'INVALID_STATUS') {
      res.status(400).json({ code: 'INVALID_STATUS', message: 'Transfer status does not allow receiving' });
      return;
    }
    if (error.message?.startsWith('ITEM_NOT_FOUND')) {
      res.status(400).json({ code: 'ITEM_NOT_FOUND', message: 'Transfer item not found in this transfer' });
      return;
    }
    if (error.message?.startsWith('EXCESS_RECEIVED')) {
      res.status(400).json({ code: 'EXCESS_RECEIVED', message: 'Received quantity exceeds transfer quantity' });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && error?.message ? { details: error.message } : {}),
    });
  }
};
