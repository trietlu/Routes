import { ERROR_HTTP_STATUS, type ErrorCode, type ErrorResponse } from '@routes/api-types';

/** An error the proxy reports to the app as `{ error: { code, message } }`. */
export class ProxyError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  /** Extra response headers, e.g. `Retry-After` on `RATE_LIMITED`. */
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = ERROR_HTTP_STATUS[code],
    headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

export const errorBody = (code: ErrorCode, message: string): ErrorResponse => ({
  error: { code, message },
});
