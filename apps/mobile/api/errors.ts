import { ErrorResponseSchema } from '@routes/api-types';

/** What the UI distinguishes (FR-21, NFR-8; technical design § Errors). */
export type ApiErrorKind = 'offline' | 'noRoute' | 'rateLimited' | 'generic';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Maps an HTTP error response from the proxy to an `ApiError`. */
export function errorFromResponse(status: number, body: unknown): ApiError {
  const parsed = ErrorResponseSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : undefined;
  if (code === 'NO_ROUTE') return new ApiError('noRoute', 'No driving route found', status);
  if (code === 'RATE_LIMITED' || status === 429) {
    return new ApiError('rateLimited', 'Too many requests', status);
  }
  return new ApiError('generic', `Request failed (${code ?? status})`, status);
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** The kind of any thrown value; unknown errors are `generic`. */
export const errorKind = (error: unknown): ApiErrorKind =>
  isApiError(error) ? error.kind : 'generic';
