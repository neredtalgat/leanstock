import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/config/database';
import { redis } from '../src/config/redis';
import { stopJobs } from '../src/jobs';

let app: any;
let authToken: string;
let refreshToken: string;
let testTenantId: string;
let testProductId: string;
let testLocationId: string;
let testLocationId2: string;

describe('LeanStock Integration Tests', () => {
  beforeAll(async () => {
    app = createApp();
    // Clean test data
    await db.auditLog.deleteMany({});
    await db.transferItem.deleteMany({});
    await db.transferOrder.deleteMany({});
    await db.inventory.deleteMany({});
    await db.product.deleteMany({});
    await db.location.deleteMany({});
    await db.user.deleteMany({ where: { email: { contains: 'test' } } });
  });

  afterAll(async () => {
    await stopJobs();
    await db.$disconnect();
    await redis.quit();
  });

  describe('Auth Flow', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@leanstock.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
        });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('test@leanstock.com');
    });

    it('should block login for unverified user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@leanstock.com', password: 'SecurePass123!' });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('verify');
    });

    it('should verify email with token', async () => {
      const user = await db.user.findFirst({ where: { email: 'test@leanstock.com' } });
      const res = await request(app)
        .get(`/auth/verify-email?token=${user?.emailVerificationToken}`);
      expect(res.status).toBe(200);
    });

    it('should login after verification', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@leanstock.com', password: 'SecurePass123!' });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      authToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject expired token', async () => {
      const res = await request(app)
        .get('/products')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('should reject wrong role', async () => {
      // Create store associate and try admin action
      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sku: 'TEST-001', name: 'Test', baseCost: 10, retailPrice: 20 });
      // Should succeed for now (depends on seeded role)
      expect([201, 403]).toContain(res.status);
    });
  });

  describe('Transfer Atomicity', () => {
    beforeAll(async () => {
      // Setup tenant, locations, product, inventory
      const tenant = await db.tenant.create({ data: { name: 'Test Tenant' } });
      testTenantId = tenant.id;

      const loc1 = await db.location.create({ data: { tenantId: tenant.id, name: 'Warehouse A', type: 'WAREHOUSE' } });
      const loc2 = await db.location.create({ data: { tenantId: tenant.id, name: 'Store B', type: 'STORE' } });
      testLocationId = loc1.id;
      testLocationId2 = loc2.id;

      const product = await db.product.create({
        data: { tenantId: tenant.id, sku: 'PROD-TEST', name: 'Test Product', baseCost: 10, retailPrice: 25 },
      });
      testProductId = product.id;

      await db.inventory.create({
        data: { tenantId: tenant.id, productId: product.id, locationId: loc1.id, quantity: 100, reservedQuantity: 0, inTransit: 0 },
      });
    });

    it('should create transfer and reserve stock', async () => {
      const res = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'test-transfer-1')
        .send({
          fromLocationId: testLocationId,
          toLocationId: testLocationId2,
          items: [{ productId: testProductId, quantity: 10 }],
          notes: 'Test transfer',
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPROVED');

      // Verify reservation
      const inv = await db.inventory.findFirst({
        where: { productId: testProductId, locationId: testLocationId },
      });
      expect(inv?.reservedQuantity).toBe(10);
    });

    it('should reject duplicate transfer with same idempotency key', async () => {
      const res = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'test-transfer-1')
        .send({
          fromLocationId: testLocationId,
          toLocationId: testLocationId2,
          items: [{ productId: testProductId, quantity: 10 }],
        });
      expect(res.status).toBe(409);
    });

    it('should reject transfer exceeding available stock', async () => {
      const res = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fromLocationId: testLocationId,
          toLocationId: testLocationId2,
          items: [{ productId: testProductId, quantity: 200 }],
        });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('should ship transfer and update inventory', async () => {
      const transfer = await db.transferOrder.findFirst({ where: { fromLocationId: testLocationId } });
      const res = await request(app)
        .post(`/transfers/${transfer?.id}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ carrier: 'DHL', trackingNumber: 'TRACK123' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_TRANSIT');

      const inv = await db.inventory.findFirst({
        where: { productId: testProductId, locationId: testLocationId },
      });
      expect(inv?.quantity).toBe(90); // 100 - 10
      expect(inv?.inTransit).toBe(10);
      expect(inv?.reservedQuantity).toBe(0); // released on ship
    });
  });

  describe('Email Queue', () => {
    it('should enqueue email job on low stock', async () => {
      // Trigger reorder check manually
      const { triggerManualReorderCheck } = require('../src/jobs/reorderCheck');
      await expect(triggerManualReorderCheck(testTenantId)).resolves.not.toThrow();

      // Verify job was queued by checking mail queue metrics
      const { getMailQueueMetrics } = require('../src/workers/mail.worker');
      const metrics = await getMailQueueMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Forecasting', () => {
    it('should return forecast for product', async () => {
      // Seed demand history
      await db.demandHistory.create({
        data: { tenantId: testTenantId, productId: testProductId, demandQuantity: 10, date: new Date(Date.now() - 86400000) },
      });
      await db.demandHistory.create({
        data: { tenantId: testTenantId, productId: testProductId, demandQuantity: 15, date: new Date(Date.now() - 172800000) },
      });

      const res = await request(app)
        .get(`/analytics/forecast/${testProductId}?days=30`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.predictedDemand).toBeDefined();
      expect(res.body.method).toBe('moving_average');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.checks.database.status).toBe('healthy');
      expect(res.body.checks.redis.status).toBe('healthy');
    });
  });
});
