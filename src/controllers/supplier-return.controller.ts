import { Request, Response } from 'express';
import { supplierReturnService } from '../services/supplier-return.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listReturns = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const status = req.query.status as string | undefined;
    const returns = await supplierReturnService.list(tenantId, status);
    res.status(200).json({
      success: true,
      data: returns,
    });
  } catch (error) {
    logger.error('List supplier returns error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to list supplier returns',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getReturn = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const ret = await supplierReturnService.getById(tenantId, id);
    if (!ret) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Supplier return not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error) {
    logger.error('Get supplier return error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get supplier return',
      timestamp: new Date().toISOString(),
    });
  }
};

export const createReturn = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const ret = await supplierReturnService.create(tenantId, userId, req.body);
    res.status(201).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error('Create supplier return error:', error);
    if (error.message === 'SUPPLIER_NOT_FOUND') {
      res.status(400).json({
        code: 'SUPPLIER_NOT_FOUND',
        message: 'Supplier not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'LOCATION_NOT_FOUND') {
      res.status(400).json({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message?.startsWith('PRODUCT_NOT_IN_LOCATION:')) {
      res.status(400).json({
        code: 'PRODUCT_NOT_IN_LOCATION',
        message: 'Product not found in the specified location',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message?.startsWith('INSUFFICIENT_STOCK:')) {
      res.status(400).json({
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock to process return',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create supplier return',
      timestamp: new Date().toISOString(),
    });
  }
};

export const updateReturn = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const ret = await supplierReturnService.update(tenantId, id, userId, req.body);
    res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error('Update supplier return error:', error);
    if (error.message === 'RETURN_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Supplier return not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'CANNOT_UPDATE_SUBMITTED_RETURN') {
      res.status(400).json({
        code: 'CANNOT_UPDATE_SUBMITTED_RETURN',
        message: 'Cannot update a submitted return',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update supplier return',
      timestamp: new Date().toISOString(),
    });
  }
};

export const shipReturn = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const ret = await supplierReturnService.ship(tenantId, id, userId, req.body);
    res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error('Ship supplier return error:', error);
    if (error.message === 'RETURN_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Supplier return not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'RETURN_NOT_APPROVED') {
      res.status(400).json({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before shipping',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to ship supplier return',
      timestamp: new Date().toISOString(),
    });
  }
};

export const markReceived = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const ret = await supplierReturnService.markReceivedBySupplier(tenantId, id, userId);
    res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error('Mark supplier return received error:', error);
    if (error.message === 'RETURN_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Supplier return not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'RETURN_NOT_SHIPPED') {
      res.status(400).json({
        code: 'RETURN_NOT_SHIPPED',
        message: 'Return must be shipped before marking as received',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to mark supplier return as received',
      timestamp: new Date().toISOString(),
    });
  }
};

export const cancelReturn = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const { id } = req.params;
    const reason = req.body.reason;
    const ret = await supplierReturnService.cancel(tenantId, id, userId, reason);
    res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error('Cancel supplier return error:', error);
    if (error.message === 'RETURN_NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Supplier return not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error.message === 'CANNOT_CANCEL_SHIPPED_RETURN') {
      res.status(400).json({
        code: 'CANNOT_CANCEL_SHIPPED_RETURN',
        message: 'Cannot cancel a return that has already been shipped',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to cancel supplier return',
      timestamp: new Date().toISOString(),
    });
  }
};
