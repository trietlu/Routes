/**
 * The typed contract between the app and the proxy: zod schemas, the types
 * inferred from them, error codes and header names.
 */

/** Package name, used to prove the workspace resolves from other packages. */
export const PACKAGE_NAME = '@routes/api-types';

export * from './coordinates';
export * from './errors';
export * from './headers';
export * from './places';
export * from './routes';
