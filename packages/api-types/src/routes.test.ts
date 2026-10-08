import { ProviderRouteSchema, RoutesRequestSchema, RoutesResponseSchema } from './index';

// Google's documented example polyline; any valid encoding works here.
const POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

const validRequest = {
  origin: { lat: 38.8977, lng: -77.0365 },
  destination: { placeId: 'fixture-union-station', lat: 38.8973, lng: -77.0063 },
};

/** The canonical trip's routes (test plan §2), in proxy-normalized form. */
const canonicalRoutes = [
  {
    durationSec: 1320,
    distanceM: 15772,
    encodedPolyline: POLYLINE,
    description: 'Hwy 12',
    toll: { hasTolls: true, priceUSD: 3.75 },
    steps: [{ instruction: 'Head north on 1st St', maneuver: 'DEPART', distanceM: 120 }],
    source: 'tolls',
  },
  {
    durationSec: 1620,
    distanceM: 17059,
    encodedPolyline: POLYLINE,
    description: 'Elm Ave & 3rd St',
    toll: { hasTolls: false, priceUSD: null },
    steps: [],
    source: 'avoidTolls',
  },
  {
    durationSec: 1440,
    distanceM: 19312,
    encodedPolyline: POLYLINE,
    description: 'Toll Rd',
    toll: { hasTolls: true, priceUSD: null },
    steps: [{ instruction: 'Turn left onto Main St', maneuver: 'TURN_LEFT', distanceM: 800.5 }],
    source: 'tolls',
  },
];

describe('RoutesRequestSchema', () => {
  it('AT-01: a valid POST /routes body parses', () => {
    expect(RoutesRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('AT-01: a missing destination fails', () => {
    expect(RoutesRequestSchema.safeParse({ origin: validRequest.origin }).success).toBe(false);
  });

  it.each([
    ['lat above 90', { lat: 90.0001, lng: 0 }],
    ['lat below -90', { lat: -91, lng: 0 }],
    ['lng above 180', { lat: 0, lng: 180.5 }],
    ['lng below -180', { lat: 0, lng: -181 }],
    ['non-finite lat', { lat: Number.NaN, lng: 0 }],
  ])('AT-01: out-of-range coordinates fail (%s)', (_label, origin) => {
    expect(RoutesRequestSchema.safeParse({ ...validRequest, origin }).success).toBe(false);
  });

  it('AT-01: coordinates on the boundaries parse', () => {
    const origin = { lat: -90, lng: 180 };
    expect(RoutesRequestSchema.safeParse({ ...validRequest, origin }).success).toBe(true);
  });

  it('AT-01: extra unknown fields fail, at the top level and in a waypoint', () => {
    expect(RoutesRequestSchema.safeParse({ ...validRequest, mode: 'fastest' }).success).toBe(false);
    const origin = { ...validRequest.origin, name: 'Home' };
    expect(RoutesRequestSchema.safeParse({ ...validRequest, origin }).success).toBe(false);
  });

  it('AT-01: an empty placeId fails', () => {
    const destination = { ...validRequest.destination, placeId: '' };
    expect(RoutesRequestSchema.safeParse({ ...validRequest, destination }).success).toBe(false);
  });
});

describe('ProviderRouteSchema', () => {
  it('AT-02: accepts the canonical fixture routes, including unknown toll prices', () => {
    for (const route of canonicalRoutes) {
      expect(ProviderRouteSchema.parse(route)).toEqual(route);
    }
    expect(RoutesResponseSchema.parse({ routes: canonicalRoutes }).routes).toHaveLength(3);
  });

  it('AT-02: rejects a missing encodedPolyline', () => {
    const route: Record<string, unknown> = { ...canonicalRoutes[0] };
    delete route.encodedPolyline;
    expect(ProviderRouteSchema.safeParse(route).success).toBe(false);
  });

  it('AT-02: rejects an unknown source and a negative toll price', () => {
    expect(ProviderRouteSchema.safeParse({ ...canonicalRoutes[0], source: 'both' }).success).toBe(
      false,
    );
    const toll = { hasTolls: true, priceUSD: -1 };
    expect(ProviderRouteSchema.safeParse({ ...canonicalRoutes[0], toll }).success).toBe(false);
  });
});
