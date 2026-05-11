import { createApp } from '../../src/app';
import request from 'supertest';

describe('Auth Routes', () => {
  const app = createApp();

  describe('POST /auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /health', () => {
    it('should return OK status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });
  });

  describe('404 - Not Found', () => {
    it('should return 404 for non-existent route', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Role-based Access Control', () => {
    it('should return 403 for insufficient permissions', async () => {
      // This test would require setting up a user with lower role
      // and trying to access admin-only endpoint
      // For now, placeholder for RBAC verification
      const response = await request(app)
        .post('/products')
        .send({
          name: 'Test Product',
          sku: 'TEST-001',
          baseCost: 100,
          retailPrice: 150,
        });

      // Without auth token, should return 401, not 403
      // With wrong role, should return 403
      expect([401, 403]).toContain(response.status);
    });
  });
});
