import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { type RoutesRequest, type RoutesResponse } from '@routes/api-types';
import {
  DEFAULT_VEHICLE,
  type VehicleProfile,
  formatCardCost,
  formatDiff,
  toCents,
} from '@routes/routing-core';
import { ApiError, type ApiClient, ApiProvider, createQueryClient } from '../api';
import {
  type CurrentLocationSource,
  type Endpoint,
  StateProvider,
  createTripStore,
  createVehicleStore,
  fixedLocation,
  toWaypoint,
  useRankedRoutes,
  useTrip,
  useVehicle,
} from '../state';
import { type PlaceInput } from '../storage/places';
import { type VehicleRepo } from '../storage/vehicle';
import { fixtureRoutes } from './fixtures';

const HERE = { lat: 39.7392, lng: -104.9903 };
const UNION: PlaceInput = {
  name: 'Union Station',
  address: '100 Union Plaza',
  placeId: 'fixture-union-station',
  lat: 39.8255,
  lng: -104.906,
};
const HOME: PlaceInput = {
  name: 'Home',
  address: '1 Home St',
  placeId: null,
  lat: 39.7,
  lng: -105,
};

function fakeClient(placeId = 'fixture-union-station') {
  return {
    routes: jest.fn(async (_request: RoutesRequest): Promise<RoutesResponse> => ({
      routes: fixtureRoutes(placeId),
    })),
    autocomplete: jest.fn(async () => ({ suggestions: [] })),
    details: jest.fn(async () => ({ placeId: 'p', name: 'n', address: 'a', lat: 0, lng: 0 })),
  } satisfies ApiClient;
}

function fakePreferences(lastMode: 'fastest' | 'cheapest' = 'fastest') {
  return {
    getLastMode: jest.fn(async () => lastMode),
    setLastMode: jest.fn(async () => undefined),
  };
}

function fakeVehicleRepo(
  initial: VehicleProfile = { ...DEFAULT_VEHICLE },
): VehicleRepo & { save: jest.Mock } {
  let stored = initial;
  return {
    get: async () => stored,
    save: jest.fn(
      async (profile: Omit<VehicleProfile, 'isUserSet'>) =>
        (stored = { ...profile, isUserSet: true }),
    ),
  };
}

interface Setup {
  client?: ReturnType<typeof fakeClient>;
  preferences?: ReturnType<typeof fakePreferences>;
  vehicleRepo?: VehicleRepo;
  location?: CurrentLocationSource;
}

function wrapper({
  client = fakeClient(),
  preferences = fakePreferences(),
  vehicleRepo = fakeVehicleRepo(),
  location = fixedLocation(HERE),
}: Setup = {}) {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider client={client} queryClient={queryClient}>
        <StateProvider preferences={preferences} vehicleRepo={vehicleRepo} location={location}>
          {children}
        </StateProvider>
      </ApiProvider>
    );
  };
}

/** The ranked routes plus the store actions, for one render. */
function useTripAndRoutes() {
  return {
    ranked: useRankedRoutes(),
    mode: useTrip((s) => s.mode),
    selected: useTrip((s) => s.selectedLetter),
    actions: useTrip((s) => s),
    saveVehicle: useVehicle((s) => s.save),
  };
}

async function renderTrip(
  setup: Setup = {},
  start: Endpoint = 'current',
  destination: Endpoint = UNION,
) {
  const hook = await renderHook(() => useTripAndRoutes(), { wrapper: wrapper(setup) });
  await act(async () => {
    hook.result.current.actions.setStart(start);
    hook.result.current.actions.setDestination(destination);
  });
  await waitFor(() => expect(hook.result.current.ranked.status).toBe('success'));
  return hook;
}

const cards = (options: ReturnType<typeof useRankedRoutes>['options']) =>
  options.map((o) => [
    o.id,
    o.viaLabel,
    o.durationSec,
    formatCardCost(o),
    o.diff ? formatDiff(o.diff) : null,
  ]);

describe('trip state', () => {
  it('APP-STATE-01: canonical Fastest and Cheapest results match test plan §2', async () => {
    const client = fakeClient();
    const { result } = await renderTrip({ client });
    expect(result.current.ranked).toMatchObject({
      status: 'success',
      onlyN: null,
      errorKind: null,
    });
    expect(cards(result.current.ranked.options)).toEqual([
      ['A', 'Hwy 12', 1320, '$5.12', null],
      ['B', 'Elm Ave & 3rd St', 1620, '$1.48', '5 min slower · saves $3.64'],
      ['C', 'Main St', 1860, '$1.25', '9 min slower · saves $3.87'],
    ]);
    expect(result.current.ranked.options[0]!.isTopPick).toBe(true);

    await act(async () => result.current.actions.setMode('cheapest'));
    expect(cards(result.current.ranked.options)).toEqual([
      ['A', 'Main St', 1860, '$1.25', null],
      ['B', 'Elm Ave & 3rd St', 1620, '$1.48', '4 min faster · $0.23 more'],
      ['C', 'Hwy 12', 1320, '$5.12', '9 min faster · $3.87 more'],
    ]);
    // Toggling the mode made no additional client calls.
    await act(async () => result.current.actions.setMode('fastest'));
    expect(client.routes).toHaveBeenCalledTimes(1);
    expect(client.routes).toHaveBeenCalledWith({
      origin: HERE,
      destination: { placeId: 'fixture-union-station', lat: UNION.lat, lng: UNION.lng },
    });
  });

  it('APP-STATE-02: changing the vehicle re-ranks and updates costs with no refetch', async () => {
    const client = fakeClient();
    const vehicleRepo = fakeVehicleRepo();
    const { result } = await renderTrip({ client, vehicleRepo });
    await act(async () => {
      await result.current.saveVehicle({ mpg: 40, fuelType: 'regular', pricePerGallon: 4 });
    });
    expect(result.current.ranked.options.map((o) => toCents(o.tripUSD!))).toEqual([473, 106, 89]);
    expect(vehicleRepo.save).toHaveBeenCalledWith({
      mpg: 40,
      fuelType: 'regular',
      pricePerGallon: 4,
    });
    expect(client.routes).toHaveBeenCalledTimes(1);
  });

  it('loads a saved vehicle from storage', async () => {
    const vehicleRepo = fakeVehicleRepo({
      mpg: 40,
      fuelType: 'regular',
      pricePerGallon: 4,
      isUserSet: true,
    });
    const { result } = await renderTrip({ vehicleRepo });
    await waitFor(() =>
      expect(result.current.ranked.options.map((o) => toCents(o.tripUSD!))).toEqual([473, 106, 89]),
    );
  });

  it('APP-STATE-03: swap exchanges start and destination, including current', () => {
    const store = createTripStore(fakePreferences());
    store.getState().setStart('current');
    store.getState().setDestination(UNION);
    store.getState().swap();
    expect(store.getState()).toMatchObject({ start: UNION, destination: 'current' });
    store.getState().swap();
    expect(store.getState()).toMatchObject({ start: 'current', destination: UNION });
    store.getState().setStart(HOME);
    store.getState().setDestination(null);
    store.getState().swap();
    expect(store.getState()).toMatchObject({ start: null, destination: HOME });
  });

  it('a swapped trip routes from the place to the current location', async () => {
    const client = fakeClient();
    await renderTrip({ client }, UNION, 'current');
    expect(client.routes).toHaveBeenCalledWith({
      origin: { placeId: 'fixture-union-station', lat: UNION.lat, lng: UNION.lng },
      destination: HERE,
    });
  });

  it('APP-STATE-04: selecting a route by letter; a mode change selects the new A', async () => {
    const preferences = fakePreferences();
    const { result } = await renderTrip({ preferences });
    expect(result.current.selected).toBe('A');
    await act(async () => result.current.actions.select('C'));
    expect(result.current.selected).toBe('C');
    await act(async () => result.current.actions.setMode('cheapest'));
    expect(result.current.selected).toBe('A');
    expect(result.current.mode).toBe('cheapest');
    expect(preferences.setLastMode).toHaveBeenCalledWith('cheapest');
  });

  it('starts in the persisted mode, unless the user picks one first', async () => {
    const store = createTripStore(fakePreferences('cheapest'));
    expect(store.getState().mode).toBe('fastest');
    await waitFor(() => expect(store.getState().mode).toBe('cheapest'));

    let resolve: (mode: 'cheapest') => void = () => undefined;
    const slow = {
      getLastMode: () => new Promise<'cheapest'>((done) => (resolve = done)),
      setLastMode: jest.fn(async () => undefined),
    };
    const chosen = createTripStore(slow);
    chosen.getState().setMode('fastest');
    resolve('cheapest');
    await Promise.resolve();
    expect(chosen.getState().mode).toBe('fastest');
  });

  it('keeps the default vehicle if storage fails to load', async () => {
    const store = createVehicleStore({
      get: async () => Promise.reject(new Error('db')),
      save: jest.fn(),
    });
    await Promise.resolve();
    expect(store.getState().vehicle).toEqual({ ...DEFAULT_VEHICLE });
  });

  it('survives storage failures', async () => {
    const broken = {
      getLastMode: jest.fn(async () => Promise.reject(new Error('db'))),
      setLastMode: jest.fn(async () => Promise.reject(new Error('db'))),
    };
    const store = createTripStore(broken);
    store.getState().setMode('cheapest');
    await Promise.resolve();
    expect(store.getState().mode).toBe('cheapest');
  });

  it('is idle until both ends are known, loading while fetching, and reports error kinds', async () => {
    const client = fakeClient();
    const { result } = await renderHook(() => useTripAndRoutes(), { wrapper: wrapper({ client }) });
    expect(result.current.ranked).toEqual({
      status: 'idle',
      options: [],
      onlyN: null,
      errorKind: null,
    });

    // Current location unavailable: nothing to route yet.
    const nowhere = await renderHook(() => useTripAndRoutes(), {
      wrapper: wrapper({ client, location: fixedLocation(null) }),
    });
    await act(async () => {
      nowhere.result.current.actions.setStart('current');
      nowhere.result.current.actions.setDestination(UNION);
    });
    await waitFor(() => expect(nowhere.result.current.ranked.status).toBe('idle'));
    expect(client.routes).not.toHaveBeenCalled();

    let finish: (value: RoutesResponse) => void = () => undefined;
    client.routes.mockImplementationOnce(() => new Promise((done) => (finish = done)));
    await act(async () => {
      result.current.actions.setStart(HOME);
      result.current.actions.setDestination(UNION);
    });
    await waitFor(() => expect(result.current.ranked.status).toBe('loading'));
    await act(async () => finish({ routes: fixtureRoutes('fixture-two-routes') }));
    await waitFor(() => expect(result.current.ranked.status).toBe('success'));
    expect(result.current.ranked.onlyN).toBe(2);

    const failing = fakeClient();
    failing.routes.mockRejectedValue(new ApiError('noRoute', 'none', 404));
    const failed = await renderHook(() => useTripAndRoutes(), {
      wrapper: wrapper({ client: failing }),
    });
    await act(async () => {
      failed.result.current.actions.setStart(HOME);
      failed.result.current.actions.setDestination(UNION);
    });
    await waitFor(() => expect(failed.result.current.ranked.status).toBe('error'));
    expect(failed.result.current.ranked.errorKind).toBe('noRoute');
  });

  it('toWaypoint maps places and current location', () => {
    expect(toWaypoint(null, HERE)).toBeNull();
    expect(toWaypoint('current', null)).toBeNull();
    expect(toWaypoint('current', HERE)).toEqual(HERE);
    expect(toWaypoint(HOME, null)).toEqual({ lat: HOME.lat, lng: HOME.lng });
    expect(toWaypoint(UNION, null)).toEqual({
      placeId: 'fixture-union-station',
      lat: UNION.lat,
      lng: UNION.lng,
    });
  });

  it('state hooks outside the provider fail loudly', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderHook(() => useTrip((s) => s.mode))).rejects.toThrow(
      'inside <StateProvider>',
    );
  });
});
