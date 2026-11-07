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

/** EAS project on expo.dev (account `triet05`). Not a secret. */
export const EAS_PROJECT_ID = '022bd36f-6b57-45a0-95a9-95ee4ca005d5';

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
  const appleTeamId = env.APPLE_TEAM_ID;
  const extra: AppExtra = {
    proxyUrl: env.EXPO_PUBLIC_PROXY_URL ?? 'http://localhost:8080',
    appEnv: env.EXPO_PUBLIC_APP_ENV ?? 'development',
    mapProvider: mapProviderFrom(env.EXPO_PUBLIC_MAP_PROVIDER),
  };

  return {
    ...config,
    name: 'Routes',
    slug: 'routes',
    owner: 'triet05',
    scheme: 'routes',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    // 1024×1024 opaque PNG rendered from assets/icon.svg (`npm run icons`).
    icon: './assets/icon.png',
    platforms: ['ios'],
    ios: {
      bundleIdentifier: env.IOS_BUNDLE_IDENTIFIER ?? 'com.routes.app.dev',
      // Signing team for device builds, so prebuild doesn't fall back to a Personal Team.
      ...(appleTeamId ? { appleTeamId } : {}),
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
      [
        'expo-splash-screen',
        {
          // Mark, "Routes" and tagline, rendered from assets/splash*.svg (`npm run icons`).
          image: './assets/splash-icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
          backgroundColor: '#FAF7F2',
          dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#121212' },
        },
      ],
      ['expo-build-properties', { ios: { deploymentTarget: '16.4' } }],
    ],
    experiments: { typedRoutes: false },
    extra: { ...extra, eas: { projectId: EAS_PROJECT_ID } },
  };
};
