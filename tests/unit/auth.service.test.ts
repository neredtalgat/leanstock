import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authService } from '../../src/services/auth.service';
import { tenantDb } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/config/redis');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.STORE_ASSOCIATE,
    tenantId: mockTenantId,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user with valid credentials', async () => {
      const registerData = {
        email: 'new@example.com',
        password: 'SecurePass123',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.STORE_ASSOCIATE,
      };

      (tenantDb.user.findFirst as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (tenantDb.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
      });

      const result = await authService.register(registerData, mockTenantId);

      expect(result.email).toBe(registerData.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerData.password, 12);
      expect(tenantDb.user.create).toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePass123',
        role: UserRole.STORE_ASSOCIATE,
      };

      (tenantDb.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(authService.register(registerData, mockTenantId)).rejects.toThrow('EMAIL_EXISTS');
    });
  });

  describe('login', () => {
    it('should generate token pair for valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'correctpassword',
        tenantId: mockTenantId,
      };

      (tenantDb.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (tenantDb.user.update as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('mocktoken');

      const result = await authService.login(loginData);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
        tenantId: mockTenantId,
      };

      (tenantDb.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('refresh', () => {
    it('should generate new token pair', async () => {
      const refreshToken = 'validrefreshtoken';
      const decodedPayload = {
        userId: mockUser.id,
        tenantId: mockTenantId,
        email: mockUser.email,
        role: mockUser.role,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);
      (redis.exists as jest.Mock).mockResolvedValue(0);
      (tenantDb.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('newmocktoken');
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      const result = await authService.refresh(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should reject blacklisted tokens', async () => {
      const refreshToken = 'blacklistedtoken';
      const decodedPayload = {
        userId: mockUser.id,
        tenantId: mockTenantId,
        email: mockUser.email,
        role: mockUser.role,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);
      (redis.exists as jest.Mock).mockResolvedValue(1);

      await expect(authService.refresh(refreshToken)).rejects.toThrow('TOKEN_REVOKED');
    });
  });

  describe('logout', () => {
    it('should blacklist refresh token', async () => {
      const refreshToken = 'validtoken';
      const decodedPayload = {
        userId: mockUser.id,
        tenantId: mockTenantId,
        email: mockUser.email,
        role: mockUser.role,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedPayload);
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      await authService.logout(refreshToken);

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('refreshtoken:blacklist:'),
        expect.any(Number),
        '1',
      );
    });
  });
});
