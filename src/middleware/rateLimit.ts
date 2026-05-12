import { Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: AuthenticatedRequest) => string;
  skip?: (req: AuthenticatedRequest) => boolean;
}

export const createRateLimit = (prefix: string, options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests || env.RATE_LIMIT_MAX_REQUESTS;
  const keyGenerator = options.keyGenerator || ((req: AuthenticatedRequest) => req.ip || 'unknown');
  const skip = options.skip;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (skip && skip(req)) {
        return next();
      }

      const key = `ratelimit:${prefix}:${keyGenerator(req)}`;
      const now = Date.now();

      redis
        .eval(
          `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current_time = tonumber(ARGV[3])
        
        local count = redis.call('GET', key)
        if count == false then
          redis.call('SET', key, 1, 'PX', window)
          return {1, window}
        end
        
        count = tonumber(count)
        if count < limit then
          redis.call('INCR', key)
          redis.call('PEXPIRE', key, window)
          return {count + 1, redis.call('PTTL', key)}
        else
          return {0, redis.call('PTTL', key)}
        end
        `,
          1,
          key,
          String(maxRequests),
          String(windowMs),
          String(now),
        )
        .then((result) => {
          const [count, ttl] = result as [number, number];

          res.setHeader('X-RateLimit-Limit', maxRequests);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
          res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

          if (count === 0) {
            logger.warn(`Rate limit exceeded for ${prefix}: ${keyGenerator(req)}`);
            res.status(429).json({
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              details: {
                retryAfter: Math.ceil(ttl / 1000),
              },
              timestamp: new Date().toISOString(),
            });
            return;
          }

          next();
        })
        .catch((error) => {
          logger.error({ err: error }, 'Rate limit error');
          // Allow request on error
          next();
        });
    } catch (error) {
      logger.error({ err: error }, 'Rate limit middleware error');
      next();
    }
  };
};

export const authRateLimit = process.env.DISABLE_RATE_LIMIT === 'true'
  ? (_req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
  : createRateLimit('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    });

export const apiRateLimit = process.env.DISABLE_RATE_LIMIT === 'true'
  ? (_req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
  : createRateLimit('api', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
    });
