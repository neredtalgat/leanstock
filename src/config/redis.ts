import Redis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export const redis = new Redis(config.REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ msg: 'Redis error', error: err });
});

redis.on('close', () => {
  logger.warn('Redis disconnected');
});

export default redis;
