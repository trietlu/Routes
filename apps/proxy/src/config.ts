import { z } from 'zod';

const NodeEnvSchema = z.enum(['development', 'test', 'production']);

/** Raw environment variables, validated at startup. */
const EnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default('development'),
    PORT: z.coerce.number().int().min(0).max(65_535).default(8080),
    PROVIDER: z.enum(['google', 'mock']).optional(),
    GOOGLE_MAPS_API_KEY: z.string().trim().min(1).optional(),
    ATTEST_MODE: z.enum(['off', 'enforce']).default('off'),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Cache TTLs and size (technical design § Caching and debounce).
    ROUTES_CACHE_TTL_SEC: z.coerce.number().int().nonnegative().default(60),
    AUTOCOMPLETE_CACHE_TTL_SEC: z.coerce.number().int().nonnegative().default(300),
    DETAILS_CACHE_TTL_SEC: z.coerce.number().int().nonnegative().default(86_400),
    CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(5000),
    // Per-device requests per rolling hour (NFR-9).
    RATE_LIMIT_ROUTES_PER_HOUR: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_PLACES_PER_HOUR: z.coerce.number().int().positive().default(600),
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    // Mock is the default everywhere except production (technical design § Mock provider mode).
    provider: env.PROVIDER ?? (env.NODE_ENV === 'production' ? 'google' : 'mock'),
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    attestMode: env.ATTEST_MODE,
    upstreamTimeoutMs: env.UPSTREAM_TIMEOUT_MS,
    logLevel: env.LOG_LEVEL,
    cache: {
      routesTtlSec: env.ROUTES_CACHE_TTL_SEC,
      autocompleteTtlSec: env.AUTOCOMPLETE_CACHE_TTL_SEC,
      detailsTtlSec: env.DETAILS_CACHE_TTL_SEC,
      maxEntries: env.CACHE_MAX_ENTRIES,
    },
    rateLimit: {
      routesPerHour: env.RATE_LIMIT_ROUTES_PER_HOUR,
      placesPerHour: env.RATE_LIMIT_PLACES_PER_HOUR,
    },
  }))
  .refine((config) => config.provider !== 'google' || config.googleMapsApiKey !== undefined, {
    message: 'GOOGLE_MAPS_API_KEY is required when PROVIDER=google',
    path: ['GOOGLE_MAPS_API_KEY'],
  });

export type Config = z.infer<typeof EnvSchema>;

/**
 * Reads the proxy's config from environment variables. Throws a readable
 * error naming the bad variables (never their values, which may be secrets).
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid proxy config. ${problems.join('; ')}`);
  }
  return result.data;
}
