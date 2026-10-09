import { createStore, type StoreApi } from 'zustand/vanilla';
import { type OptionId, type RankMode } from '@routes/routing-core';
import { type PreferencesRepo } from '../storage/preferences';
import { type PlaceInput } from '../storage/places';

/** A trip endpoint: a place, or the device's current location. */
export type Endpoint = PlaceInput | 'current';

export interface TripState {
  start: Endpoint | null;
  destination: Endpoint | null;
  mode: RankMode;
  selectedLetter: OptionId;
  setStart(start: Endpoint | null): void;
  setDestination(destination: Endpoint | null): void;
  /** Exchanges start and destination, including `current` (FR-4). */
  swap(): void;
  /** Changes the ranking, selects the new A and persists the mode (FR-11, FR-14). */
  setMode(mode: RankMode): void;
  select(letter: OptionId): void;
}

export type TripStore = StoreApi<TripState>;

/**
 * The current trip (technical design § Repository layout). The mode starts as
 * Fastest and is replaced by the persisted `lastMode` once it loads, unless
 * the user has already picked one.
 */
export function createTripStore(
  preferences: Pick<PreferencesRepo, 'getLastMode' | 'setLastMode'>,
): TripStore {
  let modeChosen = false;
  const store = createStore<TripState>()((set) => ({
    start: null,
    destination: null,
    mode: 'fastest',
    selectedLetter: 'A',
    setStart: (start) => set({ start }),
    setDestination: (destination) => set({ destination }),
    swap: () => set((state) => ({ start: state.destination, destination: state.start })),
    setMode: (mode) => {
      modeChosen = true;
      set({ mode, selectedLetter: 'A' });
      void preferences.setLastMode(mode).catch(() => undefined);
    },
    select: (selectedLetter) => set({ selectedLetter }),
  }));
  void preferences.getLastMode().then(
    (mode) => {
      if (!modeChosen) store.setState({ mode });
    },
    () => undefined,
  );
  return store;
}
