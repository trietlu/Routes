/**
 * The proxy service that fronts Google Routes and Places.
 */

/** Package name, used to prove the workspace resolves from other packages. */
export const PACKAGE_NAME = '@routes/proxy';

export { buildApp, type AppOptions } from './app';
export { type Config, loadConfig } from './config';
export { ProxyError } from './errors';
export { LOG_FIELD_ALLOW_LIST, createLogger } from './logging';
export {
  type PlacesProvider,
  type Providers,
  type RoutesProvider,
  createProviders,
} from './providers';
export { start } from './server';
