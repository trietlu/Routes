import { getAppConfig } from '../config/env';
import { type ApiClient, createApiClient } from './client';
import { isDeviceOffline } from './network';

export * from './client';
export * from './debounce';
export * from './errors';
export * from './hooks';
export * from './network';
export * from './provider';
export * from './session';

/** The app's client: proxy URL from config, device ID from storage. */
export function createAppApiClient(getDeviceId: () => Promise<string>): ApiClient {
  return createApiClient({
    baseUrl: getAppConfig().proxyUrl,
    getDeviceId,
    isOffline: isDeviceOffline,
  });
}
