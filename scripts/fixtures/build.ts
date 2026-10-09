/**
 * Builds every mock-mode fixture as raw Google-format JSON (test plan §2).
 * Pure and deterministic: `generate-fixtures.ts` writes the result to disk,
 * and the fixture tests compare it with the committed files.
 */
import { type LatLng, encodePolyline } from '@routes/routing-core';
import {
  type Leg,
  type Point,
  bump,
  compassOf,
  legsLengthM,
  legsToPoints,
  lengthOf,
  toLatLng,
  trapezoid,
  turnBetween,
} from './geometry';

/** Where every fixture trip starts: the mock "current location". */
export const FIXTURE_ORIGIN: LatLng = { lat: 39.7392, lng: -104.9903 };

/** Toll on a route: none, a USD price (possibly split across entries), or unknown. */
type TollSpec =
  { kind: 'none' } | { kind: 'usd'; entries: readonly number[] } | { kind: 'unknown' };

interface RouteSpec {
  durationSec: number;
  distanceM: number;
  description: string;
  toll: TollSpec;
  legs: Leg[];
}

/** Behaviours the mock provider applies instead of, or as well as, serving files. */
export type FixtureBehaviour = 'empty' | 'error500' | 'partialError' | 'delayMs';

interface TripSpec {
  placeId: string;
  searchText: string;
  name: string;
  address: string;
  destination: Point;
  /** Routes each `computeRoutes` call returns; null means that call fails with HTTP 500. */
  tolls: RouteSpec[] | null;
  avoidTolls: RouteSpec[] | null;
  behaviour?: FixtureBehaviour;
  delayMs?: number;
}

const NO_TOLL: TollSpec = { kind: 'none' };
const MILE_M = 1609.344;

/** Metres for a whole number of tenths of a mile, so the card shows that value. */
const miles = (mi: number): number => Math.round(mi * MILE_M);

function route(
  description: string,
  durationSec: number,
  distanceM: number,
  toll: TollSpec,
  legs: Leg[],
): RouteSpec {
  return { description, durationSec, distanceM, toll, legs };
}

const O: Point = { x: 0, y: 0 };

// Canonical trip: Current location → Union Station (test plan §2).
const UNION_STATION: Point = { x: 7200, y: 9600 };
const CANONICAL_A = route(
  'Hwy 12',
  1320,
  15772,
  // Two entries, so the proxy's toll sum is exercised: $2.50 + $1.25.
  { kind: 'usd', entries: [2.5, 1.25] },
  trapezoid(O, UNION_STATION, 15772, 1, ['Broadway', 'Hwy 12', 'Union Plaza']),
);
const CANONICAL_B = route(
  'Elm Ave & 3rd St',
  1620,
  17059,
  NO_TOLL,
  trapezoid(O, UNION_STATION, 17059, 1, ['Elm Ave', '3rd St', 'Union Plaza']),
);
const CANONICAL_C = route(
  'Main St',
  1860,
  14323,
  NO_TOLL,
  trapezoid(O, UNION_STATION, 14323, -1, ['Colfax Ave', 'Main St', 'Wynkoop St']),
);

const TWO_ROUTES: Point = { x: 6000, y: 8000 };
const TWO_R1 = route(
  'Lincoln Ave',
  1140,
  11500,
  NO_TOLL,
  trapezoid(O, TWO_ROUTES, 11500, 1, ['Grant St', 'Lincoln Ave', 'Test Way']),
);
const TWO_R2 = route(
  'River Rd',
  1380,
  12600,
  NO_TOLL,
  trapezoid(O, TWO_ROUTES, 12600, -1, ['Speer Blvd', 'River Rd', 'Test Way']),
);

const ONE_ROUTE: Point = { x: 3000, y: 4000 };
const ONE_R = route(
  'Oak St',
  720,
  6200,
  NO_TOLL,
  trapezoid(O, ONE_ROUTE, 6200, 1, ['Pearl St', 'Oak St', 'Test Way']),
);

const UNKNOWN_TOLL: Point = { x: 9000, y: 12000 };
const UNKNOWN_X = route(
  'Toll Rd 7',
  1440,
  miles(12),
  { kind: 'unknown' },
  trapezoid(O, UNKNOWN_TOLL, miles(12), 1, ['Logan St', 'Toll Rd 7', 'Test Way']),
);
const UNKNOWN_Y = route(
  'Federal Blvd',
  1800,
  miles(11),
  NO_TOLL,
  trapezoid(O, UNKNOWN_TOLL, miles(11), -1, ['8th Ave', 'Federal Blvd', 'Test Way']),
);

// Near-duplicates: N2 follows N1 except for a 10% bump, so they overlap ~90%.
const NEAR_DUPLICATES: Point = { x: 8000, y: 6000 };
const N1_LEGS = trapezoid(O, NEAR_DUPLICATES, 12500, 1, ['Downing St', 'Pine St', 'Test Way']);
const N1 = route('Pine St', 1260, 12500, { kind: 'usd', entries: [2] }, N1_LEGS);
const N2_LEGS = bump(N1_LEGS, 1, 1250, 150, 'Cedar Ave');
const N2 = route('Pine St & Cedar Ave', 1290, Math.round(legsLengthM(N2_LEGS)), NO_TOLL, N2_LEGS);
const N3 = route(
  'Lake Dr',
  1500,
  11800,
  NO_TOLL,
  trapezoid(O, NEAR_DUPLICATES, 11800, -1, ['York St', 'Lake Dr', 'Test Way']),
);
const N4 = route(
  'Ridge Rd',
  1380,
  14500,
  NO_TOLL,
  trapezoid(O, NEAR_DUPLICATES, 14500, 1, ['Josephine St', 'Ridge Rd', 'Test Way']),
);

const PARTIAL_ERROR: Point = { x: 5000, y: 5000 };
const PARTIAL_P1 = route(
  'Elm St',
  900,
  9000,
  NO_TOLL,
  trapezoid(O, PARTIAL_ERROR, 9000, 1, ['Clarkson St', 'Elm St', 'Test Way']),
);
const PARTIAL_P2 = route(
  'Birch St',
  1020,
  9600,
  NO_TOLL,
  trapezoid(O, PARTIAL_ERROR, 9600, -1, ['13th Ave', 'Birch St', 'Test Way']),
);

const NO_ROUTE: Point = { x: 4000, y: -3000 };
const UPSTREAM_ERROR: Point = { x: -5000, y: 2000 };

const TRIPS: readonly TripSpec[] = [
  {
    placeId: 'fixture-union-station',
    searchText: 'Union Station',
    name: 'Union Station',
    address: '100 Union Plaza',
    destination: UNION_STATION,
    tolls: [CANONICAL_A, CANONICAL_B],
    avoidTolls: [CANONICAL_B, CANONICAL_C],
  },
  {
    placeId: 'fixture-two-routes',
    searchText: 'Two Routes Test',
    name: 'Two Routes Test',
    address: '2 Test Way',
    destination: TWO_ROUTES,
    tolls: [TWO_R1, TWO_R2],
    avoidTolls: [TWO_R1, TWO_R2],
  },
  {
    placeId: 'fixture-one-route',
    searchText: 'One Route Test',
    name: 'One Route Test',
    address: '1 Test Way',
    destination: ONE_ROUTE,
    tolls: [ONE_R],
    avoidTolls: [ONE_R],
  },
  {
    placeId: 'fixture-unknown-toll',
    searchText: 'Unknown Toll Test',
    name: 'Unknown Toll Test',
    address: '7 Test Way',
    destination: UNKNOWN_TOLL,
    tolls: [UNKNOWN_X, UNKNOWN_Y],
    avoidTolls: [UNKNOWN_Y],
  },
  {
    placeId: 'fixture-near-duplicates',
    searchText: 'Near Duplicates Test',
    name: 'Near Duplicates Test',
    address: '4 Test Way',
    destination: NEAR_DUPLICATES,
    tolls: [N1, N2, N4],
    avoidTolls: [N3],
  },
  {
    placeId: 'fixture-no-route',
    searchText: 'No Route Test',
    name: 'No Route Test',
    address: '0 Test Way',
    destination: NO_ROUTE,
    tolls: [],
    avoidTolls: [],
    behaviour: 'empty',
  },
  {
    placeId: 'fixture-upstream-error',
    searchText: 'Error Test',
    name: 'Error Test',
    address: '500 Test Way',
    destination: UPSTREAM_ERROR,
    tolls: null,
    avoidTolls: null,
    behaviour: 'error500',
  },
  {
    placeId: 'fixture-partial-error',
    searchText: 'Partial Error Test',
    name: 'Partial Error Test',
    address: '501 Test Way',
    destination: PARTIAL_ERROR,
    tolls: null,
    avoidTolls: [PARTIAL_P1, PARTIAL_P2],
    behaviour: 'partialError',
  },
  {
    placeId: 'fixture-slow',
    searchText: 'Slow Test',
    name: 'Slow Test',
    address: '2000 Test Way',
    destination: UNION_STATION,
    tolls: [CANONICAL_A, CANONICAL_B],
    avoidTolls: [CANONICAL_B, CANONICAL_C],
    behaviour: 'delayMs',
    delayMs: 2000,
  },
];

/** Other places offered by the "Union" autocomplete fixture (test plan §2). */
const EXTRA_PLACES = [
  {
    placeId: 'fixture-union-street-market',
    name: 'Union Street Market',
    address: '42 Union St',
    destination: { x: 3600, y: 5800 },
  },
  {
    placeId: 'fixture-union-st-9th-ave',
    name: 'Union St & 9th Ave',
    address: 'Intersection',
    destination: { x: 5400, y: 8800 },
  },
];

/** Suggestions for queries starting "Union", with the test plan's distances. */
const UNION_SUGGESTIONS = [
  { placeId: 'fixture-union-station', name: 'Union Station', address: '100 Union Plaza', mi: 9.1 },
  {
    placeId: 'fixture-union-street-market',
    name: 'Union Street Market',
    address: '42 Union St',
    mi: 4.3,
  },
  {
    placeId: 'fixture-union-st-9th-ave',
    name: 'Union St & 9th Ave',
    address: 'Intersection',
    mi: 6.8,
  },
];

/** Google `Money` for a USD amount. */
function money(usd: number): { currencyCode: string; units: string; nanos: number } {
  const units = Math.floor(usd);
  return { currencyCode: 'USD', units: String(units), nanos: Math.round((usd - units) * 1e9) };
}

/** Navigation steps, one per leg, whose distances sum exactly to the route distance. */
function steps(spec: RouteSpec, destinationName: string): unknown[] {
  const lengths = spec.legs.map((leg) => Math.round(lengthOf(leg.from, leg.to)));
  const drift = spec.distanceM - lengths.reduce((sum, m) => sum + m, 0);
  lengths[lengths.length - 1]! += drift;
  return spec.legs.map((leg, i) => {
    const last = i === spec.legs.length - 1;
    const maneuver = i === 0 ? 'DEPART' : turnBetween(spec.legs[i - 1]!, leg);
    let instructions =
      i === 0
        ? `Head ${compassOf(leg)} on ${leg.street}`
        : maneuver === 'STRAIGHT'
          ? `Continue onto ${leg.street}`
          : `Turn ${maneuver === 'TURN_LEFT' ? 'left' : 'right'} onto ${leg.street}`;
    if (last) instructions += `\nDestination will be on the right: ${destinationName}`;
    return {
      distanceMeters: lengths[i],
      navigationInstruction: { maneuver, instructions },
    };
  });
}

/** One route of a `computeRoutes` body, limited to the proxy's field mask. */
function googleRoute(spec: RouteSpec, destinationName: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    distanceMeters: spec.distanceM,
    duration: `${spec.durationSec}s`,
    polyline: { encodedPolyline: encodePolyline(legsToPoints(FIXTURE_ORIGIN, spec.legs)) },
    description: spec.description,
    legs: [{ steps: steps(spec, destinationName) }],
  };
  if (spec.toll.kind === 'usd') {
    body.travelAdvisory = { tollInfo: { estimatedPrice: spec.toll.entries.map(money) } };
  } else if (spec.toll.kind === 'unknown') {
    body.travelAdvisory = { tollInfo: {} };
  }
  return body;
}

/** A `computeRoutes` body. Google returns `{}` when there is no route. */
function computeRoutesBody(routes: readonly RouteSpec[], destinationName: string): unknown {
  return routes.length === 0
    ? {}
    : { routes: routes.map((spec) => googleRoute(spec, destinationName)) };
}

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5;

function placeDetails(placeId: string, name: string, address: string, at: Point): unknown {
  const { lat, lng } = toLatLng(FIXTURE_ORIGIN, at);
  return {
    id: placeId,
    displayName: { text: name, languageCode: 'en' },
    formattedAddress: address,
    location: { latitude: round5(lat), longitude: round5(lng) },
  };
}

function prediction(placeId: string, name: string, address: string, distanceMeters: number) {
  return {
    placePrediction: {
      place: `places/${placeId}`,
      placeId,
      text: { text: `${name}, ${address}` },
      structuredFormat: { mainText: { text: name }, secondaryText: { text: address } },
      distanceMeters,
    },
  };
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Every fixture file, keyed by path relative to `fixtures/`, in a stable order. */
export function buildFixtures(): Map<string, unknown> {
  const files = new Map<string, unknown>();
  const routesIndex: Record<string, unknown> = {};
  const autocompleteIndex: { prefix: string; file: string }[] = [];
  const detailsIndex: Record<string, string> = {};

  const unionFile = 'places/autocomplete/union.json';
  files.set(unionFile, {
    suggestions: UNION_SUGGESTIONS.map((s) =>
      prediction(s.placeId, s.name, s.address, miles(s.mi)),
    ),
  });
  autocompleteIndex.push({ prefix: 'union', file: unionFile });

  for (const trip of TRIPS) {
    const entry: Record<string, unknown> = {};
    for (const call of ['tolls', 'avoidTolls'] as const) {
      const routes = trip[call];
      if (routes === null) continue; // this call fails with HTTP 500
      const file = `routes/${trip.placeId}.${call}.json`;
      files.set(file, computeRoutesBody(routes, trip.name));
      entry[call] = file;
    }
    if (trip.behaviour) entry.behaviour = trip.behaviour;
    if (trip.delayMs !== undefined) entry.delayMs = trip.delayMs;
    routesIndex[trip.placeId] = entry;

    const crowFliesM = Math.round(lengthOf(O, trip.destination));
    const autocompleteFile = `places/autocomplete/${slug(trip.searchText)}.json`;
    if (trip.placeId !== 'fixture-union-station') {
      files.set(autocompleteFile, {
        suggestions: [prediction(trip.placeId, trip.name, trip.address, crowFliesM)],
      });
      autocompleteIndex.push({ prefix: trip.searchText.toLowerCase(), file: autocompleteFile });
    }
  }

  const places = [...TRIPS, ...EXTRA_PLACES];
  for (const place of places) {
    const file = `places/details/${place.placeId}.json`;
    files.set(file, placeDetails(place.placeId, place.name, place.address, place.destination));
    detailsIndex[place.placeId] = file;
  }

  files.set('index.json', {
    description:
      'Mock provider fixtures. Generated by scripts/generate-fixtures.ts; do not edit by hand.',
    origin: { lat: FIXTURE_ORIGIN.lat, lng: FIXTURE_ORIGIN.lng },
    routes: {
      default: 'fixture-union-station',
      byPlaceId: routesIndex,
    },
    autocomplete: {
      match: 'Trimmed, lower-cased query starts with prefix; first match wins.',
      entries: autocompleteIndex,
    },
    details: detailsIndex,
  });
  return files;
}

/** File contents as written to disk. */
export const serializeFixture = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
