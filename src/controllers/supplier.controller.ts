import { Response } from 'express';
import { supplierService } from '../services/supplier.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export const listSuppliers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { search } = req.query as { search?: string };
    const suppliers = await supplierService.list(tenantId, { search });
    res.status(200).json(suppliers);
  } catch (error) {
    logger.error({ err: error }, 'List suppliers error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const getSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const supplier = await supplierService.getById(tenantId, id);

    if (!supplier) {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }

    res.status(200).json(supplier);
  } catch (error) {
    logger.error({ err: error }, 'Get supplier error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const createSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { name, email, phone, address } = req.body;

    const supplier = await supplierService.create(tenantId, { name, email, phone, address });
    res.status(201).json(supplier);
  } catch (error) {
    logger.error({ err: error }, 'Create supplier error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const updateSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    const supplier = await supplierService.update(tenantId, id, { name, email, phone, address });
    res.status(200).json(supplier);
  } catch (error) {
    if ((error as Error).message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    logger.error({ err: error }, 'Update supplier error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const deleteSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    await supplierService.delete(tenantId, id);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    if (message === 'SUPPLIER_HAS_PURCHASE_ORDERS') {
      res.status(409).json({ code: 'SUPPLIER_HAS_PURCHASE_ORDERS', message: 'Cannot delete supplier with existing purchase orders' });
      return;
    }
    logger.error({ err: error }, 'Delete supplier error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const getSupplierProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const products = await supplierService.getProducts(tenantId, id);
    res.status(200).json(products);
  } catch (error) {
    if ((error as Error).message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    logger.error({ err: error }, 'Get supplier products error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const addSupplierProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { productId, supplierSku, price, leadTimeDays } = req.body;

    const supplierProduct = await supplierService.addProduct(tenantId, id, {
      productId,
      supplierSku,
      price,
      leadTimeDays,
    });
    res.status(201).json(supplierProduct);
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    if (message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
      return;
    }
    logger.error({ err: error }, 'Add supplier product error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};

export const removeSupplierProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { id, productId } = req.params;

    await supplierService.removeProduct(tenantId, id, productId);
    res.status(204).send();
  } catch (error) {
    if ((error as Error).message === 'SUPPLIER_NOT_FOUND') {
      res.status(404).json({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
      return;
    }
    logger.error({ err: error }, 'Remove supplier product error');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
};
