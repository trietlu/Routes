import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_VEHICLE, type VehicleProfile } from '@routes/routing-core';
import { type VehicleRepo } from '../storage/vehicle';

export interface VehicleState {
  vehicle: VehicleProfile;
  /** Saves to storage and updates subscribers, so routes re-rank (FR-19). */
  save(profile: Omit<VehicleProfile, 'isUserSet'>): Promise<void>;
}

export type VehicleStore = StoreApi<VehicleState>;

/** The vehicle profile, loaded from storage and kept in memory for ranking. */
export function createVehicleStore(repo: VehicleRepo): VehicleStore {
  const store = createStore<VehicleState>()((set) => ({
    vehicle: { ...DEFAULT_VEHICLE },
    save: async (profile) => {
      set({ vehicle: await repo.save(profile) });
    },
  }));
  void repo.get().then(
    (vehicle) => store.setState({ vehicle }),
    () => undefined,
  );
  return store;
}
