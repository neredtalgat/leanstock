import { Response } from 'express';
import { productService } from '../services/product.service';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';
import { CreateProductInput, UpdateProductInput, ProductQueryInput, ProductIdParam } from '../schemas/product.schema';

export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as any;
    const normalizedData: CreateProductInput = {
      ...body,
      baseCost: body.baseCost ?? body.basePrice,
      retailPrice: body.retailPrice ?? body.basePrice,
    };
    const tenantId = req.tenantId!;

    const product = await productService.create(normalizedData, tenantId);

    res.status(201).json({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      weight: product.weight,
      variants: product.variants,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Create product error');

    if (error.message === 'SKU_EXISTS') {
      res.status(409).json({
        code: 'SKU_EXISTS',
        message: 'SKU already exists in this tenant',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const listProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as ProductQueryInput;
    const tenantId = req.tenantId!;

    const result = await productService.list(
      tenantId,
      query.cursor,
      query.limit,
      query.search,
    );

    res.status(200).json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({ err: error }, 'List products error');

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as unknown as ProductIdParam;
    const tenantId = req.tenantId!;

    const product = await productService.getById(id, tenantId);

    if (!product) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json(product);
  } catch (error) {
    logger.error({ err: error }, 'Get product error');

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const updateProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as unknown as ProductIdParam;
    const body = req.body as any;
    const data: UpdateProductInput = {
      ...body,
      ...(body.basePrice !== undefined && body.retailPrice === undefined
        ? { retailPrice: body.basePrice }
        : {}),
      ...(body.basePrice !== undefined && body.baseCost === undefined
        ? { baseCost: body.basePrice }
        : {}),
    };
    const tenantId = req.tenantId!;

    const product = await productService.update(id, data, tenantId);

    res.status(200).json({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      weight: product.weight,
      variants: product.variants,
      updatedAt: product.updatedAt,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Update product error');

    if (error.message === 'SKU_EXISTS') {
      res.status(409).json({
        code: 'SKU_EXISTS',
        message: 'SKU already exists in this tenant',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as unknown as ProductIdParam;
    const tenantId = req.tenantId!;

    await productService.delete(id, tenantId);

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Delete product error');

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const uploadProductImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params as unknown as ProductIdParam;
    const tenantId = req.tenantId!;
    const { url, isPrimary = false } = req.body;

    if (!url) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Image URL is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await productService.uploadImage(id, url, isPrimary, tenantId);

    res.status(201).json({
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Upload product image error');

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};
