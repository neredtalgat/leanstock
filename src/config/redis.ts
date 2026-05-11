import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisInstance: Redis;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis reconnecting... attempt ${times}`);
        return delay;
      },
    });

    redisInstance.on('error', (err) => {
      logger.error({ err }, 'Redis error');
    });

    redisInstance.on('connect', () => {
      logger.info('Redis connected');
    });

    redisInstance.on('reconnecting', () => {
      logger.warn('Redis reconnecting');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await redisInstance.quit();
    });
  }

  return redisInstance;
}

export const redis = getRedis();

// Store script SHA for later use
let rateLimitScriptSha: string | null = null;

// Token bucket rate limiter script
const rateLimitScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])

local current = redis.call('GET', key)
if current == false then
  redis.call('SET', key, 1, 'PX', window)
  return 1
end

current = tonumber(current)
if current < limit then
  redis.call('INCR', key)
  return current + 1
else
  return 0
end
`;

// Load Lua scripts
export async function loadScripts(): Promise<void> {
  try {
    const sha = await redis.script('LOAD', rateLimitScript);
    rateLimitScriptSha = sha as string;
    logger.info(`Rate limit Lua script loaded: ${sha}`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load Lua scripts');
    throw error;
  }
}

/**
 * Execute rate limit check using loaded Lua script
 * Returns: number of requests made (0 if limit exceeded)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<number> {
  if (!rateLimitScriptSha) {
    throw new Error('Rate limit script not loaded. Call loadScripts() first.');
  }
  
  const now = Date.now();
  const result = await redis.evalsha(
    rateLimitScriptSha,
    1,           // number of keys
    key,         // KEYS[1]
    limit,       // ARGV[1]
    windowMs,    // ARGV[2]
    now          // ARGV[3]
  );
  
  return result as number;
}
