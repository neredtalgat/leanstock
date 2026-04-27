import { tenantDb } from '../config/database';

export interface ListMovementsFilters {
  inventoryId?: string;
  productId?: string;
  locationId?: string;
  type?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

class InventoryMovementService {
  async list(tenantId: string, filters: ListMovementsFilters) {
    const where: any = { tenantId };

    if (filters.inventoryId) where.inventoryId = filters.inventoryId;
    if (filters.type) where.type = filters.type;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const include: any = {
      inventory: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      },
    };

    // Filter by product/location through inventory relation
    if (filters.productId || filters.locationId) {
      where.inventory = {};
      if (filters.productId) where.inventory.productId = filters.productId;
      if (filters.locationId) where.inventory.locationId = filters.locationId;
    }

    const [movements, total] = await Promise.all([
      (tenantDb as any).inventoryMovement.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      (tenantDb as any).inventoryMovement.count({ where }),
    ]);

    return {
      data: movements.map((m: any) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        referenceId: m.referenceId,
        notes: m.notes,
        createdAt: m.createdAt,
        inventory: m.inventory ? {
          id: m.inventory.id,
          product: m.inventory.product,
          location: m.inventory.location,
        } : null,
      })),
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const movement = await (tenantDb as any).inventoryMovement.findFirst({
      where: { id, tenantId },
      include: {
        inventory: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!movement) return null;

    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      referenceId: movement.referenceId,
      notes: movement.notes,
      createdAt: movement.createdAt,
      inventory: movement.inventory ? {
        id: movement.inventory.id,
        product: movement.inventory.product,
        location: movement.inventory.location,
      } : null,
    };
  }
}

export const inventoryMovementService = new InventoryMovementService();
