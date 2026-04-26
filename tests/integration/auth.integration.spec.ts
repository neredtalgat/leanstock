import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { authService } from '../../src/services/auth.service';
import { cleanupTestData, createTestTenant } from '../setup';

describe('Auth API Integration Tests', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('POST /auth/register creates user', async () => {
    const response = await request(app).post('/auth/register').send({
      email: `register-${Date.now()}@example.com`,
      password: 'Password123!',
      firstName: 'Integration',
      lastName: 'User',
      role: 'TENANT_ADMIN',
      tenantId,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toContain('register-');
  });

  it('POST /auth/login returns 429 after 5 attempts', async () => {
    const email = `ratelimit-${Date.now()}@example.com`;
    await authService.register({
      email,
      password: 'Password123!',
      tenantId,
      role: 'TENANT_ADMIN',
    });

    for (let i = 0; i < 5; i++) {
      const response = await request(app).post('/auth/login').send({
        email,
        password: 'WrongPassword123!',
        tenantId,
      });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app).post('/auth/login').send({
      email,
      password: 'WrongPassword123!',
      tenantId,
    });

    expect(blocked.status).toBe(429);
  });

  it('GET /products without token returns 401', async () => {
    const response = await request(app).get('/products');

    expect(response.status).toBe(401);
  });

  it('POST /products with wrong role returns 403', async () => {
    const email = `supplier-${Date.now()}@example.com`;
    await authService.register({
      email,
      password: 'Password123!',
      tenantId,
      role: 'SUPPLIER',
    });
    const tokens = await authService.login(email, 'Password123!', tenantId);

    const response = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({
        name: 'Should Not Create',
        sku: `NOPE-${Date.now()}`,
        price: 10,
      });

    expect(response.status).toBe(403);
  });
});
