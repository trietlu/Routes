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
  AutocompleteQuerySchema,
  DEVICE_ID_HEADER,
  type ErrorCode,
  PlaceDetailsQuerySchema,
  RoutesRequestSchema,
} from '@routes/api-types';
import { type Config } from './config';
import { ProxyError, errorBody } from './errors';
import { createLogger } from './logging';
import { type Providers, createProviders } from './providers';

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

async function requireDeviceId(request: FastifyRequest): Promise<void> {
  const header = request.headers[DEVICE_ID_HEADER.toLowerCase()];
  if (!DeviceIdSchema.safeParse(header).success) {
    throw new ProxyError('BAD_REQUEST', `Missing or invalid ${DEVICE_ID_HEADER} header`);
  }
}

function sendError(reply: FastifyReply, error: ProxyError): FastifyReply {
  reply.errorCode = error.code;
  return reply.status(error.statusCode).send(errorBody(error.code, error.message));
}

/**
 * The proxy as a Fastify app, not yet listening, so tests can drive it
 * in-process with `inject`.
 */
export function buildApp(config: Config, options: AppOptions = {}): FastifyInstance {
  const providers = options.providers ?? createProviders(config);
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

  // Everything but the health check needs a device ID.
  app.register(async (api) => {
    api.addHook('onRequest', requireDeviceId);

    api.post('/routes', async (request) =>
      providers.routes.computeRoutes(validate(RoutesRequestSchema, request.body)),
    );

    api.get('/places/autocomplete', async (request) =>
      providers.places.autocomplete(validate(AutocompleteQuerySchema, request.query)),
    );

    api.get('/places/details', async (request) =>
      providers.places.details(validate(PlaceDetailsQuerySchema, request.query)),
    );
  });

  return app;
}
