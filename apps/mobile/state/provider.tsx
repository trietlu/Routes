import { createContext, type ReactNode, useContext, useState } from 'react';
import { useStore } from 'zustand';
import { type PreferencesRepo } from '../storage/preferences';
import { type VehicleRepo } from '../storage/vehicle';
import { type CurrentLocationSource } from './location';
import { type TripState, type TripStore, createTripStore } from './tripStore';
import { type VehicleState, type VehicleStore, createVehicleStore } from './vehicleStore';

interface StateContextValue {
  trip: TripStore;
  vehicle: VehicleStore;
  location: CurrentLocationSource;
}

const StateContext = createContext<StateContextValue | null>(null);

export interface StateProviderProps {
  preferences: Pick<PreferencesRepo, 'getLastMode' | 'setLastMode'>;
  vehicleRepo: VehicleRepo;
  location: CurrentLocationSource;
  children: ReactNode;
}

/** Provides the trip and vehicle stores and the current-location source. */
export function StateProvider({
  preferences,
  vehicleRepo,
  location,
  children,
}: StateProviderProps) {
  const [value] = useState<StateContextValue>(() => ({
    trip: createTripStore(preferences),
    vehicle: createVehicleStore(vehicleRepo),
    location,
  }));
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

function useStateContext(): StateContextValue {
  const value = useContext(StateContext);
  if (!value) throw new Error('State hooks must be used inside <StateProvider>');
  return value;
}

export function useTrip<T>(selector: (state: TripState) => T): T {
  return useStore(useStateContext().trip, selector);
}

export function useVehicle<T>(selector: (state: VehicleState) => T): T {
  return useStore(useStateContext().vehicle, selector);
}

export function useCurrentLocationSource(): CurrentLocationSource {
  return useStateContext().location;
}
