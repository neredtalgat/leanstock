import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Bcrypt
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Email Configuration (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Email Token Expiry
  EMAIL_VERIFICATION_EXPIRES_IN: z.string().default('24h'),
  PASSWORD_RESET_EXPIRES_IN: z.string().default('1h'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
});

type Environment = z.infer<typeof envSchema>;

let config: Environment;

function validateEnv(): Environment {
  return envSchema.parse(process.env);
}

function getConfig(): Environment {
  if (!config) {
    config = validateEnv();
  }
  return config;
}

export const env = getConfig();
