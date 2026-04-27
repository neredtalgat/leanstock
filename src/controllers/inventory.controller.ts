import { Response } from 'express';
import { inventoryService } from '../services/inventory.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { productId, locationId, lowStock } = req.query;

    const inventory = await inventoryService.list(tenantId, {
      productId: productId as string,
      locationId: locationId as string,
      lowStock: lowStock === 'true',
    });

    res.status(200).json(inventory);
  } catch (error) {
    logger.error('List inventory error:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const adjustInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { productId, locationId, newQuantity, reason } = req.body;

    const result = await inventoryService.adjust(tenantId, userId, {
      productId,
      locationId,
      newQuantity: Number(newQuantity),
      reason,
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Adjust inventory error:', error);

    if (error.message === 'INVENTORY_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Inventory record not found' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
