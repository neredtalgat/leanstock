// Using Prisma types that will be available after generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any;
import { tenantDb, asyncLocalStorage } from '../config/database';
import { logger } from '../config/logger';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';
import { encodeCursor } from '../utils/helpers';

export interface PaginatedProducts {
  data: Product[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export class ProductService {
  /**
   * Create a new product with optional variants
   */
  async create(data: CreateProductInput, tenantId: string): Promise<Product> {
    try {
      // Check SKU uniqueness within tenant
      const existingProduct = await tenantDb.product.findFirst({
        where: {
          sku: data.sku,
          tenantId,
        },
      });

      if (existingProduct) {
        throw new Error('SKU_EXISTS');
      }

      // Create product with variants in transaction
      return await asyncLocalStorage.run({ tenantId }, async () => {
        const product = await tenantDb.product.create({
          data: {
            sku: data.sku,
            name: data.name,
            description: data.description,
            basePrice: data.basePrice,
            weight: data.weight,
            tenantId,
            variants: data.variants
              ? {
                  create: data.variants.map((variant) => ({
                    name: variant.name,
                    sku: variant.sku,
                    value: variant.value,
                  })),
                }
              : undefined,
          },
          include: {
            variants: true,
          },
        });

        // Create inventory records for all locations
        const locations = await tenantDb.location.findMany({
          where: { tenantId },
          select: { id: true },
        });

        if (locations.length > 0) {
          await tenantDb.inventory.createMany({
            data: locations.map((location: { id: string }) => ({
              tenantId,
              productId: product.id,
              locationId: location.id,
              quantity: 0,
              reservedQuantity: 0,
            })),
          });
        }

        logger.info(`Product created: ${product.id} in tenant ${tenantId}`);
        return product;
      });
    } catch (error) {
      logger.error({ err: error, tenantId }, 'Error creating product');
      throw error;
    }
  }

  /**
   * List products with cursor-based pagination
   */
  async list(
    tenantId: string,
    cursor?: string,
    limit: number = 20,
    search?: string,
  ): Promise<PaginatedProducts> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { tenantId };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      const take = limit + 1; // Fetch one extra to check if there's more

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursorCondition: any;

      if (cursor) {
        const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        cursorCondition = { id: decodedCursor.id };
      }

      const products = await tenantDb.product.findMany({
        where,
        take,
        skip: cursorCondition ? 1 : undefined,
        cursor: cursorCondition,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: true,
          inventory: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const hasMore = products.length > limit;
      const data = hasMore ? products.slice(0, limit) : products;

      const nextCursor = hasMore && data.length > 0
        ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].createdAt })
        : null;

      return {
        data,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error({ err: error, tenantId }, 'Error listing products');
      throw error;
    }
  }

  /**
   * Get a single product by ID
   */
  async getById(productId: string, tenantId: string): Promise<Product | null> {
    try {
      return await tenantDb.product.findFirst({
        where: {
          id: productId,
          tenantId,
        },
        include: {
          variants: true,
          images: true,
          inventory: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error({ err: error, productId, tenantId }, 'Error getting product');
      throw error;
    }
  }

  /**
   * Update a product
   */
  async update(productId: string, data: UpdateProductInput, tenantId: string): Promise<Product> {
    try {
      // Check if SKU is being changed and is unique
      if (data.sku) {
        const existingProduct = await tenantDb.product.findFirst({
          where: {
            sku: data.sku,
            tenantId,
            NOT: { id: productId },
          },
        });

        if (existingProduct) {
          throw new Error('SKU_EXISTS');
        }
      }

      const product = await tenantDb.product.update({
        where: {
          id: productId,
        },
        data: {
          ...(data.sku && { sku: data.sku }),
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.basePrice && { basePrice: data.basePrice }),
          ...(data.weight !== undefined && { weight: data.weight }),
        },
        include: {
          variants: true,
        },
      });

      logger.info(`Product updated: ${productId} in tenant ${tenantId}`);
      return product;
    } catch (error) {
      logger.error({ err: error, productId, tenantId }, 'Error updating product');
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async delete(productId: string, tenantId: string): Promise<void> {
    try {
      await tenantDb.product.delete({
        where: {
          id: productId,
        },
      });

      logger.info(`Product deleted: ${productId} in tenant ${tenantId}`);
    } catch (error) {
      logger.error({ err: error, productId, tenantId }, 'Error deleting product');
      throw error;
    }
  }

  /**
   * Upload product image
   */
  async uploadImage(
    productId: string,
    url: string,
    isPrimary: boolean,
    tenantId: string,
  ): Promise<void> {
    try {
      // If this is primary, unset other primary images
      if (isPrimary) {
        await tenantDb.productImage.updateMany({
          where: {
            productId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      await tenantDb.productImage.create({
        data: {
          productId,
          url,
          isPrimary,
        },
      });

      logger.info(`Image uploaded for product ${productId} in tenant ${tenantId}`);
    } catch (error) {
      logger.error({ err: error, productId, tenantId }, 'Error uploading product image');
      throw error;
    }
  }
}

export const productService = new ProductService();
