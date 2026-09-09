import { z } from 'zod';

/** Environment schema — validated at boot so misconfig fails fast (never leaks secrets). */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(1_209_600),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).default('lax'),

  AI_PROVIDER: z.enum(['openrouter', 'mock']).default('openrouter'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('minimax/minimax-m3:free'),
  AI_FALLBACK_MODEL: z.string().default('minimax/minimax-m2.7:free'),
  AI_VISION_MODEL: z.string().default('minimax/minimax-m3:free'),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().default(4096),

  // Observability — both optional. No DSN → Sentry stays a no-op; LOG_LEVEL
  // controls Pino verbosity (trace|debug|info|warn|error), default info.
  SENTRY_DSN: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Data retention for unbounded-growth tables. 0 disables the cleanup sweep.
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).default(365),
  MOVEMENT_RETENTION_DAYS: z.coerce.number().int().min(0).default(730),

  // First platform admin — created at startup when no admin exists yet.
  ADMIN_PHONE: z.string().optional().default(''),
  ADMIN_PASSWORD: z.string().optional().default(''),
  ADMIN_NAME: z.string().default('Platform Admin'),
});

export type AppConfig = ReturnType<typeof buildConfig>;

function buildConfig(env: z.infer<typeof envSchema>) {
  return {
    env: env.NODE_ENV,
    port: env.PORT ?? env.API_PORT,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    database: { url: env.DATABASE_URL },
    redis: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    cookie: { domain: env.COOKIE_DOMAIN, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE },
    adminBootstrap: {
      phone: env.ADMIN_PHONE,
      password: env.ADMIN_PASSWORD,
      name: env.ADMIN_NAME,
    },
    ai: {
      // No key → mock; OpenRouter key auto-selects OpenRouter; otherwise mock.
      provider: env.OPENROUTER_API_KEY ? 'openrouter' : 'mock',
      apiKey: env.OPENROUTER_API_KEY,
      model: env.AI_MODEL,
      fallbackModel: env.AI_FALLBACK_MODEL,
      visionModel: env.AI_VISION_MODEL,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    },
    observability: {
      sentryDsn: env.SENTRY_DSN,
      logLevel: env.LOG_LEVEL,
    },
    retention: {
      auditDays: env.AUDIT_RETENTION_DAYS,
      movementDays: env.MOVEMENT_RETENTION_DAYS,
    },
  };
}

/** Loader for @nestjs/config. Throws with a readable message on invalid env. */
export function configuration() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return buildConfig(parsed.data);
}
