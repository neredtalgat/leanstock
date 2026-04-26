import { dbClient, asyncLocalStorage } from '../config/database';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';
import { logger } from '../config/logger';

export class ProductService {
  async create(data: CreateProductInput, tenantId: string) {
    // Check SKU uniqueness within tenant
    const existingProduct = await dbClient.product.findFirst({
      where: {
        sku: data.sku,
        tenantId,
      },
    });

    if (existingProduct) {
      throw new Error('SKU already exists in this tenant');
    }

    // Create product
    const product = await dbClient.product.create({
      data: {
        name: data.name,
        description: data.description,
        sku: data.sku,
        barcode: data.barcode,
        category: data.category,
        price: data.price,
        costPrice: data.costPrice,
        unit: data.unit,
        reorderPoint: data.reorderPoint,
        status: data.status,
        tenantId,
      },
      include: {
        images: true,
      },
    });

    logger.info({
      msg: 'Product created',
      productId: product.id,
      tenantId,
      sku: data.sku,
    });

    return product;
  }

  async update(productId: string, data: UpdateProductInput, tenantId: string) {
    // Verify product exists and belongs to tenant
    const product = await dbClient.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // If SKU is being updated, check uniqueness
    if (data.sku && data.sku !== product.sku) {
      const existingProduct = await dbClient.product.findFirst({
        where: {
          sku: data.sku,
          tenantId,
          NOT: {
            id: productId,
          },
        },
      });

      if (existingProduct) {
        throw new Error('SKU already exists');
      }
    }

    const updatedProduct = await dbClient.product.update({
      where: { id: productId },
      data,
      include: {
        images: true,
      },
    });

    logger.info({
      msg: 'Product updated',
      productId,
      tenantId,
    });

    return updatedProduct;
  }

  async getById(productId: string, tenantId: string) {
    const product = await dbClient.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
      include: {
        images: true,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  }

  async list(
    tenantId: string,
    cursor?: string,
    limit: number = 20,
    search?: string,
    status?: string
  ) {
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const items = await dbClient.product.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
      },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async delete(productId: string, tenantId: string) {
    const product = await dbClient.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const deletedProduct = await dbClient.product.delete({
      where: { id: productId },
    });

    logger.info({
      msg: 'Product deleted',
      productId,
      tenantId,
    });

    return deletedProduct;
  }
}

export const productService = new ProductService();
export default productService;
