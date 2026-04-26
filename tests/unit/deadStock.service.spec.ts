import { deadStockService } from '../../src/services/deadStock.service';
import { prisma } from '../../src/config/database';

describe('DeadStockService', () => {
  let tenantId: string;
  let productId: string;
  let locationId: string;

  beforeAll(async () => {
    // Create test data
    const tenant = await prisma.tenant.create({
      data: { name: 'Dead Stock Test Tenant' },
    });
    tenantId = tenant.id;

    const location = await prisma.location.create({
      data: {
        tenantId,
        name: 'Test Location',
        address: '123 Main St',
      },
    });
    locationId = location.id;

    const product = await prisma.product.create({
      data: {
        tenantId,
        name: 'Dead Stock Product',
        sku: 'DS-001',
        category: 'Test',
        retailPrice: 100,
        costPrice: 50,
        unit: 'pcs',
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.priceHistory.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.inventory.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.location.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  describe('applyDiscounts', () => {
    it('should apply 10% discount for 30-60 days old inventory', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId,
          locationId,
          available: 10,
          lastMovementDate: thirtyDaysAgo,
        },
      });

      const updated = await deadStockService.applyDiscounts(tenantId);

      expect(updated).toBeGreaterThan(0);

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      // 10% discount: 100 * (1 - 0.1) = 90
      expect(product!.retailPrice).toBeLessThan(100);
      expect(product!.retailPrice).toBeGreaterThanOrEqual(50 * 1.1); // Cost floor: 55
    });

    it('should apply 20% discount for 61-90 days old', async () => {
      const product2 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Product 61 Days',
          sku: 'DS-061',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const sixtyFiveDaysAgo = new Date();
      sixtyFiveDaysAgo.setDate(sixtyFiveDaysAgo.getDate() - 65);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product2.id,
          locationId,
          available: 10,
          lastMovementDate: sixtyFiveDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const updated = await prisma.product.findUnique({
        where: { id: product2.id },
      });

      // 20% discount: 100 * (1 - 0.2) = 80
      expect(updated!.retailPrice).toBeCloseTo(80, 0);
    });

    it('should apply 30% discount for 91-180 days old', async () => {
      const product3 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Product 100 Days',
          sku: 'DS-100',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product3.id,
          locationId,
          available: 10,
          lastMovementDate: hundredDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const updated = await prisma.product.findUnique({
        where: { id: product3.id },
      });

      // 30% discount: 100 * (1 - 0.3) = 70
      expect(updated!.retailPrice).toBeCloseTo(70, 0);
    });

    it('should apply 40% discount for 180+ days old', async () => {
      const product4 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Product 200 Days',
          sku: 'DS-200',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const twoHundredDaysAgo = new Date();
      twoHundredDaysAgo.setDate(twoHundredDaysAgo.getDate() - 200);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product4.id,
          locationId,
          available: 10,
          lastMovementDate: twoHundredDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const updated = await prisma.product.findUnique({
        where: { id: product4.id },
      });

      // 40% discount: 100 * (1 - 0.4) = 60
      expect(updated!.retailPrice).toBeCloseTo(60, 0);
    });

    it('should respect cost + 10% floor', async () => {
      const product5 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Product Floor Test',
          sku: 'DS-FLOOR',
          category: 'Test',
          retailPrice: 60, // Only 20% above cost (50 * 1.2 = 60)
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const twoHundredDaysAgo = new Date();
      twoHundredDaysAgo.setDate(twoHundredDaysAgo.getDate() - 200);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product5.id,
          locationId,
          available: 10,
          lastMovementDate: twoHundredDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const updated = await prisma.product.findUnique({
        where: { id: product5.id },
      });

      // Would be 60 * 0.6 = 36, but floor is 50 * 1.1 = 55
      expect(updated!.retailPrice).toBe(55);
    });

    it('should create price history entry', async () => {
      const product6 = await prisma.product.create({
        data: {
          tenantId,
          name: 'History Test',
          sku: 'DS-HIST',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const thirtyfiveDaysAgo = new Date();
      thirtyfiveDaysAgo.setDate(thirtyfiveDaysAgo.getDate() - 35);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product6.id,
          locationId,
          available: 10,
          lastMovementDate: thirtyfiveDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const history = await prisma.priceHistory.findFirst({
        where: {
          tenantId,
          productId: product6.id,
        },
      });

      expect(history).toBeDefined();
      expect(history!.oldPrice).toBe(100);
      expect(history!.reason).toContain('Dead stock discount');
    });

    it('should create notifications for managers', async () => {
      const product7 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Notification Test',
          sku: 'DS-NOTIF',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      // Create a manager user
      await prisma.user.create({
        data: {
          tenantId,
          email: 'manager@test.com',
          password: 'hashed',
          firstName: 'Manager',
          lastName: 'User',
          role: 'TENANT_ADMIN',
        },
      });

      const thirtyfiveDaysAgo = new Date();
      thirtyfiveDaysAgo.setDate(thirtyfiveDaysAgo.getDate() - 35);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product7.id,
          locationId,
          available: 10,
          lastMovementDate: thirtyfiveDaysAgo,
        },
      });

      await deadStockService.applyDiscounts(tenantId);

      const notifications = await prisma.notification.findMany({
        where: {
          tenantId,
          resourceId: product7.id,
        },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('DEAD_STOCK_DISCOUNT');
    });

    it('should return count of updated products', async () => {
      const product8 = await prisma.product.create({
        data: {
          tenantId,
          name: 'Count Test',
          sku: 'DS-COUNT',
          category: 'Test',
          retailPrice: 100,
          costPrice: 50,
          unit: 'pcs',
        },
      });

      const thirtyfiveDaysAgo = new Date();
      thirtyfiveDaysAgo.setDate(thirtyfiveDaysAgo.getDate() - 35);

      await prisma.inventory.create({
        data: {
          tenantId,
          productId: product8.id,
          locationId,
          available: 10,
          lastMovementDate: thirtyfiveDaysAgo,
        },
      });

      const count = await deadStockService.applyDiscounts(tenantId);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processAllTenants', () => {
    it('should process all active tenants', async () => {
      const results = await deadStockService.processAllTenants();

      expect(results).toBeInstanceOf(Map);
      expect(results.has(tenantId)).toBe(true);
    });
  });
});
