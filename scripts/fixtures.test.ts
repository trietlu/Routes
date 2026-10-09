import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import {
  AutocompleteResponseSchema,
  PlaceDetailsSchema,
  type ProviderRoute,
  ProviderRouteSchema,
  type RouteSource,
} from '@routes/api-types';
import {
  decodePolyline,
  formatDiff,
  polylineLengthM,
  rankRoutes,
  routeOverlap,
  sumTollPricesUSD,
  toCents,
} from '@routes/routing-core';
import { buildFixtures, serializeFixture } from './fixtures/build';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/** Minimal raw shapes, limited to the proxy's field masks. */
const MoneySchema = z.object({
  currencyCode: z.string(),
  units: z.string().regex(/^\d+$/),
  nanos: z.number().int().min(0).max(999_999_999),
});
const GoogleRouteSchema = z.strictObject({
  distanceMeters: z.number().int().nonnegative(),
  duration: z.string().regex(/^\d+s$/),
  polyline: z.strictObject({ encodedPolyline: z.string().min(1) }),
  description: z.string(),
  travelAdvisory: z
    .strictObject({
      tollInfo: z.strictObject({ estimatedPrice: z.array(MoneySchema).optional() }).optional(),
    })
    .optional(),
  legs: z.array(
    z.strictObject({
      steps: z.array(
        z.strictObject({
          distanceMeters: z.number().int().nonnegative(),
          navigationInstruction: z.strictObject({ maneuver: z.string(), instructions: z.string() }),
        }),
      ),
    }),
  ),
});
type GoogleRoute = z.infer<typeof GoogleRouteSchema>;
const ComputeRoutesSchema = z.strictObject({ routes: z.array(GoogleRouteSchema).optional() });
const GoogleAutocompleteSchema = z.strictObject({
  suggestions: z.array(
    z.strictObject({
      placePrediction: z.strictObject({
        place: z.string(),
        placeId: z.string(),
        text: z.strictObject({ text: z.string() }),
        structuredFormat: z.strictObject({
          mainText: z.strictObject({ text: z.string() }),
          secondaryText: z.strictObject({ text: z.string() }),
        }),
        distanceMeters: z.number().int().nonnegative(),
      }),
    }),
  ),
});
const GoogleDetailsSchema = z.strictObject({
  id: z.string(),
  displayName: z.strictObject({ text: z.string(), languageCode: z.string() }),
  formattedAddress: z.string(),
  location: z.strictObject({ latitude: z.number(), longitude: z.number() }),
});
const IndexSchema = z.strictObject({
  description: z.string(),
  origin: z.strictObject({ lat: z.number(), lng: z.number() }),
  routes: z.strictObject({
    default: z.string(),
    byPlaceId: z.record(
      z.string(),
      z.strictObject({
        tolls: z.string().optional(),
        avoidTolls: z.string().optional(),
        behaviour: z.enum(['empty', 'error500', 'partialError', 'delayMs']).optional(),
        delayMs: z.number().int().positive().optional(),
      }),
    ),
  }),
  autocomplete: z.strictObject({
    match: z.string(),
    entries: z.array(z.strictObject({ prefix: z.string(), file: z.string() })),
  }),
  details: z.record(z.string(), z.string()),
});

/** Proxy-style normalization (technical design § Toll normalization), enough to validate. */
function normalize(raw: GoogleRoute, source: RouteSource): ProviderRoute {
  const tollInfo = raw.travelAdvisory?.tollInfo;
  return ProviderRouteSchema.parse({
    durationSec: Number(raw.duration.slice(0, -1)),
    distanceM: raw.distanceMeters,
    encodedPolyline: raw.polyline.encodedPolyline,
    description: raw.description,
    toll: tollInfo
      ? { hasTolls: true, priceUSD: sumTollPricesUSD(tollInfo.estimatedPrice) }
      : { hasTolls: false, priceUSD: null },
    steps: raw.legs.flatMap((leg) =>
      leg.steps.map((step) => ({
        instruction: step.navigationInstruction.instructions,
        maneuver: step.navigationInstruction.maneuver,
        distanceM: step.distanceMeters,
      })),
    ),
    source,
  });
}

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'));
const index = IndexSchema.parse(readJson('index.json'));

function rawRoutes(placeId: string, source: RouteSource): GoogleRoute[] {
  const file = index.routes.byPlaceId[placeId]?.[source];
  if (!file) return [];
  return ComputeRoutesSchema.parse(readJson(file)).routes ?? [];
}

/** Both calls' routes, normalized and merged as the proxy will return them. */
const routesFor = (placeId: string): ProviderRoute[] =>
  (['tolls', 'avoidTolls'] as const).flatMap((source) =>
    rawRoutes(placeId, source).map((raw) => normalize(raw, source)),
  );

function jsonFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsonFilesUnder(path);
    return entry.name.endsWith('.json') ? [relative(FIXTURES_DIR, path).split('\\').join('/')] : [];
  });
}

describe('fixture generator', () => {
  it('is deterministic and the committed files match its output (no diff on re-run)', () => {
    const first = buildFixtures();
    const second = buildFixtures();
    expect([...second.keys()]).toEqual([...first.keys()]);
    for (const [file, value] of first) {
      expect(serializeFixture(second.get(file))).toBe(serializeFixture(value));
      expect(readFileSync(join(FIXTURES_DIR, file), 'utf8')).toBe(serializeFixture(value));
    }
    expect(jsonFilesUnder(FIXTURES_DIR).sort()).toEqual([...first.keys()].sort());
  });

  it('index.json references only files that exist', () => {
    const referenced = [
      ...Object.values(index.routes.byPlaceId).flatMap((entry) =>
        [entry.tolls, entry.avoidTolls].filter((file): file is string => file !== undefined),
      ),
      ...index.autocomplete.entries.map((entry) => entry.file),
      ...Object.values(index.details),
    ];
    const onDisk = new Set(jsonFilesUnder(FIXTURES_DIR));
    for (const file of referenced) expect(onDisk.has(file)).toBe(true);
    expect(index.routes.byPlaceId[index.routes.default]).toBeDefined();
  });
});

describe('route fixtures', () => {
  const placeIds = Object.keys(index.routes.byPlaceId);

  it('every route normalizes through the api-types schema, with consistent geometry and steps', () => {
    let count = 0;
    for (const placeId of placeIds) {
      for (const route of routesFor(placeId)) {
        count++;
        const lengthM = polylineLengthM(decodePolyline(route.encodedPolyline));
        expect(Math.abs(lengthM - route.distanceM) / route.distanceM).toBeLessThan(0.01);
        expect(route.steps.reduce((sum, step) => sum + step.distanceM, 0)).toBe(route.distanceM);
        expect(route.steps[0]!.maneuver).toBe('DEPART');
      }
    }
    expect(count).toBeGreaterThan(15);
  });

  it('every route starts at the fixture origin', () => {
    for (const placeId of placeIds) {
      for (const route of routesFor(placeId)) {
        const [start] = decodePolyline(route.encodedPolyline);
        expect(start!.lat).toBeCloseTo(index.origin.lat, 4);
        expect(start!.lng).toBeCloseTo(index.origin.lng, 4);
      }
    }
  });

  it('canonical raw data matches test plan §2', () => {
    const tolls = rawRoutes('fixture-union-station', 'tolls').map((r) => normalize(r, 'tolls'));
    const avoid = rawRoutes('fixture-union-station', 'avoidTolls').map((r) =>
      normalize(r, 'avoidTolls'),
    );
    const summary = (r: ProviderRoute) => [r.durationSec, r.distanceM, r.description, r.toll];
    expect(tolls.map(summary)).toEqual([
      [1320, 15772, 'Hwy 12', { hasTolls: true, priceUSD: 3.75 }],
      [1620, 17059, 'Elm Ave & 3rd St', { hasTolls: false, priceUSD: null }],
    ]);
    expect(avoid.map(summary)).toEqual([
      [1620, 17059, 'Elm Ave & 3rd St', { hasTolls: false, priceUSD: null }],
      [1860, 14323, 'Main St', { hasTolls: false, priceUSD: null }],
    ]);
    // Canonical B appears in both calls with identical geometry.
    expect(avoid[0]!.encodedPolyline).toBe(tolls[1]!.encodedPolyline);
    // A's toll is split across two estimatedPrice entries.
    expect(
      rawRoutes('fixture-union-station', 'tolls')[0]!.travelAdvisory!.tollInfo!.estimatedPrice,
    ).toHaveLength(2);
  });

  it('canonical routes are distinct (overlap < 50%) and rank to the test plan values', () => {
    const [a, b, , c] = routesFor('fixture-union-station').map((r) =>
      decodePolyline(r.encodedPolyline),
    );
    expect(routeOverlap(a!, b!)).toBeLessThan(0.5);
    expect(routeOverlap(a!, c!)).toBeLessThan(0.5);
    expect(routeOverlap(b!, c!)).toBeLessThan(0.5);

    const fastest = rankRoutes(routesFor('fixture-union-station'), 'fastest').options;
    expect(fastest.map((o) => o.viaLabel)).toEqual(['Hwy 12', 'Elm Ave & 3rd St', 'Main St']);
    expect(fastest.map((o) => toCents(o.tripUSD!))).toEqual([512, 148, 125]);
    expect(fastest.slice(1).map((o) => formatDiff(o.diff!))).toEqual([
      '5 min slower · saves $3.64',
      '9 min slower · saves $3.87',
    ]);
    const cheapest = rankRoutes(routesFor('fixture-union-station'), 'cheapest').options;
    expect(cheapest.slice(1).map((o) => formatDiff(o.diff!))).toEqual([
      '4 min faster · $0.23 more',
      '9 min faster · $3.87 more',
    ]);
  });

  it('the slow fixture serves the canonical routes after 2 s', () => {
    expect(index.routes.byPlaceId['fixture-slow']).toMatchObject({
      behaviour: 'delayMs',
      delayMs: 2000,
    });
    // Same routes; only the arrival text names the Slow Test place.
    const withoutSteps = (routes: ProviderRoute[]) =>
      routes.map((route) => ({ ...route, steps: [] }));
    expect(withoutSteps(routesFor('fixture-slow'))).toEqual(
      withoutSteps(routesFor('fixture-union-station')),
    );
  });

  it('two-routes and one-route fixtures yield "Only 2" and "Only 1"', () => {
    const two = routesFor('fixture-two-routes');
    expect(
      routeOverlap(
        decodePolyline(two[0]!.encodedPolyline),
        decodePolyline(two[1]!.encodedPolyline),
      ),
    ).toBeLessThan(0.5);
    expect(rankRoutes(two, 'fastest').onlyN).toBe(2);
    expect(rankRoutes(two, 'cheapest').onlyN).toBe(2);
    expect(rankRoutes(routesFor('fixture-one-route'), 'fastest').onlyN).toBe(1);
  });

  it('unknown-toll fixture: X has tolls with no price (24 min, 12.0 mi); Y has none (30 min, 11.0 mi)', () => {
    const routes = routesFor('fixture-unknown-toll');
    const x = routes.find((r) => r.toll.hasTolls)!;
    const y = routes.find((r) => !r.toll.hasTolls)!;
    expect(x).toMatchObject({ durationSec: 1440, toll: { hasTolls: true, priceUSD: null } });
    expect(y).toMatchObject({ durationSec: 1800 });
    expect((x.distanceM / 1609.344).toFixed(1)).toBe('12.0');
    expect((y.distanceM / 1609.344).toFixed(1)).toBe('11.0');
    const cheapest = rankRoutes(routes, 'cheapest');
    expect(cheapest.options.map((o) => o.tollUnknown)).toEqual([false, true]);
    expect(formatDiff(cheapest.options[1]!.diff!)).toBe('6 min faster · cost unknown');
  });

  it('near-duplicates fixture: 4 routes, two overlapping about 90% → 3 shown', () => {
    const routes = routesFor('fixture-near-duplicates');
    expect(routes).toHaveLength(4);
    const lines = routes.map((r) => decodePolyline(r.encodedPolyline));
    const pairs: [number, number, number][] = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        pairs.push([i, j, routeOverlap(lines[i]!, lines[j]!)]);
      }
    }
    const high = pairs.filter(([, , overlap]) => overlap >= 0.5);
    expect(high).toHaveLength(1);
    expect(high[0]![2]).toBeGreaterThanOrEqual(0.85);
    expect(high[0]![2]).toBeLessThanOrEqual(0.95);
    for (const mode of ['fastest', 'cheapest'] as const) {
      expect(rankRoutes(routes, mode).options).toHaveLength(3);
    }
  });

  it('no-route fixture returns {} for both calls; error fixtures have the failing call missing', () => {
    expect(readJson('routes/fixture-no-route.tolls.json')).toEqual({});
    expect(readJson('routes/fixture-no-route.avoidTolls.json')).toEqual({});
    expect(index.routes.byPlaceId['fixture-no-route']!.behaviour).toBe('empty');
    expect(index.routes.byPlaceId['fixture-upstream-error']).toEqual({ behaviour: 'error500' });
    const partial = index.routes.byPlaceId['fixture-partial-error']!;
    expect(partial.behaviour).toBe('partialError');
    expect(partial.tolls).toBeUndefined();
    expect(routesFor('fixture-partial-error').length).toBeGreaterThan(0);
  });
});

describe('places fixtures', () => {
  function suggestionsFor(query: string) {
    const q = query.trim().toLowerCase();
    const entry = index.autocomplete.entries.find((e) => q.startsWith(e.prefix));
    if (!entry) return [];
    const raw = GoogleAutocompleteSchema.parse(readJson(entry.file));
    return AutocompleteResponseSchema.parse({
      suggestions: raw.suggestions.map(({ placePrediction: p }) => ({
        placeId: p.placeId,
        primaryText: p.structuredFormat.mainText.text,
        secondaryText: p.structuredFormat.secondaryText.text,
        distanceMeters: p.distanceMeters,
      })),
    }).suggestions;
  }

  it('a query starting "Union" returns the three Union places with 9.1, 4.3 and 6.8 mi', () => {
    const suggestions = suggestionsFor('Union');
    expect(suggestions.map((s) => [s.primaryText, s.secondaryText])).toEqual([
      ['Union Station', '100 Union Plaza'],
      ['Union Street Market', '42 Union St'],
      ['Union St & 9th Ave', 'Intersection'],
    ]);
    expect(suggestions.map((s) => (s.distanceMeters! / 1609.344).toFixed(1))).toEqual([
      '9.1',
      '4.3',
      '6.8',
    ]);
    expect(suggestionsFor('union sta')[0]!.placeId).toBe('fixture-union-station');
  });

  it('each edge-case search text returns its fixture place', () => {
    const cases: [string, string][] = [
      ['Two Routes Test', 'fixture-two-routes'],
      ['One Route Test', 'fixture-one-route'],
      ['Unknown Toll Test', 'fixture-unknown-toll'],
      ['Near Duplicates Test', 'fixture-near-duplicates'],
      ['No Route Test', 'fixture-no-route'],
      ['Error Test', 'fixture-upstream-error'],
      ['Partial Error Test', 'fixture-partial-error'],
      ['Slow Test', 'fixture-slow'],
    ];
    for (const [text, placeId] of cases) {
      expect(suggestionsFor(text).map((s) => s.placeId)).toEqual([placeId]);
      expect(index.routes.byPlaceId[placeId]).toBeDefined();
    }
    expect(suggestionsFor('zzz')).toEqual([]);
  });

  it('every place has details that normalize through the api-types schema', () => {
    for (const [placeId, file] of Object.entries(index.details)) {
      const raw = GoogleDetailsSchema.parse(readJson(file));
      const details = PlaceDetailsSchema.parse({
        placeId: raw.id,
        name: raw.displayName.text,
        address: raw.formattedAddress,
        lat: raw.location.latitude,
        lng: raw.location.longitude,
      });
      expect(details.placeId).toBe(placeId);
    }
    const suggested = index.autocomplete.entries.flatMap((entry) =>
      GoogleAutocompleteSchema.parse(readJson(entry.file)).suggestions.map(
        (s) => s.placePrediction.placeId,
      ),
    );
    for (const placeId of suggested) expect(index.details[placeId]).toBeDefined();
  });

  it('each route fixture ends at its destination place', () => {
    for (const placeId of Object.keys(index.routes.byPlaceId)) {
      const details = GoogleDetailsSchema.parse(readJson(index.details[placeId]!));
      for (const route of routesFor(placeId)) {
        const points = decodePolyline(route.encodedPolyline);
        const end = points[points.length - 1]!;
        expect(end.lat).toBeCloseTo(details.location.latitude, 4);
        expect(end.lng).toBeCloseTo(details.location.longitude, 4);
      }
    }
  });
});
