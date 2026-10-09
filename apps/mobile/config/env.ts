import Constants from 'expo-constants';
import { type AppExtra } from '../app.config';

const DEFAULTS: AppExtra = {
  proxyUrl: 'http://localhost:8080',
  appEnv: 'development',
  mapProvider: 'default',
};

/** Runtime config from `app.config.ts` `extra` (technical design § Environments). */
export function getAppConfig(): AppExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;
  return { ...DEFAULTS, ...extra };
}
