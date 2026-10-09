import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  LogController,
} from 'fastify';
import { type DestinationStream } from 'pino';
import { z } from 'zod';
import {
  type AutocompleteResponse,
  AutocompleteQuerySchema,
  type PlaceDetails,
  type RoutesResponse,
  DEVICE_ID_HEADER,
  type ErrorCode,
  PlaceDetailsQuerySchema,
  RoutesRequestSchema,
} from '@routes/api-types';
import { type Clock, TtlLruCache, autocompleteCacheKey, routesCacheKey } from './cache';
import { type Config } from './config';
import { ProxyError, errorBody } from './errors';
import { createLogger } from './logging';
import { type Providers, createProviders } from './providers';
import { DeviceRateLimiter } from './rateLimit';

declare module 'fastify' {
  interface FastifyReply {
    /** Set by handlers that serve from cache; logged per request. */
    cacheHit: boolean;
    /** Error code sent, if any; logged per request. */
    errorCode: ErrorCode | undefined;
  }
}

export interface AppOptions {
  /** Defaults to the providers for `config.provider`. */
  providers?: Providers;
  /** Where log lines go; defaults to stdout. Tests pass a capture stream. */
  logStream?: DestinationStream;
  /** Clock for cache TTLs and rate limits; defaults to `Date.now`. */
  now?: Clock;
}

const DeviceIdSchema = z.uuid();

/** Parses `input` with `schema`, or throws `BAD_REQUEST` naming the bad fields (not their values). */
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || '(root)')),
    ];
    throw new ProxyError('BAD_REQUEST', `Invalid request: ${fields.join(', ')}`);
  }
  return result.data;
}

/** The validated `X-Device-Id`, or `BAD_REQUEST`. */
function deviceIdOf(request: FastifyRequest): string {
  const result = DeviceIdSchema.safeParse(request.headers[DEVICE_ID_HEADER.toLowerCase()]);
  if (!result.success) {
    throw new ProxyError('BAD_REQUEST', `Missing or invalid ${DEVICE_ID_HEADER} header`);
  }
  return result.data;
}

/** Throws `RATE_LIMITED` with `Retry-After` when the device is over its limit. */
function enforceLimit(limiter: DeviceRateLimiter, request: FastifyRequest): void {
  const result = limiter.take(deviceIdOf(request));
  if (!result.ok) {
    throw new ProxyError('RATE_LIMITED', 'Too many requests. Try again in a minute.', undefined, {
      'Retry-After': String(result.retryAfterSec),
    });
  }
}

/** Serves from `cache` when it can; only successful responses are stored. */
async function cached<T>(
  cache: TtlLruCache<T>,
  key: string,
  reply: FastifyReply,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) {
    reply.cacheHit = true;
    return hit;
  }
  const value = await load();
  cache.set(key, value);
  return value;
}

function sendError(reply: FastifyReply, error: ProxyError): FastifyReply {
  reply.errorCode = error.code;
  reply.headers(error.headers);
  return reply.status(error.statusCode).send(errorBody(error.code, error.message));
}

/**
 * The proxy as a Fastify app, not yet listening, so tests can drive it
 * in-process with `inject`.
 */
export function buildApp(config: Config, options: AppOptions = {}): FastifyInstance {
  const providers = options.providers ?? createProviders(config);
  const now = options.now ?? Date.now;
  const { maxEntries } = config.cache;
  const caches = {
    routes: new TtlLruCache<RoutesResponse>(maxEntries, config.cache.routesTtlSec * 1000, now),
    autocomplete: new TtlLruCache<AutocompleteResponse>(
      maxEntries,
      config.cache.autocompleteTtlSec * 1000,
      now,
    ),
    details: new TtlLruCache<PlaceDetails>(maxEntries, config.cache.detailsTtlSec * 1000, now),
  };
  const limits = {
    routes: new DeviceRateLimiter(config.rateLimit.routesPerHour, now),
    // Autocomplete and details share one places budget.
    places: new DeviceRateLimiter(config.rateLimit.placesPerHour, now),
  };
  const app = Fastify({
    // Widened so the app keeps Fastify's default instance type.
    loggerInstance: createLogger(config, options.logStream) as FastifyBaseLogger,
    // Fastify's request logging includes the URL and its query string (NFR-3).
    logController: new LogController({ disableRequestLogging: true }),
  });

  app.decorateReply('cacheHit', false);
  app.decorateReply('errorCode', undefined);

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        // The route template, e.g. "/places/autocomplete", never the raw URL.
        route: request.routeOptions.url ?? '(unknown)',
        status: reply.statusCode,
        latencyMs: Math.round(reply.elapsedTime),
        cacheHit: reply.cacheHit,
        errorCode: reply.errorCode,
      },
      'request',
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProxyError) return sendError(reply, error);
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // Malformed JSON, wrong content type, body too large and the like.
      return sendError(reply, new ProxyError('BAD_REQUEST', 'Invalid request'));
    }
    // The contract has no internal-error code; report it as an upstream failure.
    return sendError(reply, new ProxyError('UPSTREAM_ERROR', 'Something went wrong'));
  });

  app.setNotFoundHandler((_request, reply) =>
    sendError(reply, new ProxyError('BAD_REQUEST', 'Unknown endpoint', 404)),
  );

  app.get('/healthz', async () => ({ ok: true }));

  // Everything but the health check needs a device ID. Limits count every
  // request, cache hits included; the cache is consulted after validation.
  app.register(async (api) => {
    api.addHook('onRequest', async (request) => void deviceIdOf(request));

    api.post('/routes', async (request, reply) => {
      enforceLimit(limits.routes, request);
      const body = validate(RoutesRequestSchema, request.body);
      return cached(caches.routes, routesCacheKey(body), reply, () =>
        providers.routes.computeRoutes(body),
      );
    });

    api.get('/places/autocomplete', async (request, reply) => {
      enforceLimit(limits.places, request);
      const query = validate(AutocompleteQuerySchema, request.query);
      return cached(caches.autocomplete, autocompleteCacheKey(query), reply, () =>
        providers.places.autocomplete(query),
      );
    });

    api.get('/places/details', async (request, reply) => {
      enforceLimit(limits.places, request);
      const query = validate(PlaceDetailsQuerySchema, request.query);
      return cached(caches.details, query.placeId, reply, () => providers.places.details(query));
    });
  });

  return app;
}
