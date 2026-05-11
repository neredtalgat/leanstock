import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateLocationInput {
  name: string;
  address?: string;
  type: 'WAREHOUSE' | 'STORE' | 'DISTRIBUTION_CENTER';
}

export interface UpdateLocationInput {
  name?: string;
  address?: string;
  type?: 'WAREHOUSE' | 'STORE' | 'DISTRIBUTION_CENTER';
}

class LocationService {
  async list(tenantId: string) {
    const locations = await (tenantDb as any).location.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            inventory: true,
          },
        },
      },
    });

    return locations.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      type: loc.type,
      inventoryCount: loc._count.inventory,
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
    }));
  }

  async create(tenantId: string, input: CreateLocationInput) {
    const location = await (tenantDb as any).location.create({
      data: {
        tenantId,
        name: input.name,
        address: input.address,
        type: input.type,
      },
    });

    logger.info(`Location created: ${location.id} for tenant ${tenantId}`);

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      type: location.type,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }

  async getById(tenantId: string, id: string) {
    const location = await (tenantDb as any).location.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            inventory: true,
          },
        },
      },
    });

    if (!location) {
      return null;
    }

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      type: location.type,
      inventoryCount: location._count.inventory,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }

  async update(tenantId: string, id: string, input: UpdateLocationInput) {
    const existing = await (tenantDb as any).location.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    const updated = await (tenantDb as any).location.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      address: updated.address,
      type: updated.type,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(tenantId: string, id: string) {
    const existing = await (tenantDb as any).location.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    await (tenantDb as any).location.delete({
      where: { id: existing.id },
    });
  }
}

export const locationService = new LocationService();
