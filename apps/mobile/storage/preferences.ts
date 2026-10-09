import { randomUUID } from 'expo-crypto';
import { type RankMode } from '@routes/routing-core';
import { type SqlDatabase } from './database';

export interface PreferencesRepo {
  /** Defaults to `fastest` (FR-11). */
  getLastMode(): Promise<RankMode>;
  setLastMode(mode: RankMode): Promise<void>;
  getLocationPromptShown(): Promise<boolean>;
  setLocationPromptShown(shown: boolean): Promise<void>;
  getCheapestVehiclePromptShown(): Promise<boolean>;
  setCheapestVehiclePromptShown(shown: boolean): Promise<void>;
  /** A random UUID, generated on first call and stable afterwards. */
  getDeviceId(): Promise<string>;
}

const KEYS = {
  lastMode: 'lastMode',
  locationPromptShown: 'locationPromptShown',
  cheapestVehiclePromptShown: 'cheapestVehiclePromptShown',
  deviceId: 'deviceId',
} as const;

export function createPreferencesRepo(
  db: SqlDatabase,
  generateId: () => string = randomUUID,
): PreferencesRepo {
  const read = async (key: string): Promise<string | null> =>
    (await db.getFirst<{ value: string }>('SELECT value FROM preferences WHERE key = ?', [key]))
      ?.value ?? null;
  const write = (key: string, value: string): Promise<void> =>
    db.run(
      'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  const readFlag = async (key: string): Promise<boolean> => (await read(key)) === 'true';

  return {
    async getLastMode() {
      return (await read(KEYS.lastMode)) === 'cheapest' ? 'cheapest' : 'fastest';
    },
    setLastMode: (mode) => write(KEYS.lastMode, mode),
    getLocationPromptShown: () => readFlag(KEYS.locationPromptShown),
    setLocationPromptShown: (shown) => write(KEYS.locationPromptShown, String(shown)),
    getCheapestVehiclePromptShown: () => readFlag(KEYS.cheapestVehiclePromptShown),
    setCheapestVehiclePromptShown: (shown) => write(KEYS.cheapestVehiclePromptShown, String(shown)),
    async getDeviceId() {
      const existing = await read(KEYS.deviceId);
      if (existing) return existing;
      const id = generateId();
      // INSERT OR IGNORE keeps the first ID if two callers race.
      await db.run('INSERT OR IGNORE INTO preferences (key, value) VALUES (?, ?)', [
        KEYS.deviceId,
        id,
      ]);
      return (await read(KEYS.deviceId)) ?? id;
    },
  };
}
