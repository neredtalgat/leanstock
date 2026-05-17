import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const IDEMPOTENCY_PREFIX = 'idempotency';
const IDEMPOTENCY_TTL = 86400;

export async function idempotencyMiddleware(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  const key = req.headers['idempotency-key'] as string;
  if (!key) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' });
      return;
    }
    next();
    return;
  }

  const redisKey = `${IDEMPOTENCY_PREFIX}:${key}`;
  const cached = await redis.get(redisKey);
  if (cached) {
    logger.info({ key }, 'Idempotency cache hit');
    const parsed = JSON.parse(cached);
    res.status(parsed.statusCode).json(parsed.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      redis.setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify({
        statusCode: res.statusCode, body, createdAt: new Date().toISOString(),
      })).catch((err) => logger.error({ err }, 'Failed to cache idempotency response'));
    }
    return originalJson(body);
  };
  next();
}
