import {
  APP_ATTEST_HEADER,
  DEVICE_ID_HEADER,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ErrorResponseSchema,
  PACKAGE_NAME,
} from './index';

describe('ErrorResponseSchema', () => {
  it.each(ERROR_CODES)('AT-04: the error envelope accepts %s', (code) => {
    const body = { error: { code, message: 'Something went wrong' } };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });

  it('AT-04: every documented code maps to its HTTP status', () => {
    expect(ERROR_HTTP_STATUS).toEqual({
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      RATE_LIMITED: 429,
      NO_ROUTE: 404,
      UPSTREAM_ERROR: 502,
      UPSTREAM_TIMEOUT: 504,
    });
  });

  it('AT-04: an undocumented code or a missing message fails', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(
      false,
    );
    expect(ErrorResponseSchema.safeParse({ error: { code: 'NO_ROUTE' } }).success).toBe(false);
  });
});

describe('package entry', () => {
  it('exports the package name and header names', () => {
    expect(PACKAGE_NAME).toBe('@routes/api-types');
    expect(DEVICE_ID_HEADER).toBe('X-Device-Id');
    expect(APP_ATTEST_HEADER).toBe('X-App-Attest');
  });
});
