import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

export class TenantIsolationHelper {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/leanstock_test'
        }
      }
    });
  }

  async createTestTenants(): Promise<{ tenantA: string; tenantB: string }> {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    await this.prisma.tenant.createMany({
      data: [
        {
          id: tenantA,
          name: 'Tenant A Test Company',
          isActive: true
        },
        {
          id: tenantB,
          name: 'Tenant B Test Company',
          isActive: true
        }
      ]
    });

    return { tenantA, tenantB };
  }

  async createTestUsers(tenantA: string, tenantB: string) {
    const hashedPassword = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO9u'; // 'password123'

    const userA = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: tenantA,
        email: 'userA@tenantA.com',
        passwordHash: hashedPassword,
        firstName: 'User',
        lastName: 'A',
        role: 'STORE_MANAGER',
        isActive: true,
        emailVerified: true
      }
    });

    const userB = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: tenantB,
        email: 'userB@tenantB.com',
        passwordHash: hashedPassword,
        firstName: 'User',
        lastName: 'B',
        role: 'STORE_MANAGER',
        isActive: true,
        emailVerified: true
      }
    });

    return { userA, userB };
  }

  async createTestLocations(tenantA: string, tenantB: string) {
    const locationA = await this.prisma.location.create({
      data: {
        id: randomUUID(),
        tenantId: tenantA,
        name: 'Tenant A Warehouse',
        type: 'WAREHOUSE',
        address: '123 Tenant A St'
      }
    });

    const locationB = await this.prisma.location.create({
      data: {
        id: randomUUID(),
        tenantId: tenantB,
        name: 'Tenant B Warehouse',
        type: 'WAREHOUSE',
        address: '456 Tenant B St'
      }
    });

    return { locationA, locationB };
  }

  async createTestProducts(tenantA: string, tenantB: string) {
    const productA = await this.prisma.product.create({
      data: {
        id: randomUUID(),
        tenantId: tenantA,
        sku: 'TENANT-A-001',
        name: 'Product A',
        description: 'Product for Tenant A',
        baseCost: 100,
        retailPrice: 150
      }
    });

    const productB = await this.prisma.product.create({
      data: {
        id: randomUUID(),
        tenantId: tenantB,
        sku: 'TENANT-B-001',
        name: 'Product B',
        description: 'Product for Tenant B',
        baseCost: 200,
        retailPrice: 300
      }
    });

    return { productA, productB };
  }

  async createTestInventory(
    tenantA: string, tenantB: string,
    productA: any, productB: any,
    locationA: any, locationB: any
  ) {
    await this.prisma.inventory.createMany({
      data: [
        {
          id: randomUUID(),
          tenantId: tenantA,
          productId: productA.id,
          locationId: locationA.id,
          quantity: 100,
          reservedQuantity: 10,
          inTransit: 5
        },
        {
          id: randomUUID(),
          tenantId: tenantB,
          productId: productB.id,
          locationId: locationB.id,
          quantity: 200,
          reservedQuantity: 20,
          inTransit: 10
        }
      ]
    });
  }

  async cleanupTestData(tenantA: string, tenantB: string) {
    // Clean up in reverse order of dependencies
    await this.prisma.inventory.deleteMany({
      where: {
        OR: [
          { tenantId: tenantA },
          { tenantId: tenantB }
        ]
      }
    });

    await this.prisma.product.deleteMany({
      where: {
        OR: [
          { tenantId: tenantA },
          { tenantId: tenantB }
        ]
      }
    });

    await this.prisma.location.deleteMany({
      where: {
        OR: [
          { tenantId: tenantA },
          { tenantId: tenantB }
        ]
      }
    });

    await this.prisma.user.deleteMany({
      where: {
        OR: [
          { tenantId: tenantA },
          { tenantId: tenantB }
        ]
      }
    });

    await this.prisma.tenant.deleteMany({
      where: {
        OR: [
          { id: tenantA },
          { id: tenantB }
        ]
      }
    });
  }

  async verifyTenantIsolation(tenantId: string, resource: string, resourceId: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${resource} WHERE id = $1 AND tenantId = $2`,
        [resourceId, tenantId]
      );
      
      return (result as any)[0].count > 0;
    } catch (error) {
      console.error(`Error verifying tenant isolation for ${resource}:`, error);
      return false;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
