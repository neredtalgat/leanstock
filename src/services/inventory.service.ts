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
            basePrice: true,
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

    // Calculate available quantity and filter low stock if needed
    const result = inventory.map((inv: any) => ({
      id: inv.id,
      productId: inv.productId,
      locationId: inv.locationId,
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.quantity - inv.reservedQuantity,
      minStockLevel: inv.minStockLevel,
      maxStockLevel: inv.maxStockLevel,
      daysInInventory: inv.daysInInventory,
      lastMovedAt: inv.lastMovedAt,
      product: inv.product,
      location: inv.location,
      isLowStock: inv.minStockLevel && inv.quantity < inv.minStockLevel,
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
        type: delta >= 0 ? 'ADJUSTMENT' : 'ADJUSTMENT',
        quantity: Math.abs(delta),
        reason: input.reason,
        userId,
        metadata: {
          oldQuantity,
          newQuantity,
          delta,
        },
      },
    });

    // Create audit log
    await (tenantDb as any).auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'INVENTORY_ADJUST',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldValues: { quantity: oldQuantity },
        newValues: { quantity: newQuantity, reason: input.reason },
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
}

export const inventoryService = new InventoryService();
