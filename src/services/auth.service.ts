import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbClient, asyncLocalStorage } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { logger } from '../config/logger';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthService {
  async register(data: RegisterInput): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    tenantId: string;
  }> {
    // For now, create a default tenant if not provided
    let tenantId = data.tenantId;

    if (!tenantId) {
      const context = asyncLocalStorage.getStore();
      if (context) {
        tenantId = context.tenantId;
      } else {
        throw new Error('Tenant ID is required for registration');
      }
    }

    // Check email uniqueness within tenant
    const existingUser = await dbClient.user.findFirst({
      where: {
        email: data.email,
        tenantId,
      },
    });

    if (existingUser) {
      throw new Error('Email already registered in this tenant');
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(data.password, config.BCRYPT_ROUNDS);

    // Create user
    const user = await dbClient.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: data.role,
        tenantId,
      },
    });

    logger.info({
      msg: 'User registered',
      userId: user.id,
      email: user.email,
      tenantId,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
    };
  }

  async login(email: string, password: string, tenantId: string): Promise<TokenPair> {
    // Find user by email and tenant
    const user = await dbClient.user.findFirst({
      where: {
        email,
        tenantId,
      },
    });

    if (!user) {
      logger.warn({ msg: 'Login failed: user not found', email, tenantId });
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn({ msg: 'Login failed: invalid password', email, tenantId });
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        type: 'access',
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN,
        algorithm: 'HS256',
      }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        type: 'refresh',
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_REFRESH_EXPIRES_IN,
        algorithm: 'HS256',
      }
    );

    // Store refresh token in Redis for revocation
    const decodedRefresh = jwt.decode(refreshToken) as any;
    if (decodedRefresh.exp) {
      const ttl = decodedRefresh.exp - Math.floor(Date.now() / 1000);
      await redis.setex(
        `refresh:${user.id}:${refreshToken.substring(0, 20)}`,
        ttl,
        'valid'
      );
    }

    logger.info({
      msg: 'User logged in',
      userId: user.id,
      email: user.email,
      tenantId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.JWT_EXPIRES_IN,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is blacklisted
      const isBlacklisted = await redis.get(
        `refresh:blacklist:${decoded.id}:${refreshToken.substring(0, 20)}`
      );

      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Verify user still exists
      const user = await dbClient.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token pair
      const newAccessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          type: 'access',
        },
        config.JWT_SECRET,
        {
          expiresIn: config.JWT_EXPIRES_IN,
          algorithm: 'HS256',
        }
      );

      const newRefreshToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          type: 'refresh',
        },
        config.JWT_SECRET,
        {
          expiresIn: config.JWT_REFRESH_EXPIRES_IN,
          algorithm: 'HS256',
        }
      );

      // Blacklist old refresh token
      const decodedOld = jwt.decode(refreshToken) as any;
      if (decodedOld.exp) {
        const ttl = decodedOld.exp - Math.floor(Date.now() / 1000);
        await redis.setex(
          `refresh:blacklist:${decoded.id}:${refreshToken.substring(0, 20)}`,
          ttl,
          'revoked'
        );
      }

      logger.info({
        msg: 'Token refreshed',
        userId: user.id,
        tenantId: user.tenantId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: config.JWT_EXPIRES_IN,
      };
    } catch (error) {
      logger.error({ msg: 'Token refresh failed', error });
      throw new Error('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Blacklist the token
      const decodedData = jwt.decode(refreshToken) as any;
      if (decodedData.exp) {
        const ttl = decodedData.exp - Math.floor(Date.now() / 1000);
        await redis.setex(
          `refresh:blacklist:${userId}:${refreshToken.substring(0, 20)}`,
          ttl,
          'revoked'
        );
      }

      logger.info({
        msg: 'User logged out',
        userId,
      });
    } catch (error) {
      logger.warn({
        msg: 'Logout with invalid token',
        error,
      });
    }
  }
}

export const authService = new AuthService();
export default authService;
