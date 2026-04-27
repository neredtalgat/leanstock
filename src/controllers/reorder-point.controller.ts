import { Response } from 'express';
import { reorderPointService } from '../services/reorder-point.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listReorderPoints = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { productId, locationId, lowStock } = req.query;

    const result = await reorderPointService.list(tenantId, {
      productId: productId as string,
      locationId: locationId as string,
      lowStock: lowStock === 'true',
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('List reorder points error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const getReorderPoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const rp = await reorderPointService.getById(tenantId, id);
    if (!rp) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Reorder point not found' });
      return;
    }

    res.status(200).json(rp);
  } catch (error) {
    logger.error('Get reorder point error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const createReorderPoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { productId, locationId, minQuantity, maxQuantity } = req.body;

    const rp = await reorderPointService.create(tenantId, {
      productId,
      locationId,
      minQuantity,
      maxQuantity,
    });
    res.status(201).json(rp);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
      return;
    }
    if (msg === 'LOCATION_NOT_FOUND') {
      res.status(404).json({ code: 'LOCATION_NOT_FOUND', message: 'Location not found' });
      return;
    }
    if (msg === 'REORDER_POINT_EXISTS') {
      res.status(409).json({ code: 'REORDER_POINT_EXISTS', message: 'Reorder point already exists for this product and location' });
      return;
    }
    logger.error('Create reorder point error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const updateReorderPoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { minQuantity, maxQuantity } = req.body;

    const rp = await reorderPointService.update(tenantId, id, { minQuantity, maxQuantity });
    res.status(200).json(rp);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'REORDER_POINT_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Reorder point not found' });
      return;
    }
    logger.error('Update reorder point error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const deleteReorderPoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    await reorderPointService.delete(tenantId, id);
    res.status(204).send();
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'REORDER_POINT_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Reorder point not found' });
      return;
    }
    logger.error('Delete reorder point error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
