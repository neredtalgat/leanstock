import { Response } from 'express';
import { inventoryMovementService } from '../services/inventory-movement.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listMovements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { inventoryId, productId, locationId, type, from, to, limit, offset } = req.query;

    const result = await inventoryMovementService.list(tenantId, {
      inventoryId: inventoryId as string,
      productId: productId as string,
      locationId: locationId as string,
      type: type as string,
      from: from as string,
      to: to as string,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('List inventory movements error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const getMovement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const movement = await inventoryMovementService.getById(tenantId, id);
    if (!movement) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Movement not found' });
      return;
    }

    res.status(200).json(movement);
  } catch (error) {
    logger.error('Get inventory movement error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
