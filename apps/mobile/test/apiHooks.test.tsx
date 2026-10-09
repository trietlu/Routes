import { type ReactNode } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetailsQuery,
  type RoutesRequest,
  type RoutesResponse,
} from '@routes/api-types';
import {
  ApiError,
  type ApiClient,
  ApiProvider,
  PlacesSession,
  createQueryClient,
  useApi,
  useAutocomplete,
  useNetworkStatus,
  usePlaceDetails,
  useRoutes,
  wireOnlineManager,
} from '../api';
import { resetNetworkState, setNetworkState } from './mocks/netinfo';

const START = { lat: 39.7392, lng: -104.9903 };
const DESTINATION = { placeId: 'fixture-union-station', lat: 39.8255, lng: -104.906 };

function fakeClient() {
  return {
    routes: jest.fn(async (_request: RoutesRequest): Promise<RoutesResponse> => ({ routes: [] })),
    autocomplete: jest.fn(async (_query: AutocompleteQuery): Promise<AutocompleteResponse> => ({
      suggestions: [],
    })),
    details: jest.fn(async (_query: PlaceDetailsQuery) => ({
      placeId: 'p1',
      name: 'Union Station',
      address: '100 Union Plaza',
      lat: 39.8,
      lng: -104.9,
    })),
  } satisfies ApiClient;
}

function wrapperFor(client: ApiClient, session = new PlacesSession()) {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider client={client} queryClient={queryClient} session={session}>
        {children}
      </ApiProvider>
    );
  };
}

afterEach(() => {
  jest.useRealTimers();
  resetNetworkState();
});

describe('API hooks', () => {
  it('APP-API-03: autocomplete debounces 300 ms and skips queries under 2 characters', async () => {
    jest.useFakeTimers();
    const client = fakeClient();
    const { rerender } = await renderHook(({ q }: { q: string }) => useAutocomplete(q, START), {
      initialProps: { q: 'U' },
      wrapper: wrapperFor(client),
    });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(client.autocomplete).not.toHaveBeenCalled(); // 1 character

    for (const q of ['Un', 'Uni', 'Unio', 'Union']) {
      await rerender({ q });
      await act(async () => jest.advanceTimersByTime(100)); // typing faster than 300 ms
    }
    expect(client.autocomplete).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(299));
    expect(client.autocomplete).toHaveBeenCalledTimes(1);
    expect(client.autocomplete).toHaveBeenCalledWith({
      q: 'Union',
      lat: START.lat,
      lng: START.lng,
      session: expect.any(String),
    });

    await rerender({ q: ' u ' }); // trimmed to one character
    await act(async () => jest.advanceTimersByTime(1000));
    expect(client.autocomplete).toHaveBeenCalledTimes(1);
  });

  it('APP-API-04: the routes query key excludes mode; toggling mode issues no new request', async () => {
    const client = fakeClient();
    const { result, rerender } = await renderHook(
      // The screen holds a mode, but useRoutes never sees it.
      ({ mode: _mode }: { mode: 'fastest' | 'cheapest' }) => useRoutes(START, DESTINATION),
      { initialProps: { mode: 'fastest' }, wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await rerender({ mode: 'cheapest' });
    await rerender({ mode: 'fastest' });
    expect(client.routes).toHaveBeenCalledTimes(1);
    expect(client.routes).toHaveBeenCalledWith({ origin: START, destination: DESTINATION });
  });

  it('useRoutes waits for both ends', async () => {
    const client = fakeClient();
    await renderHook(() => useRoutes(START, null), { wrapper: wrapperFor(client) });
    expect(client.routes).not.toHaveBeenCalled();
  });

  it('useRoutes retries generic failures once, and never noRoute', async () => {
    const client = fakeClient();
    client.routes.mockRejectedValue(new ApiError('noRoute', 'none', 404));
    const noRoute = await renderHook(() => useRoutes(START, DESTINATION), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(noRoute.result.current.isError).toBe(true));
    expect(client.routes).toHaveBeenCalledTimes(1);

    const flaky = fakeClient();
    flaky.routes
      .mockRejectedValueOnce(new ApiError('generic', 'boom', 502))
      .mockRejectedValueOnce(new ApiError('generic', 'boom', 502));
    const generic = await renderHook(() => useRoutes(START, DESTINATION), {
      wrapper: wrapperFor(flaky),
    });
    await waitFor(() => expect(generic.result.current.isError).toBe(true), { timeout: 5000 });
    expect(flaky.routes).toHaveBeenCalledTimes(2);
  });

  it('APP-API-05: one session token is reused until a details call, then rotated', async () => {
    jest.useFakeTimers();
    const client = fakeClient();
    const tokens = ['token-1', 'token-2'];
    const session = new PlacesSession(() => tokens.shift()!);
    const { result, rerender } = await renderHook(
      ({ q }: { q: string }) => ({ auto: useAutocomplete(q, null), details: usePlaceDetails() }),
      { initialProps: { q: 'Un' }, wrapper: wrapperFor(client, session) },
    );
    await act(async () => jest.advanceTimersByTime(300));
    await rerender({ q: 'Union' });
    await act(async () => jest.advanceTimersByTime(300));
    expect(client.autocomplete.mock.calls.map(([query]) => query!.session)).toEqual([
      'token-1',
      'token-1',
    ]);

    await act(async () => {
      await result.current.details.mutateAsync('p1');
    });
    expect(client.details).toHaveBeenCalledWith({ placeId: 'p1', session: 'token-1' });

    await rerender({ q: 'Union Sta' });
    await act(async () => jest.advanceTimersByTime(300));
    expect(client.autocomplete.mock.calls.at(-1)![0]!.session).toBe('token-2');
  });

  it('a failed details call also ends the session', async () => {
    const client = fakeClient();
    client.details.mockRejectedValueOnce(new ApiError('generic', 'boom'));
    const tokens = ['a', 'b'];
    const session = new PlacesSession(() => tokens.shift()!);
    const { result } = await renderHook(() => usePlaceDetails(), {
      wrapper: wrapperFor(client, session),
    });
    await act(async () => {
      await result.current.mutateAsync('p1').catch(() => undefined);
    });
    expect(session.current()).toBe('b');
  });

  it('PlacesSession creates tokens lazily with expo-crypto by default', () => {
    const session = new PlacesSession();
    const first = session.current();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.current()).toBe(first);
    session.rotate();
    expect(session.current()).not.toBe(first);
  });

  it('useNetworkStatus reports offline from NetInfo', async () => {
    setNetworkState({ isConnected: false });
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current).toEqual({ isOffline: true });
  });

  it('wires TanStack online state to NetInfo, so queries refetch on reconnect', () => {
    wireOnlineManager();
    setNetworkState({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);
    setNetworkState({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('useApi outside the provider fails loudly', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderHook(() => useApi())).rejects.toThrow(
      'useApi must be used inside <ApiProvider>',
    );
  });

  it('ApiProvider creates its own query client and session when not given', async () => {
    const client = fakeClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider client={client}>{children}</ApiProvider>
    );
    const { result } = await renderHook(() => useApi(), { wrapper: Wrapper });
    expect(result.current.client).toBe(client);
    expect(result.current.session).toBeInstanceOf(PlacesSession);
  });
});
