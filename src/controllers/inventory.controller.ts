import { Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';
import { logger } from '../config/logger';

export class InventoryController {
  async getInventory(req: Request, res: Response) {
    try {
      const { productId, locationId } = req.query;
      const tenantId = req.tenantId;

      if (!tenantId || !productId || !locationId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters',
        });
      }

      const inventory = await inventoryService.getInventory(
        productId as string,
        locationId as string,
        tenantId
      );

      return res.status(200).json({
        success: true,
        data: inventory,
      });
    } catch (error: any) {
      logger.error({ msg: 'Get inventory error', error });
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async recordMovement(req: Request, res: Response) {
    try {
      const { inventoryId, type, quantity, reason, referenceId } = req.body;
      const tenantId = req.tenantId;

      if (!inventoryId || !type || quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const movement = await inventoryService.recordMovement(
        inventoryId,
        type,
        quantity,
        reason,
        referenceId,
        tenantId
      );

      return res.status(201).json({
        success: true,
        data: movement,
      });
    } catch (error: any) {
      logger.error({ msg: 'Record movement error', error });
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async checkLowStock(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const lowStockItems = await inventoryService.checkLowStock(tenantId);

      return res.status(200).json({
        success: true,
        data: lowStockItems,
      });
    } catch (error: any) {
      logger.error({ msg: 'Check low stock error', error });
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const inventoryController = new InventoryController();
export default inventoryController;
