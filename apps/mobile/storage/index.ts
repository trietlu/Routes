import { type SqlDatabase } from './database';
import { openExpoDatabase } from './expoDatabase';
import { migrate } from './migrations';
import { type PlacesRepo, createPlacesRepo } from './places';
import { type PreferencesRepo, createPreferencesRepo } from './preferences';
import { type VehicleRepo, createVehicleRepo } from './vehicle';

export * from './database';
export * from './migrations';
export * from './places';
export * from './preferences';
export * from './vehicle';

export interface Storage {
  places: PlacesRepo;
  vehicle: VehicleRepo;
  preferences: PreferencesRepo;
}

/** Migrates the database and returns the repositories over it. */
export async function createStorage(db: SqlDatabase): Promise<Storage> {
  await migrate(db);
  return {
    places: createPlacesRepo(db),
    vehicle: createVehicleRepo(db),
    preferences: createPreferencesRepo(db),
  };
}

/** Opens the on-device database (expo-sqlite) and returns the repositories. */
export async function openStorage(): Promise<Storage> {
  return createStorage(await openExpoDatabase());
}
