import nock from 'nock';
import { type FastifyInstance } from 'fastify';
import { RoutesResponseSchema } from '@routes/api-types';
import { rankRoutes, toCents } from '@routes/routing-core';
import { buildApp, loadConfig } from '../index';
import { createProviders } from '../providers';
import { MockRoutesProvider, realSleep } from './mock';

const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const ORIGIN = { lat: 39.7392, lng: -104.9903 };

let app: FastifyInstance;
const sleep = jest.fn((_ms: number) => Promise.resolve());

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
beforeEach(() => {
  sleep.mockClear();
  const config = loadConfig({ NODE_ENV: 'test', PROVIDER: 'mock', LOG_LEVEL: 'silent' });
  app = buildApp(config, {
    providers: { ...createProviders(config), routes: new MockRoutesProvider({ sleep }) },
  });
});
afterEach(async () => {
  await app.close();
});

const postRoutes = (placeId?: string) =>
  app.inject({
    method: 'POST',
    url: '/routes',
    headers: { 'x-device-id': DEVICE_ID },
    payload: {
      origin: ORIGIN,
      destination: { ...(placeId ? { placeId } : {}), lat: 39.8, lng: -104.9 },
    },
  });

async function routesFor(placeId?: string) {
  const response = await postRoutes(placeId);
  expect(response.statusCode).toBe(200);
  return RoutesResponseSchema.parse(response.json()).routes;
}

describe('PX-MOCK-01: PROVIDER=mock serves the §2 fixtures with no network access', () => {
  it('canonical: 4 routes (B from both sources) that normalize to the canonical values', async () => {
    const routes = await routesFor('fixture-union-station');
    expect(
      routes.map((r) => [r.description, r.source, r.durationSec, r.distanceM, r.toll]),
    ).toEqual([
      ['Hwy 12', 'tolls', 1320, 15772, { hasTolls: true, priceUSD: 3.75 }],
      ['Elm Ave & 3rd St', 'tolls', 1620, 17059, { hasTolls: false, priceUSD: null }],
      ['Elm Ave & 3rd St', 'avoidTolls', 1620, 17059, { hasTolls: false, priceUSD: null }],
      ['Main St', 'avoidTolls', 1860, 14323, { hasTolls: false, priceUSD: null }],
    ]);
    const ranked = rankRoutes(routes, 'fastest').options;
    expect(ranked.map((o) => toCents(o.tripUSD!))).toEqual([512, 148, 125]);
    expect(routes[0]!.steps[0]).toMatchObject({ maneuver: 'DEPART' });
  });

  it('a destination without a place ID, or an unknown one, gets the canonical fixture', async () => {
    const canonical = await routesFor('fixture-union-station');
    expect(await routesFor()).toEqual(canonical);
    expect(await routesFor('ChIJsomethingReal')).toEqual(canonical);
  });

  it('two routes, one route, unknown toll and near-duplicates', async () => {
    expect(rankRoutes(await routesFor('fixture-two-routes'), 'fastest').onlyN).toBe(2);
    expect(rankRoutes(await routesFor('fixture-one-route'), 'fastest').onlyN).toBe(1);
    const unknown = await routesFor('fixture-unknown-toll');
    expect(unknown.find((r) => r.toll.hasTolls)).toMatchObject({
      durationSec: 1440,
      toll: { hasTolls: true, priceUSD: null },
    });
    const near = await routesFor('fixture-near-duplicates');
    expect(near).toHaveLength(4);
    expect(rankRoutes(near, 'fastest').options).toHaveLength(3);
  });

  it('empty → 404 NO_ROUTE; error500 → 502 UPSTREAM_ERROR; partialError → the avoidTolls routes', async () => {
    const none = await postRoutes('fixture-no-route');
    expect(none.statusCode).toBe(404);
    expect(none.json().error.code).toBe('NO_ROUTE');

    const failed = await postRoutes('fixture-upstream-error');
    expect(failed.statusCode).toBe(502);
    expect(failed.json().error.code).toBe('UPSTREAM_ERROR');

    const partial = await routesFor('fixture-partial-error');
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.every((r) => r.source === 'avoidTolls')).toBe(true);
  });

  it('delayMs: the slow fixture waits 2 s, then serves the canonical routes', async () => {
    const routes = await routesFor('fixture-slow');
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(routes.map((r) => r.description)).toEqual([
      'Hwy 12',
      'Elm Ave & 3rd St',
      'Elm Ave & 3rd St',
      'Main St',
    ]);
    await routesFor('fixture-union-station');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('the default mock provider reads the repo fixtures and really sleeps', async () => {
    const provider = new MockRoutesProvider();
    const { routes } = await provider.computeRoutes({
      origin: ORIGIN,
      destination: { placeId: 'fixture-union-station', lat: 39.8, lng: -104.9 },
    });
    expect(routes).toHaveLength(4);
    const started = Date.now();
    await realSleep(20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  it('createProviders picks the Google provider when configured', () => {
    const google = createProviders(
      loadConfig({ NODE_ENV: 'test', PROVIDER: 'google', GOOGLE_MAPS_API_KEY: 'k' }),
    );
    expect(google.routes.constructor.name).toBe('GoogleRoutesProvider');
    const mock = createProviders(loadConfig({ NODE_ENV: 'test' }));
    expect(mock.routes).toBeInstanceOf(MockRoutesProvider);
  });
});
