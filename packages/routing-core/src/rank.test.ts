import {
  MAX_OPTIONS,
  OVERLAP_THRESHOLD,
  type RouteInput,
  encodePolyline,
  isNearDuplicate,
  rankRoutes,
  toCents,
} from './index';
import { walk } from './testRoutes';

const DC = { lat: 38.8977, lng: -77.0365 };

/** Distinct geometries between the same two points, 6 km east and 6 km north. */
const VIA_HWY = encodePolyline(
  walk(DC, [
    { eastM: 6000, northM: 0 },
    { eastM: 0, northM: 6000 },
  ]),
);
const VIA_ELM = encodePolyline(
  walk(DC, [
    { eastM: 3000, northM: 0 },
    { eastM: 0, northM: 6000 },
    { eastM: 3000, northM: 0 },
  ]),
);
const VIA_MAIN = encodePolyline(
  walk(DC, [
    { eastM: 0, northM: 6000 },
    { eastM: 6000, northM: 0 },
  ]),
);

function route(overrides: Partial<RouteInput>): RouteInput {
  return {
    durationSec: 600,
    distanceM: 10_000,
    encodedPolyline: VIA_HWY,
    description: 'Somewhere',
    toll: { hasTolls: false, priceUSD: null },
    steps: [],
    source: 'tolls',
    ...overrides,
  };
}

/** Test plan §2: A (tolls), B (both sources, same geometry), C (avoidTolls). */
const A = route({
  durationSec: 1320,
  distanceM: 15772,
  encodedPolyline: VIA_HWY,
  description: 'Hwy 12',
  toll: { hasTolls: true, priceUSD: 3.75 },
  steps: [{ instruction: 'Head east', maneuver: 'DEPART', distanceM: 6000 }],
});
const B = route({
  durationSec: 1620,
  distanceM: 17059,
  encodedPolyline: VIA_ELM,
  description: 'Elm Ave & 3rd St',
});
const B_AVOID = { ...B, source: 'avoidTolls' as const };
const C = route({
  durationSec: 1860,
  distanceM: 14323,
  encodedPolyline: VIA_MAIN,
  description: 'Main St',
  source: 'avoidTolls',
});
const CANONICAL = [A, B, B_AVOID, C];

/** Parallel east-west lines `spacingM` apart; > 20 m apart means distinct. */
function parallel(count: number, spacingM: number, lengthM = 3000, vertexEveryM = 100): string[] {
  return Array.from({ length: count }, (_, i) =>
    encodePolyline(
      walk(
        { lat: DC.lat + (i * spacingM) / 111_195, lng: DC.lng },
        [{ eastM: lengthM, northM: 0 }],
        vertexEveryM,
      ),
    ),
  );
}

const via = (result: ReturnType<typeof rankRoutes>): string[] =>
  result.options.map((option) => option.viaLabel);

describe('rankRoutes — canonical fixture', () => {
  it('RC-RANK-01: Fastest orders A, B, C with the test plan costs and diffs', () => {
    const { options, onlyN } = rankRoutes(CANONICAL, 'fastest');
    expect(onlyN).toBeNull();
    expect(via({ options, onlyN })).toEqual(['Hwy 12', 'Elm Ave & 3rd St', 'Main St']);
    expect(options.map((o) => o.id)).toEqual(['A', 'B', 'C']);
    expect(options.map((o) => o.isTopPick)).toEqual([true, false, false]);
    expect(options.map((o) => toCents(o.fuelUSD))).toEqual([137, 148, 125]);
    expect(options.map((o) => toCents(o.tripUSD!))).toEqual([512, 148, 125]);
    expect(options[0]!.fuelUSD).toBeCloseTo(1.37204, 4);
    expect(options[1]!.fuelUSD).toBeCloseTo(1.484, 4);
    expect(options[2]!.fuelUSD).toBeCloseTo(1.24599, 4);
    // "5 min slower · saves $3.64" and "9 min slower · saves $3.87"
    expect(options.map((o) => o.diff)).toEqual([
      null,
      { minutes: 5, cents: -364 },
      { minutes: 9, cents: -387 },
    ]);
  });

  it('RC-RANK-02: Cheapest orders C, B, A with the test plan diffs', () => {
    const { options, onlyN } = rankRoutes(CANONICAL, 'cheapest');
    expect(onlyN).toBeNull();
    expect(via({ options, onlyN })).toEqual(['Main St', 'Elm Ave & 3rd St', 'Hwy 12']);
    expect(options.map((o) => toCents(o.tripUSD!))).toEqual([125, 148, 512]);
    // "4 min faster · $0.23 more" and "9 min faster · $3.87 more"
    expect(options.map((o) => o.diff)).toEqual([
      null,
      { minutes: -4, cents: 23 },
      { minutes: -9, cents: 387 },
    ]);
  });

  it('applies the given vehicle (40 mpg, $4.00 → trips $4.73, $1.06, $0.89)', () => {
    const vehicle = { mpg: 40, pricePerGallon: 4 };
    const { options } = rankRoutes(CANONICAL, 'fastest', vehicle);
    expect(options.map((o) => toCents(o.tripUSD!))).toEqual([473, 106, 89]);
  });

  it('carries the card fields through from the provider route', () => {
    const top = rankRoutes(CANONICAL, 'fastest').options[0]!;
    expect(top).toMatchObject({
      id: 'A',
      polyline: VIA_HWY,
      durationSec: 1320,
      distanceM: 15772,
      viaLabel: 'Hwy 12',
      steps: A.steps,
      hasTolls: true,
      tollUnknown: false,
      tollUSD: 3.75,
      diff: null,
      isTopPick: true,
    });
  });

  it('is deterministic and does not mutate its input', () => {
    const input = [C, B_AVOID, A, B];
    const copy = [...input];
    const first = rankRoutes(input, 'cheapest');
    expect(rankRoutes(input, 'cheapest')).toEqual(first);
    expect(input).toEqual(copy);
  });
});

describe('rankRoutes — tie-breakers and sources', () => {
  const lines = parallel(3, 1000);

  it('RC-RANK-03: Cheapest tie on cost is broken by duration', () => {
    const slow = route({ description: 'slow', durationSec: 900, encodedPolyline: lines[0] });
    const fast = route({ description: 'fast', durationSec: 700, encodedPolyline: lines[1] });
    expect(via(rankRoutes([slow, fast], 'cheapest'))).toEqual(['fast', 'slow']);
  });

  it('RC-RANK-04: Fastest tie on duration is broken by distance', () => {
    const long = route({ description: 'long', distanceM: 12_000, encodedPolyline: lines[0] });
    const short = route({ description: 'short', distanceM: 11_000, encodedPolyline: lines[1] });
    expect(via(rankRoutes([long, short], 'fastest'))).toEqual(['short', 'long']);
  });

  it('a full tie keeps input order', () => {
    const first = route({ description: 'first', encodedPolyline: lines[0] });
    const second = route({ description: 'second', encodedPolyline: lines[1] });
    expect(via(rankRoutes([first, second], 'fastest'))).toEqual(['first', 'second']);
    expect(via(rankRoutes([first, second], 'cheapest'))).toEqual(['first', 'second']);
  });

  it('RC-RANK-05: Cheapest ranks unknown-toll routes after all priced routes, even with lower fuel', () => {
    const unknownFast = route({
      description: 'unknown fast',
      durationSec: 500,
      distanceM: 1000,
      toll: { hasTolls: true, priceUSD: null },
      encodedPolyline: lines[0],
    });
    const unknownSlow = route({
      description: 'unknown slow',
      durationSec: 800,
      distanceM: 1000,
      toll: { hasTolls: true, priceUSD: null },
      encodedPolyline: lines[1],
    });
    const priced = route({
      description: 'priced',
      durationSec: 900,
      distanceM: 30_000,
      toll: { hasTolls: true, priceUSD: 10 },
      encodedPolyline: lines[2],
    });
    const { options } = rankRoutes([unknownSlow, unknownFast, priced], 'cheapest');
    expect(options.map((o) => o.viaLabel)).toEqual(['priced', 'unknown fast', 'unknown slow']);
    expect(options[1]).toMatchObject({ tollUnknown: true, tripUSD: null, tollUSD: null });
    // The cost part of the diff is unknown when either toll is unknown.
    expect(options[1]!.diff).toEqual({ minutes: -7, cents: null });
    expect(options[2]!.diff).toEqual({ minutes: -2, cents: null });
  });

  it('a diff has null cents when the top pick toll is unknown', () => {
    const unknown = route({
      description: 'unknown',
      durationSec: 600,
      toll: { hasTolls: true, priceUSD: null },
      encodedPolyline: lines[0],
    });
    const free = route({ description: 'free', durationSec: 900, encodedPolyline: lines[1] });
    expect(rankRoutes([unknown, free], 'fastest').options[1]!.diff).toEqual({
      minutes: 5,
      cents: null,
    });
  });

  it('RC-RANK-06: both modes include routes from the avoidTolls source', () => {
    expect(rankRoutes([A, C], 'cheapest').options[0]!.viaLabel).toBe('Main St');
    expect(via(rankRoutes([A, C], 'fastest'))).toEqual(['Hwy 12', 'Main St']);
    expect(via(rankRoutes([C], 'cheapest'))).toEqual(['Main St']);
  });
});

describe('rankRoutes — near-duplicates', () => {
  it('RC-DEDUP-01: canonical B, present in both sources, appears once', () => {
    for (const mode of ['fastest', 'cheapest'] as const) {
      const labels = via(rankRoutes(CANONICAL, mode));
      expect(labels.filter((label) => label === 'Elm Ave & 3rd St')).toHaveLength(1);
      expect(labels).toHaveLength(3);
    }
  });

  it('RC-DEDUP-02: of two overlapping routes, the better-ranked one for the current mode is kept', () => {
    const [shared, other] = parallel(2, 1000);
    const tollFast = route({
      description: 'toll fast',
      durationSec: 600,
      toll: { hasTolls: true, priceUSD: 5 },
      encodedPolyline: shared,
    });
    // Same road, 10 m to the side: a near-duplicate.
    const freeSlow = route({
      description: 'free slow',
      durationSec: 700,
      encodedPolyline: parallel(2, 10)[1],
    });
    const distinct = route({ description: 'distinct', durationSec: 2000, encodedPolyline: other });
    const input = [tollFast, freeSlow, distinct];
    expect(via(rankRoutes(input, 'fastest'))).toEqual(['toll fast', 'distinct']);
    expect(via(rankRoutes(input, 'cheapest'))).toEqual(['free slow', 'distinct']);
  });

  it('RC-DEDUP-03: overlap exactly at the threshold is kept; above it is dropped', () => {
    expect(OVERLAP_THRESHOLD).toBe(0.8);
    expect(isNearDuplicate(0.8)).toBe(false);
    expect(isNearDuplicate(0.8001)).toBe(true);
    const lines = parallel(2, 1000);
    const first = route({ description: 'first', encodedPolyline: lines[0] });
    const second = route({ description: 'second', durationSec: 700, encodedPolyline: lines[1] });
    expect(via(rankRoutes([first, second], 'fastest', undefined, () => 0.8))).toEqual([
      'first',
      'second',
    ]);
    expect(via(rankRoutes([first, second], 'fastest', undefined, () => 0.8001))).toEqual(['first']);
  });

  it('measures overlap between the decoded polylines', () => {
    const calls: number[] = [];
    const lines = parallel(2, 1000);
    rankRoutes(
      [
        route({ encodedPolyline: lines[0] }),
        route({ durationSec: 700, encodedPolyline: lines[1] }),
      ],
      'fastest',
      undefined,
      (a, b) => {
        calls.push(a.length, b.length);
        return 0;
      },
    );
    expect(calls).toEqual([31, 31]); // 3 km with a vertex every 100 m
  });
});

describe('rankRoutes — top three', () => {
  it('RC-TOP3-01: more than three distinct routes → exactly three', () => {
    const lines = parallel(5, 1000);
    const routes = lines.map((encodedPolyline, i) =>
      route({ description: `r${i}`, durationSec: 1000 - i * 10, encodedPolyline }),
    );
    const { options, onlyN } = rankRoutes(routes, 'fastest');
    expect(options).toHaveLength(MAX_OPTIONS);
    expect(onlyN).toBeNull();
    expect(options.map((o) => o.viaLabel)).toEqual(['r4', 'r3', 'r2']);
  });

  it('RC-TOP3-02: two routes → onlyN 2; one → onlyN 1; zero → empty', () => {
    const lines = parallel(2, 1000);
    const two = rankRoutes(
      [route({ encodedPolyline: lines[0] }), route({ encodedPolyline: lines[1] })],
      'fastest',
    );
    expect(two.options).toHaveLength(2);
    expect(two.onlyN).toBe(2);

    const one = rankRoutes([route({ encodedPolyline: lines[0] })], 'cheapest');
    expect(one.options).toHaveLength(1);
    expect(one.onlyN).toBe(1);
    expect(one.options[0]).toMatchObject({ id: 'A', isTopPick: true, diff: null });

    expect(rankRoutes([], 'fastest')).toEqual({ options: [], onlyN: 0 });
  });

  it('RC-TOP3-02: near-duplicates collapse to fewer than three', () => {
    // Canonical B from both sources plus nothing else → only 1 distinct route.
    expect(rankRoutes([B, B_AVOID], 'fastest').onlyN).toBe(1);
  });

  it('RC-TOP3-03: letters follow ranked order and are reassigned on mode change', () => {
    const fastest = rankRoutes(CANONICAL, 'fastest').options;
    const cheapest = rankRoutes(CANONICAL, 'cheapest').options;
    expect(fastest.map((o) => `${o.id}:${o.viaLabel}`)).toEqual([
      'A:Hwy 12',
      'B:Elm Ave & 3rd St',
      'C:Main St',
    ]);
    expect(cheapest.map((o) => `${o.id}:${o.viaLabel}`)).toEqual([
      'A:Main St',
      'B:Elm Ave & 3rd St',
      'C:Hwy 12',
    ]);
  });
});

describe('rankRoutes — performance', () => {
  it('RC-PERF-01: 10 routes with 500-point polylines rank in under 50 ms', () => {
    // 15 m apart: neighbours are near-duplicates, so dedupe does real work.
    const lines = parallel(10, 15, 4990, 10);
    const routes = lines.map((encodedPolyline, i) =>
      route({ description: `r${i}`, durationSec: 1000 + i, encodedPolyline }),
    );
    expect(routes.every((r) => r.encodedPolyline.length > 0)).toBe(true);
    rankRoutes(routes, 'fastest'); // warm up the JIT once

    const started = Date.now();
    const { options } = rankRoutes(routes, 'cheapest');
    const elapsedMs = Date.now() - started;

    expect(options).toHaveLength(3);
    expect(elapsedMs).toBeLessThan(50);
  });
});
