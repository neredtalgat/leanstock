import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { logger } from '../config/logger';
import { CreateProductInput, UpdateProductInput, ListProductsInput } from '../schemas/product.schema';

export class ProductController {
  async create(req: Request, res: Response) {
    try {
      const data: CreateProductInput = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const product = await productService.create(data, tenantId);

      return res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      logger.error({ msg: 'Product creation error', error });
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { cursor, limit, search, status } = req.query as Partial<ListProductsInput>;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const result = await productService.list(
        tenantId,
        cursor as string | undefined,
        limit ? parseInt(limit as string) : 20,
        search as string | undefined,
        status as string | undefined
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error: any) {
      logger.error({ msg: 'Product list error', error });
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const product = await productService.getById(id, tenantId);

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      logger.error({ msg: 'Get product error', error });
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: UpdateProductInput = req.body;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      const product = await productService.update(id, data, tenantId);

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error: any) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      logger.error({ msg: 'Product update error', error });
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required',
        });
      }

      await productService.delete(id, tenantId);

      return res.status(200).json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error: any) {
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      logger.error({ msg: 'Product delete error', error });
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const productController = new ProductController();
export default productController;
