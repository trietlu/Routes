import { z } from 'zod';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'NO_ROUTE',
  'UPSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** HTTP status the proxy returns for each error code. */
export const ERROR_HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  NO_ROUTE: 404,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 504,
} as const satisfies Record<ErrorCode, number>;

/** Body of every error response: `{ error: { code, message } }`. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
