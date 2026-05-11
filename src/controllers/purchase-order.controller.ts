import { Response } from 'express';
import { purchaseOrderService } from '../services/purchase-order.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listPurchaseOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { status } = req.query;

    const orders = await purchaseOrderService.list(tenantId, status as string);
    res.status(200).json(orders);
  } catch (error) {
    logger.error({ err: error }, 'List purchase orders error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const createPurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { supplierId, expectedDeliveryDate, items } = req.body;

    const order = await purchaseOrderService.create(tenantId, userId, {
      supplierId,
      expectedDeliveryDate,
      items,
    });

    res.status(201).json(order);
  } catch (error: any) {
    logger.error({ err: error }, 'Create purchase order error');

    if (error.message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    if (error.message?.startsWith('PRODUCT_NOT_FOUND')) {
      res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const updatePurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status, expectedDeliveryDate } = req.body;

    const order = await purchaseOrderService.update(tenantId, id, userId, {
      status,
      expectedDeliveryDate,
    });

    res.status(200).json(order);
  } catch (error: any) {
    logger.error({ err: error }, 'Update purchase order error');

    if (error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'Purchase order not found' });
      return;
    }
    if (error.message === 'INVALID_STATUS_TRANSITION') {
      res.status(400).json({ code: 'INVALID_STATUS', message: 'Invalid status transition' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const receivePurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const { items } = req.body;

    const order = await purchaseOrderService.receive(tenantId, id, userId, { items });

    res.status(200).json(order);
  } catch (error: any) {
    logger.error({ err: error }, 'Receive purchase order error');

    if (error.message === 'ORDER_NOT_FOUND') {
      res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'Purchase order not found' });
      return;
    }
    if (error.message?.startsWith('PRODUCT_NOT_IN_ORDER')) {
      res.status(400).json({ code: 'PRODUCT_NOT_IN_ORDER', message: 'Product not in order' });
      return;
    }

    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
