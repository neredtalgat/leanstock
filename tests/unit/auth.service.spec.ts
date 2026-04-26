import { prisma } from '../../src/config/database';
import { authService } from '../../src/services/auth.service';
import { cleanupTestData, createTestTenant, createTestUser } from '../setup';

describe('Auth Service', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const user = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        tenantId,
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('STORE_ASSOCIATE');
    });

    it('should fail on duplicate email', async () => {
      await authService.register({
        email: 'duplicate@example.com',
        password: 'Password123!',
        tenantId,
      });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'Password123!',
          tenantId,
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'Password123!',
        tenantId,
      });

      const tokens = await authService.login('login@example.com', 'Password123!', tenantId);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('should fail on wrong password', async () => {
      await authService.register({
        email: 'wrongpass@example.com',
        password: 'Password123!',
        tenantId,
      });

      await expect(
        authService.login('wrongpass@example.com', 'WrongPassword123!', tenantId)
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      await authService.register({
        email: 'refresh@example.com',
        password: 'Password123!',
        tenantId,
      });

      const { refreshToken } = await authService.login('refresh@example.com', 'Password123!', tenantId);

      const newTokens = await authService.refresh(refreshToken);

      expect(newTokens).toBeDefined();
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
    });
  });
});
