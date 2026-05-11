import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, tenantDb, asyncLocalStorage } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { TokenPair, JWTPayload } from '../types';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

export class AuthService {
  async register(data: RegisterInput, tenantId: string): Promise<any> {
    try {
      const tenant = await tenantDb.tenant.findFirst({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

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
      const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS as number);

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
      logger.error({ err: error }, 'Registration error');
      throw error;
    }
  }

  async login(data: LoginInput): Promise<TokenPair> {
    try {
      // Find user by email and tenant
      console.log('Login attempt:', { email: data.email, tenantId: data.tenantId });
      const user = await db.user.findFirst({
        where: {
          tenantId: data.tenantId,
          email: data.email,
        },
      });
      console.log('User found:', user ? { id: user.id, email: user.email, isActive: user.isActive } : null);

      if (!user || !user.isActive) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

      if (!isPasswordValid) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate token pair
      return this.generateTokenPair(user, data.tenantId);
    } catch (error: any) {
      logger.error({ err: error }, 'Login error');
      // Propagate known auth errors, but let operational errors bubble up
      // for proper monitoring and alerting (DB down, timeout, etc.)
      if (error.message === 'INVALID_CREDENTIALS') {
        throw error;
      }
      // Re-throw original error for DB issues, network errors, etc.
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
      logger.error({ err: error }, 'Logout error');
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
      logger.error({ err: error }, 'Refresh token error');
      throw error;
    }
  }

  private generateTokenPair(user: any, tenantId: string): TokenPair {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      tenantId,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    // @ts-expect-error jsonwebtoken's sign() has outdated TypeScript types that don't support JWTPayload interface
    // The library works correctly at runtime, but types expect a string payload instead of object
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'refresh',
    };

    // @ts-expect-error jsonwebtoken's sign() has outdated TypeScript types that don't support JWTPayload interface
    // The library works correctly at runtime, but types expect a string payload instead of object
    const refreshToken = jwt.sign(refreshPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  // TODO: Implement email verification
  async verifyEmail(token: string): Promise<void> {
    // Find user by verification token
    const user = await tenantDb.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      throw new Error('INVALID_TOKEN');
    }
    // Update user as verified
    await tenantDb.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });
  }

  // TODO: Implement password reset request
  async requestPasswordReset(email: string, tenantId: string): Promise<void> {
    const user = await tenantDb.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (!user) return; // Don't reveal if email exists
    // Generate reset token
    const token = Math.random().toString(36).substring(2, 15);
    await tenantDb.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: new Date(Date.now() + 3600000) },
    });
    // TODO: Send email with reset link
  }

  // TODO: Implement password reset
  async resetPassword(token: string, newPassword: string, tenantId: string): Promise<void> {
    const user = await tenantDb.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
        tenantId,
      },
    });
    if (!user) {
      throw new Error('INVALID_TOKEN');
    }
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await tenantDb.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  }

  // TODO: Implement change password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await tenantDb.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('INVALID_PASSWORD');
    }
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await tenantDb.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

export const authService = new AuthService();
