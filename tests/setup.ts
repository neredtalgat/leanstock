import { Tenant, User, Product, Location } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import { prisma } from '../src/config/database';

export const createTestTenant = async (): Promise<Tenant> => {
  return prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      email: `test-${Date.now()}@example.com`,
    },
  });
};

export const createTestUser = async (
  tenantId: string,
  email?: string
): Promise<User> => {
  const passwordHash = await bcryptjs.hash('Password123!', 10);
  return prisma.user.create({
    data: {
      email: email || `user-${Date.now()}@example.com`,
      passwordHash,
      role: 'TENANT_ADMIN',
      tenantId,
    },
  });
};

export const createTestLocation = async (
  tenantId: string,
  name?: string
): Promise<Location> => {
  return prisma.location.create({
    data: {
      name: name || `Location-${Date.now()}`,
      tenantId,
      type: 'WAREHOUSE',
    },
  });
};

export const createTestProduct = async (
  tenantId: string,
  sku?: string
): Promise<Product> => {
  return prisma.product.create({
    data: {
      name: `Product-${Date.now()}`,
      sku: sku || `SKU-${Date.now()}`,
      tenantId,
      price: 99.99,
    },
  });
};

export async function cleanupTestData() {
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.demandHistory.deleteMany({});
  await prisma.deadStockRule.deleteMany({});
  await prisma.reorderPoint.deleteMany({});
  await prisma.inventoryMovement.deleteMany({});
  await prisma.transferItem.deleteMany({});
  await prisma.transferOrder.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.supplierProduct.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.binLocation.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});
}
