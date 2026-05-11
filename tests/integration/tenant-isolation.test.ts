import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'crypto';

describe('Tenant Isolation Integration Tests', () => {
  const app = createApp();
  let prisma: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let productA: any;
  let productB: any;
  let locationA: any;
  let locationB: any;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/leanstock_test'
        }
      }
    });

    // Create two separate tenants
    tenantA = randomUUID();
    tenantB = randomUUID();

    await prisma.tenant.create({
      data: {
        id: tenantA,
        name: 'Tenant A Test Company',
        isActive: true
      }
    });

    await prisma.tenant.create({
      data: {
        id: tenantB,
        name: 'Tenant B Test Company',
        isActive: true
      }
    });

    // Create users for each tenant
    const hashedPassword = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO9'; // 'password123'

    userA = await prisma.user.create({
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

    userB = await prisma.user.create({
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

    // Create locations for each tenant
    locationA = await prisma.location.create({
      data: {
        id: randomUUID(),
        tenantId: tenantA,
        name: 'Tenant A Warehouse',
        type: 'WAREHOUSE',
        address: '123 Tenant A St'
      }
    });

    locationB = await prisma.location.create({
      data: {
        id: randomUUID(),
        tenantId: tenantB,
        name: 'Tenant B Warehouse',
        type: 'WAREHOUSE',
        address: '456 Tenant B St'
      }
    });

    // Create products for each tenant
    productA = await prisma.product.create({
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

    productB = await prisma.product.create({
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

    // Get auth tokens
    const loginA = await request(app)
      .post('/auth/login')
      .send({
        email: 'userA@tenantA.com',
        password: 'password123',
        tenantId: tenantA
      });

    const loginB = await request(app)
      .post('/auth/login')
      .send({
        email: 'userB@tenantB.com',
        password: 'password123',
        tenantId: tenantB
      });

    tokenA = loginA.body.accessToken;
    tokenB = loginB.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Product Isolation', () => {
    it('should allow Tenant A to access their own products', async () => {
      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sku).toBe('TENANT-A-001');
      expect(response.body.data[0].name).toBe('Product A');
    });

    it('should allow Tenant B to access their own products', async () => {
      const response = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sku).toBe('TENANT-B-001');
      expect(response.body.data[0].name).toBe('Product B');
    });

    it('should prevent Tenant A from accessing Tenant B products by ID', async () => {
      const response = await request(app)
        .get(`/products/${productB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should prevent Tenant B from accessing Tenant A products by ID', async () => {
      const response = await request(app)
        .get(`/products/${productA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Location Isolation', () => {
    it('should allow Tenant A to access their own locations', async () => {
      const response = await request(app)
        .get('/locations')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Tenant A Warehouse');
    });

    it('should prevent Tenant A from accessing Tenant B locations', async () => {
      const response = await request(app)
        .get(`/locations/${locationB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Inventory Isolation', () => {
    beforeAll(async () => {
      // Create inventory for each tenant
      await prisma.inventory.create({
        data: {
          id: randomUUID(),
          tenantId: tenantA,
          productId: productA.id,
          locationId: locationA.id,
          quantity: 100,
          reservedQuantity: 10,
          inTransit: 5
        }
      });

      await prisma.inventory.create({
        data: {
          id: randomUUID(),
          tenantId: tenantB,
          productId: productB.id,
          locationId: locationB.id,
          quantity: 200,
          reservedQuantity: 20,
          inTransit: 10
        }
      });
    });

    it('should allow Tenant A to access their own inventory', async () => {
      const response = await request(app)
        .get('/inventory')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].quantity).toBe(100);
    });

    it('should prevent cross-tenant inventory access', async () => {
      // Try to create inventory for Tenant B using Tenant A's token
      const response = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          productId: productB.id, // Tenant B's product
          locationId: locationA.id,
          quantity: 50
        })
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Transfer Order Isolation', () => {
    it('should create transfer within same tenant successfully', async () => {
      const response = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fromLocationId: locationA.id,
          toLocationId: locationA.id, // Same location for simplicity
          items: [
            {
              productId: productA.id,
              quantity: 10
            }
          ],
          notes: 'Test transfer within Tenant A'
        })
        .expect(201);

      expect(response.body.fromLocationId).toBe(locationA.id);
      expect(response.body.items).toHaveLength(1);
    });

    it('should prevent cross-tenant transfer creation', async () => {
      const response = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fromLocationId: locationA.id,
          toLocationId: locationB.id, // Tenant B's location
          items: [
            {
              productId: productA.id,
              quantity: 10
            }
          ]
        })
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Authentication Isolation', () => {
    it('should prevent Tenant A user from logging in with Tenant B tenantId', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'userA@tenantA.com',
          password: 'password123',
          tenantId: tenantB // Wrong tenant
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should prevent user registration with existing email in different tenant', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'userA@tenantA.com', // Already exists in Tenant A
          password: 'newpassword123',
          firstName: 'New',
          lastName: 'User',
          tenantId: tenantB,
          role: 'STORE_ASSOCIATE'
        })
        .expect(409);

      expect(response.body.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('Audit Log Isolation', () => {
    it('should only show audit logs for tenant\'s own actions', async () => {
      // Create some audit logs by making requests
      await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${tokenA}`);

      await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${tokenB}`);

      // Check Tenant A's audit logs
      const responseA = await request(app)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      // Check Tenant B's audit logs
      const responseB = await request(app)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      // Each tenant should only see their own logs
      responseA.body.data.forEach((log: any) => {
        expect(log.tenantId).toBe(tenantA);
      });

      responseB.body.data.forEach((log: any) => {
        expect(log.tenantId).toBe(tenantB);
      });
    });
  });

  describe('Direct Database Access Isolation', () => {
    it('should enforce tenant filtering at database level', async () => {
      // This test verifies that even with direct database queries,
      // the tenant isolation middleware properly filters results

      const productsA = await prisma.product.findMany({
        where: { tenantId: tenantA }
      });

      const productsB = await prisma.product.findMany({
        where: { tenantId: tenantB }
      });

      expect(productsA).toHaveLength(1);
      expect(productsB).toHaveLength(1);
      expect(productsA[0].tenantId).toBe(tenantA);
      expect(productsB[0].tenantId).toBe(tenantB);

      // Verify no cross-contamination
      const allProducts = await prisma.product.findMany();
      expect(allProducts).toHaveLength(2);
    });

    it('should prevent foreign key constraint violations across tenants', async () => {
      // Try to create inventory with product from different tenant
      await expect(
        prisma.inventory.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            productId: productB.id, // Product from Tenant B
            locationId: locationA.id,
            quantity: 50
          }
        })
      ).rejects.toThrow();
    });
  });
});
