import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateReorderPointInput {
  productId: string;
  locationId: string;
  minQuantity: number;
  maxQuantity: number;
}

export interface UpdateReorderPointInput {
  minQuantity?: number;
  maxQuantity?: number;
}

export interface ListFilters {
  productId?: string;
  locationId?: string;
  lowStock?: boolean;
}

class ReorderPointService {
  async list(tenantId: string, filters: ListFilters) {
    const where: any = { tenantId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.locationId) where.locationId = filters.locationId;

    const reorderPoints = await (tenantDb as any).reorderPoint.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (filters.lowStock) {
      const inventoryItems = await (tenantDb as any).inventory.findMany({
        where: {
          tenantId,
          ...(filters.productId && { productId: filters.productId }),
          ...(filters.locationId && { locationId: filters.locationId }),
        },
      });
      const inventoryMap = new Map<string, { productId: string; locationId: string; quantity: number; reservedQuantity: number }>(
        inventoryItems.map((i: any) => [`${i.productId}_${i.locationId}`, i])
      );

      const filtered = reorderPoints.filter((rp: any) => {
        const inv = inventoryMap.get(`${rp.productId}_${rp.locationId}`);
        if (!inv) return false;
        return (inv.quantity - inv.reservedQuantity) <= rp.minQuantity;
      });

      return filtered.map((rp: any) => {
        const inv = inventoryMap.get(`${rp.productId}_${rp.locationId}`);
        return {
          id: rp.id,
          productId: rp.productId,
          locationId: rp.locationId,
          product: rp.product,
          minQuantity: rp.minQuantity,
          maxQuantity: rp.maxQuantity,
          currentStock: inv?.quantity || 0,
          reservedStock: inv?.reservedQuantity || 0,
          createdAt: rp.createdAt,
          updatedAt: rp.updatedAt,
        };
      });
    }

    return reorderPoints.map((rp: any) => ({
      id: rp.id,
      productId: rp.productId,
      locationId: rp.locationId,
      product: rp.product,
      minQuantity: rp.minQuantity,
      maxQuantity: rp.maxQuantity,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
    }));
  }

  async getById(tenantId: string, id: string) {
    const rp = await (tenantDb as any).reorderPoint.findFirst({
      where: { id, tenantId },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    if (!rp) return null;

    return {
      id: rp.id,
      productId: rp.productId,
      locationId: rp.locationId,
      product: rp.product,
      minQuantity: rp.minQuantity,
      maxQuantity: rp.maxQuantity,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
    };
  }

  async create(tenantId: string, input: CreateReorderPointInput) {
    const product = await (tenantDb as any).product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    const location = await (tenantDb as any).location.findFirst({
      where: { id: input.locationId, tenantId },
    });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    const existing = await (tenantDb as any).reorderPoint.findUnique({
      where: {
        productId_locationId: {
          productId: input.productId,
          locationId: input.locationId,
        },
      },
    });
    if (existing) throw new Error('REORDER_POINT_EXISTS');

    const rp = await (tenantDb as any).reorderPoint.create({
      data: {
        tenantId,
        productId: input.productId,
        locationId: input.locationId,
        minQuantity: input.minQuantity,
        maxQuantity: input.maxQuantity,
      },
    });

    logger.info(`Reorder point created: ${rp.id}`);

    return {
      id: rp.id,
      productId: rp.productId,
      locationId: rp.locationId,
      minQuantity: rp.minQuantity,
      maxQuantity: rp.maxQuantity,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
    };
  }

  async update(tenantId: string, id: string, input: UpdateReorderPointInput) {
    const existing = await (tenantDb as any).reorderPoint.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('REORDER_POINT_NOT_FOUND');

    const minQty = input.minQuantity ?? existing.minQuantity;
    const maxQty = input.maxQuantity ?? existing.maxQuantity;

    const rp = await (tenantDb as any).reorderPoint.update({
      where: { id },
      data: {
        minQuantity: minQty,
        maxQuantity: maxQty,
      },
    });

    logger.info(`Reorder point updated: ${rp.id}`);

    return {
      id: rp.id,
      productId: rp.productId,
      locationId: rp.locationId,
      minQuantity: rp.minQuantity,
      maxQuantity: rp.maxQuantity,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
    };
  }

  async delete(tenantId: string, id: string) {
    const existing = await (tenantDb as any).reorderPoint.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('REORDER_POINT_NOT_FOUND');

    await (tenantDb as any).reorderPoint.delete({ where: { id } });
    logger.info(`Reorder point deleted: ${id}`);
  }
}

export const reorderPointService = new ReorderPointService();
