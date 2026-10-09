import path from 'node:path';
import { renderRouter } from 'expo-router/testing-library';
import { configureStorageOpener } from '../features/app/services';
import { type Storage, createStorage } from '../storage';
import { createTestDatabase } from './nodeSqlite';

export const APP_DIR = path.join(__dirname, '..', 'app');

/** Fresh in-memory storage for the real app; `prepare` can seed it first. */
export async function useTestStorage(
  prepare?: (storage: Storage) => Promise<void>,
): Promise<Storage> {
  const storage = await createStorage(createTestDatabase());
  await prepare?.(storage);
  configureStorageOpener(async () => storage);
  return storage;
}

/** Renders the real app (all routes and the root layout) at `url`. */
export async function renderApp(url: string) {
  return renderRouter(APP_DIR, { initialUrl: url });
}
