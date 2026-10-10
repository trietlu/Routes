import * as Location from 'expo-location';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { type ProviderRoute, type RoutesRequest, type RoutesResponse } from '@routes/api-types';
import { type ApiClient } from '../api';
import { type Storage } from '../storage';
import { renderApp, useTestApi, useTestStorage } from './appHarness';
import { fixtureRoutes } from './fixtures';

const mocked = Location as unknown as Record<string, jest.Mock>;

/** A fake proxy: fixture routes by destination place ID, or `routes` when given. */
export function fakeRoutesClient(routes?: ProviderRoute[]) {
  return {
    routes: jest.fn(async (request: RoutesRequest): Promise<RoutesResponse> => ({
      routes: routes ?? fixtureRoutes(request.destination.placeId ?? 'fixture-union-station'),
    })),
    autocomplete: jest.fn(async () => ({ suggestions: [] })),
    details: jest.fn(async () => ({ placeId: 'p', name: 'n', address: 'a', lat: 0, lng: 0 })),
  } satisfies ApiClient;
}

/** Location granted at the canonical origin, with a street address. */
export function grantLocation(): void {
  mocked.getForegroundPermissionsAsync!.mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  });
  mocked.getCurrentPositionAsync!.mockResolvedValue({
    coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 },
    timestamp: 0,
  });
  mocked.reverseGeocodeAsync!.mockResolvedValue([{ streetNumber: '1437', street: 'Bannock St' }]);
}

/** Home → tap Union Station (a recent) → Results. */
export async function openUnionResults(
  client: ApiClient = fakeRoutesClient(),
  seed?: (storage: Storage) => Promise<void>,
): Promise<Storage> {
  useTestApi(client);
  const storage = await useTestStorage(async (s) => {
    await s.preferences.setLocationPromptShown(true);
    await s.places.addRecent({
      name: 'Union Station',
      address: '100 Union Plaza',
      placeId: 'fixture-union-station',
      lat: 39.8255,
      lng: -104.906,
    });
    await seed?.(s);
  });
  await renderApp('/');
  await waitFor(() =>
    expect(screen.getByTestId('field-from')).toHaveProp(
      'accessibilityLabel',
      'From: Current location, 1437 Bannock St',
    ),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Union Station, 100 Union Plaza' }));
  await screen.findByTestId('route-card-A');
  return storage;
}

/** …then open route `letter`'s detail. */
export async function openDetail(
  letter: 'A' | 'B' | 'C' = 'A',
  client?: ApiClient,
  seed?: (storage: Storage) => Promise<void>,
): Promise<Storage> {
  const storage = await openUnionResults(client, seed);
  await fireEvent.press(screen.getByTestId(`route-card-${letter}`));
  await fireEvent.press(screen.getByRole('button', { name: `Go with route ${letter}` }));
  await screen.findByTestId('cost-card');
  return storage;
}
