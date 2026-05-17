import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../config/redis';
import { logger } from '../config/logger';

export async function tenantRateLimit(windowMs: number = 900000, maxRequests: number = 100) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).tenantId || 'global';
      const userId = (req as any).user?.userId || req.ip || 'anonymous';
      const key = `ratelimit:${tenantId}:${userId}:${req.path}`;
      const current = await checkRateLimit(key, maxRequests, windowMs);
      if (current === 0) {
        res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000),
        });
        return;
      }
      res.setHeader('X-Rate-Limit-Limit', maxRequests);
      res.setHeader('X-Rate-Limit-Remaining', Math.max(0, maxRequests - current));
      next();
    } catch (error) {
      logger.error({ err: error }, 'Rate limit check failed');
      next();
    }
  };
}

export async function authRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip || 'unknown';
    const key = `auth:ratelimit:${ip}`;
    const current = await checkRateLimit(key, 5, 900000);
    if (current === 0) {
      res.status(429).json({
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
      });
      return;
    }
    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth rate limit check failed');
    next();
  }
}
