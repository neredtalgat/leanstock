import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z
    .string()
    .startsWith('postgresql://')
    .default('postgresql://leanstock:password@localhost:5432/leanstock_test'),
  REDIS_URL: z.string().startsWith('redis://').default('redis://localhost:6379'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('test_secret_key_min_32_characters_long_for_testing'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_AUTH_ATTEMPTS: z.coerce.number().default(5),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(900000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

type EnvConfig = z.infer<typeof envSchema>;

const parseEnv = (): EnvConfig => {
  const env = process.env;

  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Environment validation failed: ${details}`);
    }
    throw error;
  }
};

export const config = parseEnv();

export default config;
