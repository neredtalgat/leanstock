import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Prisma, UserRole } from '@prisma/client';
import { tenantDb, asyncLocalStorage } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { TokenPair, JWTPayload } from '../types';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

export class AuthService {
  async register(data: RegisterInput, tenantId: string): Promise<User> {
    try {
      // Check email uniqueness within tenant
      const existingUser = await tenantDb.user.findFirst({
        where: {
          email: data.email,
          tenantId,
        },
      });

      if (existingUser) {
        throw new Error('EMAIL_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);

      // Create user
      return await asyncLocalStorage.run({ tenantId }, async () => {
        return tenantDb.user.create({
          data: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            tenantId,
            isActive: true,
          },
        });
      });
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(data: LoginInput): Promise<TokenPair> {
    try {
      // Find user by email and tenant
      const user = await tenantDb.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: data.tenantId,
            email: data.email,
          },
        },
      });

      if (!user || !user.isActive) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

      if (!isPasswordValid) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Update last login
      await tenantDb.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate token pair
      return this.generateTokenPair(user, data.tenantId);
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      // Verify and get token ID
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      // Blacklist refresh token
      const ttl = Math.ceil((decoded.exp! - Math.floor(Date.now() / 1000)) / 1);
      if (ttl > 0) {
        await redis.setex(`refreshtoken:blacklist:${refreshToken}`, ttl, '1');
      }
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('INVALID_TOKEN_TYPE');
      }

      // Check if token is blacklisted
      const isBlacklisted = await redis.exists(`refreshtoken:blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new Error('TOKEN_REVOKED');
      }

      // Get user
      const user = await tenantDb.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new Error('USER_NOT_FOUND');
      }

      // Blacklist old refresh token
      const ttl = Math.ceil((decoded.exp! - Math.floor(Date.now() / 1000)) / 1);
      if (ttl > 0) {
        await redis.setex(`refreshtoken:blacklist:${refreshToken}`, ttl, '1');
      }

      // Generate new token pair
      return this.generateTokenPair(user, decoded.tenantId);
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  private generateTokenPair(user: User, tenantId: string): TokenPair {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      tenantId,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });

    const refreshPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      algorithm: 'HS256',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }
}

export const authService = new AuthService();
