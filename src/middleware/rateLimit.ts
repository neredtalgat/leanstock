import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { config } from '../config/env';

export const authRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `auth:ratelimit:${ip}`;

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, Math.ceil(config.RATE_LIMIT_AUTH_WINDOW_MS / 1000));
    }

    if (current > config.RATE_LIMIT_AUTH_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: await redis.ttl(key),
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default authRateLimit;
