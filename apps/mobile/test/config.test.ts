import fs from 'node:fs';
import path from 'node:path';
import { type ExpoConfig } from 'expo/config';
import appConfig, { LOCATION_USAGE } from '../app.config';
import { getAppConfig } from '../config/env';

const ENV_KEYS = [
  'EXPO_PUBLIC_PROXY_URL',
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_MAP_PROVIDER',
  'GOOGLE_MAPS_IOS_KEY',
  'IOS_BUNDLE_IDENTIFIER',
] as const;

function build(env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}): ExpoConfig {
  const saved = ENV_KEYS.map((key) => [key, process.env[key]] as const);
  ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env);
  try {
    return appConfig({
      config: {},
      projectRoot: '',
      staticConfigPath: null,
      packageJsonPath: null,
    } as never);
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('app.config.ts', () => {
  it('APP-CFG-01: queries comgooglemaps, has a when-in-use location string and no background location', () => {
    const config = build();
    const plist = config.ios?.infoPlist ?? {};
    expect(plist.LSApplicationQueriesSchemes).toEqual(['comgooglemaps']);
    expect(plist.NSLocationWhenInUseUsageDescription).toBe(
      'Routes uses your location to set your starting point.',
    );
    expect(LOCATION_USAGE).toBe(plist.NSLocationWhenInUseUsageDescription);
    expect(plist.UIBackgroundModes).toBeUndefined();
    expect(plist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    expect(plist.NSLocationAlwaysUsageDescription).toBeUndefined();
    // No background modes or "Always" location anywhere (the splash's backgroundColor is fine).
    expect(JSON.stringify(config)).not.toMatch(/BackgroundModes|background-location|Always/i);
  });

  it('APP-CFG-02: the app icon is a 1024×1024 PNG with no alpha channel (App Store requirement)', () => {
    const config = build();
    expect(config.icon).toBe('./assets/icon.png');
    const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png'));
    // PNG signature, then the IHDR chunk: width and height (big-endian), bit depth, colour type.
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[25]).toBe(2); // colour type 2 = RGB, no alpha
    expect(fs.existsSync(path.join(__dirname, '..', 'assets', 'icon.svg'))).toBe(true);
  });

  it('APP-CFG-03: the splash screen is configured (light and dark) and its images exist', () => {
    const config = build();
    const splash = (config.plugins ?? []).find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, Record<string, unknown>] | undefined;
    expect(splash?.[1]).toMatchObject({
      image: './assets/splash-icon.png',
      backgroundColor: '#FAF7F2',
      dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#121212' },
    });
    for (const file of [
      'splash-icon.png',
      'splash-icon-dark.png',
      'splash.svg',
      'splash-dark.svg',
    ]) {
      expect(fs.existsSync(path.join(__dirname, '..', 'assets', file))).toBe(true);
    }
  });

  it('is an iPhone-only, portrait app following the system appearance', () => {
    const config = build();
    expect(config).toMatchObject({
      orientation: 'portrait',
      userInterfaceStyle: 'automatic',
      platforms: ['ios'],
      ios: { supportsTablet: false, bundleIdentifier: 'com.routes.app.dev' },
    });
    expect(config.plugins).toContainEqual([
      'expo-build-properties',
      { ios: { deploymentTarget: '16.4' } },
    ]);
  });

  it('defaults extra to the local mock proxy and Apple Maps, with no Google key needed', () => {
    const config = build();
    expect(config.extra).toEqual({
      proxyUrl: 'http://localhost:8080',
      appEnv: 'development',
      mapProvider: 'default',
    });
    expect(config.ios?.config?.googleMapsApiKey).toBeUndefined();
  });

  it('reads EXPO_PUBLIC_* and passes the Google Maps key only when set', () => {
    const config = build({
      EXPO_PUBLIC_PROXY_URL: 'https://staging.example.com',
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_MAP_PROVIDER: 'google',
      GOOGLE_MAPS_IOS_KEY: 'ios-key',
      IOS_BUNDLE_IDENTIFIER: 'com.routes.app',
    });
    expect(config.extra).toEqual({
      proxyUrl: 'https://staging.example.com',
      appEnv: 'staging',
      mapProvider: 'google',
    });
    expect(config.ios?.config?.googleMapsApiKey).toBe('ios-key');
    expect(config.ios?.bundleIdentifier).toBe('com.routes.app');
    expect(build({ EXPO_PUBLIC_MAP_PROVIDER: 'bing' }).extra?.mapProvider).toBe('default');
  });

  it('getAppConfig falls back to defaults when extra is missing', () => {
    expect(getAppConfig()).toMatchObject({
      proxyUrl: expect.any(String),
      mapProvider: expect.any(String),
    });
  });
});
