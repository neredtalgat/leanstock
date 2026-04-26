import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { authService } from '../../src/services/auth.service';
import { cleanupTestData, createTestTenant, createTestUser, createTestLocation, createTestProduct } from '../setup';

describe('Product API Integration Tests', () => {
  let tenantId: string;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    const user = await createTestUser(tenantId, 'integration@example.com');
    userId = user.id;

    const tokens = await authService.login('integration@example.com', 'Password123!', tenantId);
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('POST /products', () => {
    it('should create a product', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .send({
          name: 'Test Product',
          sku: `SKU-${Date.now()}`,
          price: 99.99,
          costPrice: 50.00,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('Test Product');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/products')
        .send({
          name: 'Test Product',
          sku: `SKU-${Date.now()}`,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /products', () => {
    it('should list products', async () => {
      await createTestProduct(tenantId);

      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
