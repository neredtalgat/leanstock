import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AuthenticatedRequest, JWTPayload } from '../types';

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      if (decoded.type !== 'access') {
        res.status(401).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid token type',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      req.user = decoded;
      req.tenantId = decoded.tenantId;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid or malformed token',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET, {
          algorithms: ['HS256'],
        }) as JWTPayload;

        if (decoded.type === 'access') {
          req.user = decoded;
          req.tenantId = decoded.tenantId;
        }
      } catch (error) {
        logger.debug('Optional auth token validation failed:', error);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};
