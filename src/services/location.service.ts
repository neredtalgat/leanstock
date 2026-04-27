import { tenantDb } from '../config/database';
import { logger } from '../config/logger';

export interface CreateLocationInput {
  name: string;
  address?: string;
  type: 'WAREHOUSE' | 'STORE' | 'DISTRIBUTION_CENTER';
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
      isActive: loc.isActive,
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
        isActive: true,
      },
    });

    logger.info(`Location created: ${location.id} for tenant ${tenantId}`);

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      type: location.type,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }
}

export const locationService = new LocationService();
