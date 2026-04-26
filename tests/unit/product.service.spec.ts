import { prisma } from '../../src/config/database';
import { authService } from '../../src/services/auth.service';
import { productService } from '../../src/services/product.service';
import { cleanupTestData, createTestTenant, createTestUser, createTestLocation, createTestProduct } from '../setup';

describe('Product Service', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const product = await productService.create(
        {
          name: 'Test Product',
          sku: `SKU-${Date.now()}`,
          price: 99.99,
          costPrice: 50.00,
        },
        tenantId
      );

      expect(product).toBeDefined();
      expect(product.name).toBe('Test Product');
    });

    it('should fail on duplicate SKU', async () => {
      const sku = `SKU-${Date.now()}`;

      await productService.create(
        {
          name: 'Product 1',
          sku,
          price: 99.99,
        },
        tenantId
      );

      await expect(
        productService.create(
          {
            name: 'Product 2',
            sku,
            price: 99.99,
          },
          tenantId
        )
      ).rejects.toThrow('SKU already exists');
    });
  });

  describe('list', () => {
    it('should list products', async () => {
      await productService.create(
        {
          name: 'Product A',
          sku: `SKU-A-${Date.now()}`,
        },
        tenantId
      );

      const result = await productService.list(tenantId);

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should search products', async () => {
      await productService.create(
        {
          name: 'Searchable Product',
          sku: `SEARCH-${Date.now()}`,
        },
        tenantId
      );

      const result = await productService.list(tenantId, undefined, 20, 'Searchable');

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].name).toContain('Searchable');
    });
  });
});
