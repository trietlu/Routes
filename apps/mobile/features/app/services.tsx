import * as SplashScreen from 'expo-splash-screen';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { type ApiClient, ApiProvider, createAppApiClient, wireOnlineManager } from '../../api';
import { deviceLocationSource } from '../../location';
import { StateProvider } from '../../state';
import { type Storage, openStorage } from '../../storage';

// Keep the native splash screen up until storage has opened and the first
// screen has mounted, so launch never shows a blank frame (#85).
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

/** How long the splash stays visible after the app is ready, in ms, so it doesn't just flash by. */
export const SPLASH_MIN_VISIBLE_MS = 1500;

let openAppStorage: () => Promise<Storage> = openStorage;
let makeApiClient: (getDeviceId: () => Promise<string>) => ApiClient = createAppApiClient;

/** Swaps how storage opens; tests use an in-memory database. */
export function configureStorageOpener(opener: () => Promise<Storage>): void {
  openAppStorage = opener;
}

/** Swaps the proxy client; screen tests use a fake. */
export function configureApiClient(
  factory: (getDeviceId: () => Promise<string>) => ApiClient,
): void {
  makeApiClient = factory;
}

const StorageContext = createContext<Storage | null>(null);

export function useStorage(): Storage {
  const storage = useContext(StorageContext);
  if (!storage) throw new Error('useStorage must be used inside <AppProviders>');
  return storage;
}

/** Opens storage once, then provides storage, the API client and the trip state. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [storage, setStorage] = useState<Storage | null>(null);
  useEffect(() => {
    let active = true;
    wireOnlineManager();
    void openAppStorage().then((opened) => {
      if (active) setStorage(opened);
    });
    return () => {
      active = false;
    };
  }, []);
  if (!storage) return null; // the native splash screen stays up meanwhile
  return <LoadedProviders storage={storage}>{children}</LoadedProviders>;
}

function LoadedProviders({ storage, children }: { storage: Storage; children: ReactNode }) {
  const [client] = useState(() => makeApiClient(() => storage.preferences.getDeviceId()));
  // Storage is open and the screens below have mounted: reveal the app after
  // SPLASH_MIN_VISIBLE_MS, then fade out.
  useEffect(() => {
    const timer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, SPLASH_MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <StorageContext.Provider value={storage}>
      <ApiProvider client={client}>
        <StateProvider
          preferences={storage.preferences}
          vehicleRepo={storage.vehicle}
          location={deviceLocationSource}
        >
          {children}
        </StateProvider>
      </ApiProvider>
    </StorageContext.Provider>
  );
}
