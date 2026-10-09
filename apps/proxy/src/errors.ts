import { ERROR_HTTP_STATUS, type ErrorCode, type ErrorResponse } from '@routes/api-types';

/** An error the proxy reports to the app as `{ error: { code, message } }`. */
export class ProxyError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode: number = ERROR_HTTP_STATUS[code]) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const errorBody = (code: ErrorCode, message: string): ErrorResponse => ({
  error: { code, message },
});
