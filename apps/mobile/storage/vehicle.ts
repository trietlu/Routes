import { DEFAULT_VEHICLE, type FuelType, type VehicleProfile } from '@routes/routing-core';
import { type SqlDatabase } from './database';

export interface VehicleRepo {
  /** The saved profile, or the defaults (25 mpg, $3.50, regular) with `isUserSet: false`. */
  get(): Promise<VehicleProfile>;
  /** Saves the profile and marks it user-set (FR-19). */
  save(profile: Omit<VehicleProfile, 'isUserSet'>): Promise<VehicleProfile>;
}

interface VehicleRow {
  mpg: number;
  fuel_type: FuelType;
  price_per_gallon: number;
  is_user_set: number;
}

export function createVehicleRepo(db: SqlDatabase): VehicleRepo {
  return {
    async get() {
      const row = await db.getFirst<VehicleRow>('SELECT * FROM vehicle_profile WHERE id = 1');
      if (!row) return { ...DEFAULT_VEHICLE };
      return {
        mpg: row.mpg,
        fuelType: row.fuel_type,
        pricePerGallon: row.price_per_gallon,
        isUserSet: row.is_user_set === 1,
      };
    },

    async save(profile) {
      await db.run(
        `INSERT INTO vehicle_profile (id, mpg, fuel_type, price_per_gallon, is_user_set)
         VALUES (1, ?, ?, ?, 1)
         ON CONFLICT (id) DO UPDATE SET mpg = excluded.mpg, fuel_type = excluded.fuel_type,
           price_per_gallon = excluded.price_per_gallon, is_user_set = 1`,
        [profile.mpg, profile.fuelType, profile.pricePerGallon],
      );
      return {
        mpg: profile.mpg,
        fuelType: profile.fuelType,
        pricePerGallon: profile.pricePerGallon,
        isUserSet: true,
      };
    },
  };
}
