import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, tenantDb, asyncLocalStorage } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { TokenPair, JWTPayload } from '../types';
import { UserRole } from '@prisma/client';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { emailService } from './email.service';

export class AuthService {
  private canInviteRole(inviterRole: UserRole, targetRole: UserRole): boolean {
    if (targetRole === UserRole.SUPER_ADMIN) {
      return false;
    }

    const hierarchy: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.TENANT_ADMIN]: 90,
      [UserRole.REGIONAL_MANAGER]: 70,
      [UserRole.STORE_MANAGER]: 50,
      [UserRole.STORE_ASSOCIATE]: 30,
      [UserRole.SUPPLIER]: 10,
    };

    return hierarchy[targetRole] <= hierarchy[inviterRole];
  }
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

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = await asyncLocalStorage.run({ tenantId }, async () => {
        return tenantDb.user.create({
          data: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            tenantId,
            isActive: true,
            emailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
          },
        });
      });

      // Send verification email (async, non-blocking)
      emailService.sendVerificationEmail(
        user.email,
        user.firstName || 'User',
        verificationToken
      ).catch(err => {
        logger.error({ err, userId: user.id }, 'Failed to send verification email');
      });

      return user;
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

      // Check if email is verified
      if (!user.emailVerified) {
        throw new Error('EMAIL_NOT_VERIFIED');
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
      if (error.message === 'INVALID_CREDENTIALS' || error.message === 'EMAIL_NOT_VERIFIED') {
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

  async verifyEmail(token: string): Promise<void> {
    // Find user by verification token
    const user = await tenantDb.user.findFirst({
      where: { 
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new Error('INVALID_TOKEN');
    }
    
    // Update user as verified
    await tenantDb.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: true, 
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
    
    logger.info({ userId: user.id }, 'Email verified successfully');
  }

  async requestPasswordReset(email: string, tenantId: string): Promise<void> {
    const user = await tenantDb.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    
    if (!user) {
      // Don't reveal if email exists
      logger.info({ email, tenantId }, 'Password reset requested for non-existent user');
      return;
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await tenantDb.user.update({
      where: { id: user.id },
      data: { 
        passwordResetToken: resetToken, 
        passwordResetExpires: resetExpires,
      },
    });
    
    // Send password reset email (async, non-blocking)
    emailService.sendPasswordResetEmail(
      user.email,
      user.firstName || 'User',
      resetToken
    ).catch(err => {
      logger.error({ err, userId: user.id }, 'Failed to send password reset email');
    });
    
    logger.info({ userId: user.id }, 'Password reset email sent');
  }

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
    
    logger.info({ userId: user.id }, 'Password reset successfully');
  }

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
    
    logger.info({ userId }, 'Password changed successfully');
  }

  async resendVerificationEmail(email: string, tenantId: string): Promise<void> {
    const user = await tenantDb.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    
    if (!user || user.emailVerified) {
      // Don't reveal if email exists or already verified
      return;
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await tenantDb.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });
    
    // Send verification email
    emailService.sendVerificationEmail(
      user.email,
      user.firstName || 'User',
      verificationToken
    ).catch(err => {
      logger.error({ err, userId: user.id }, 'Failed to resend verification email');
    });
    
    logger.info({ userId: user.id }, 'Verification email resent');
  }

  async createInvitation(invitedBy: JWTPayload, email: string, role: UserRole): Promise<string> {
    const tenantId = invitedBy.tenantId;

    if (!this.canInviteRole(invitedBy.role, role)) {
      throw new Error('INVITE_ROLE_FORBIDDEN');
    }

    const tenant = await tenantDb.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    // Check if email already exists in tenant
    const existing = await tenantDb.user.findFirst({
      where: { email, tenantId },
      select: { id: true },
    });
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const payload = {
      email,
      role,
      tenantId,
      invitedBy: invitedBy.userId,
      type: 'invite' as const,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

    logger.info({ email, tenantId, invitedBy: invitedBy.userId }, 'Invitation created');
    return token;
  }

  async acceptInvitation(
    token: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ user: any; tokens: TokenPair }> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new Error('INVALID_INVITE_TOKEN');
    }

    if (decoded.type !== 'invite') {
      throw new Error('INVALID_INVITE_TOKEN');
    }

    const { email, role, tenantId } = decoded;

    const tenant = await tenantDb.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    const existing = await tenantDb.user.findFirst({
      where: { email, tenantId },
      select: { id: true },
    });
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS as number);

    const user = await asyncLocalStorage.run({ tenantId }, async () => {
      return tenantDb.user.create({
        data: {
          email,
          passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
          role,
          tenantId,
          emailVerified: true,
          isActive: true,
        },
      });
    });

    const tokens = this.generateTokenPair(user, tenantId);

    logger.info({ userId: user.id, email, tenantId }, 'User registered via invite');
    return { user, tokens };
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
}

export const authService = new AuthService();
