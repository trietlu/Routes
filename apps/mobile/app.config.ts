import { type ConfigContext, type ExpoConfig } from 'expo/config';

/** Copy shown in the iOS location prompt (FR-1). */
export const LOCATION_USAGE = 'Routes uses your location to set your starting point.';

export type MapProvider = 'default' | 'google';

/** Values the app reads at runtime through `expo-constants` (see `config/env.ts`). */
export interface AppExtra {
  proxyUrl: string;
  appEnv: string;
  mapProvider: MapProvider;
}

const mapProviderFrom = (value: string | undefined): MapProvider =>
  value === 'google' ? 'google' : 'default';

/**
 * Expo config. Environment comes from `EXPO_PUBLIC_*` variables (technical
 * design § Environments); nothing here needs a Google key unless
 * `EXPO_PUBLIC_MAP_PROVIDER=google`.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const env = process.env;
  const googleMapsIosKey = env.GOOGLE_MAPS_IOS_KEY;
  const extra: AppExtra = {
    proxyUrl: env.EXPO_PUBLIC_PROXY_URL ?? 'http://localhost:8080',
    appEnv: env.EXPO_PUBLIC_APP_ENV ?? 'development',
    mapProvider: mapProviderFrom(env.EXPO_PUBLIC_MAP_PROVIDER),
  };

  return {
    ...config,
    name: 'Routes',
    slug: 'routes',
    scheme: 'routes',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    platforms: ['ios'],
    ios: {
      bundleIdentifier: env.IOS_BUNDLE_IDENTIFIER ?? 'com.routes.app.dev',
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: LOCATION_USAGE,
        // Lets Linking.canOpenURL("comgooglemaps://") detect Google Maps (FR-17).
        LSApplicationQueriesSchemes: ['comgooglemaps'],
        // No background modes: location is foreground only (NFR-4, APP-LOC-03).
      },
      // The react-native-maps Google provider needs a key; Apple Maps does not.
      ...(googleMapsIosKey ? { config: { googleMapsApiKey: googleMapsIosKey } } : {}),
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      ['expo-build-properties', { ios: { deploymentTarget: '16.4' } }],
    ],
    experiments: { typedRoutes: false },
    extra,
  };
};
