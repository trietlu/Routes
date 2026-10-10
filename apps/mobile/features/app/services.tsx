import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { type ApiClient, ApiProvider, createAppApiClient, wireOnlineManager } from '../../api';
import { deviceLocationSource } from '../../location';
import { StateProvider } from '../../state';
import { type Storage, openStorage } from '../../storage';

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
  if (!storage) return null; // the native splash screen covers this brief moment
  return <LoadedProviders storage={storage}>{children}</LoadedProviders>;
}

function LoadedProviders({ storage, children }: { storage: Storage; children: ReactNode }) {
  const [client] = useState(() => makeApiClient(() => storage.preferences.getDeviceId()));
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
