import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface ListInventoryFilters {
  productId?: string;
  locationId?: string;
  lowStock?: boolean;
}

export interface AdjustInventoryInput {
  productId: string;
  locationId: string;
  newQuantity: number;
  reason: string;
}

export interface CreateInventoryInput {
  productId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  inTransit: number;
}

export interface UpdateInventoryInput {
  quantity?: number;
  reservedQuantity?: number;
  inTransit?: number;
}

class InventoryService {
  async list(tenantId: string, filters: ListInventoryFilters) {
    const where: any = { tenantId };

    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    const inventory = await (tenantDb as any).inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            baseCost: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const reorderPoints = await (tenantDb as any).reorderPoint.findMany({
      where: { tenantId },
      select: {
        productId: true,
        locationId: true,
        minQuantity: true,
        maxQuantity: true,
      },
    });

    const reorderPointMap = new Map<string, { minQuantity: number; maxQuantity: number }>();
    for (const rp of reorderPoints) {
      reorderPointMap.set(`${rp.productId}:${rp.locationId}`, {
        minQuantity: rp.minQuantity,
        maxQuantity: rp.maxQuantity,
      });
    }

    // Calculate available quantity and low stock if needed
    const result = inventory.map((inv: any) => ({
      ...(reorderPointMap.get(`${inv.productId}:${inv.locationId}`) || {}),
      id: inv.id,
      productId: inv.productId,
      locationId: inv.locationId,
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.quantity - inv.reservedQuantity,
      daysInInventory: inv.daysInInventory,
      lastMovedAt: inv.lastMovedAt,
      product: inv.product,
      location: inv.location,
      isLowStock: (() => {
        const rp = reorderPointMap.get(`${inv.productId}:${inv.locationId}`);
        return rp ? inv.quantity < rp.minQuantity : false;
      })(),
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }));

    if (filters.lowStock) {
      return result.filter((item: any) => item.isLowStock);
    }

    return result;
  }

  async adjust(tenantId: string, userId: string, input: AdjustInventoryInput) {
    const inventory = await (tenantDb as any).inventory.findFirst({
      where: {
        tenantId,
        productId: input.productId,
        locationId: input.locationId,
      },
    });

    if (!inventory) {
      throw new Error('INVENTORY_NOT_FOUND');
    }

    const oldQuantity = inventory.quantity;
    const newQuantity = input.newQuantity;
    const delta = newQuantity - oldQuantity;

    // Update inventory
    const updated = await (tenantDb as any).inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: newQuantity,
        lastMovedAt: new Date(),
        daysInInventory: oldQuantity === 0 ? 0 : inventory.daysInInventory,
      },
    });

    // Create inventory movement record
    await (tenantDb as any).inventoryMovement.create({
      data: {
        tenantId,
        inventoryId: inventory.id,
        type: 'ADJUSTMENT',
        quantity: Math.abs(delta),
        notes: input.reason,
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'INVENTORY_ADJUST',
        resource: 'Inventory',
        resourceId: inventory.id,
        changes: JSON.stringify({
          oldQuantity,
          newQuantity,
          delta,
          reason: input.reason,
        }),
      },
    });

    logger.info(`Inventory adjusted: ${inventory.id}, ${oldQuantity} -> ${newQuantity}`);

    return {
      id: updated.id,
      quantity: updated.quantity,
      oldQuantity,
      delta,
      productId: input.productId,
      locationId: input.locationId,
    };
  }

  async getById(tenantId: string, id: string) {
    return (tenantDb as any).inventory.findFirst({
      where: { id, tenantId },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async create(tenantId: string, input: CreateInventoryInput) {
    const product = await (tenantDb as any).product.findFirst({
      where: { id: input.productId, tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const location = await (tenantDb as any).location.findFirst({
      where: { id: input.locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    const created = await (tenantDb as any).inventory.create({
      data: {
        tenantId,
        productId: input.productId,
        locationId: input.locationId,
        quantity: input.quantity,
        reservedQuantity: input.reservedQuantity,
        inTransit: input.inTransit,
      },
    });
    return created;
  }

  async update(tenantId: string, id: string, input: UpdateInventoryInput) {
    const existing = await (tenantDb as any).inventory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('INVENTORY_NOT_FOUND');
    }

    return (tenantDb as any).inventory.update({
      where: { id: existing.id },
      data: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.reservedQuantity !== undefined ? { reservedQuantity: input.reservedQuantity } : {}),
        ...(input.inTransit !== undefined ? { inTransit: input.inTransit } : {}),
        lastMovedAt: new Date(),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const existing = await (tenantDb as any).inventory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('INVENTORY_NOT_FOUND');
    }

    await (tenantDb as any).inventory.delete({
      where: { id: existing.id },
    });
  }
}

export const inventoryService = new InventoryService();
