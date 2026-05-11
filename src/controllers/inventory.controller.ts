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
    logger.error({ err: error }, 'List inventory error');
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
    logger.error({ err: error }, 'Adjust inventory error');

    if (error.message === 'INVENTORY_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Inventory record not found' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const getInventoryById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const inventory = await inventoryService.getById(tenantId, id);

    if (!inventory) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Inventory record not found' });
      return;
    }

    res.status(200).json(inventory);
  } catch (error) {
    logger.error({ err: error }, 'Get inventory by id error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const createInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { productId, locationId, quantity, reservedQuantity, inTransit } = req.body;

    const created = await inventoryService.create(tenantId, {
      productId,
      locationId,
      quantity: Number(quantity),
      reservedQuantity: Number(reservedQuantity),
      inTransit: Number(inTransit),
    });

    res.status(201).json(created);
  } catch (error) {
    logger.error({ err: error }, 'Create inventory error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const updateInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { quantity, reservedQuantity, inTransit } = req.body;

    const updated = await inventoryService.update(tenantId, id, {
      ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
      ...(reservedQuantity !== undefined ? { reservedQuantity: Number(reservedQuantity) } : {}),
      ...(inTransit !== undefined ? { inTransit: Number(inTransit) } : {}),
    });

    res.status(200).json(updated);
  } catch (error: any) {
    logger.error({ err: error }, 'Update inventory error');
    if (error.message === 'INVENTORY_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Inventory record not found' });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const deleteInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    await inventoryService.delete(tenantId, id);
    res.status(204).send();
  } catch (error: any) {
    logger.error({ err: error }, 'Delete inventory error');
    if (error.message === 'INVENTORY_NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Inventory record not found' });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
