import {
  EN_STRINGS,
  KEY_STEP_MIN_M,
  MAX_KEY_STEP_ROWS,
  type RouteStepInput,
  type Translate,
  cardAccessibilityLabel,
  enT,
  formatCardCost,
  formatDiff,
  formatDistance,
  formatDistanceSpoken,
  formatDuration,
  formatDurationSpoken,
  formatMoney,
  formatTollStatus,
  interpolate,
  rankRoutes,
  selectKeySteps,
} from '../index';
import { A, C, CANONICAL, parallel, route } from '../testRoutes';

const diffStrings = (mode: 'fastest' | 'cheapest', routes = CANONICAL): (string | null)[] =>
  rankRoutes(routes, mode).options.map((o) => (o.diff ? formatDiff(o.diff) : null));

describe('formatDiff', () => {
  it('RC-DIFF-01: Fastest canonical diffs', () => {
    expect(diffStrings('fastest')).toEqual([
      null,
      '5 min slower · saves $3.64',
      '9 min slower · saves $3.87',
    ]);
  });

  it('RC-DIFF-02: Cheapest canonical diffs', () => {
    expect(diffStrings('cheapest')).toEqual([
      null,
      '4 min faster · $0.23 more',
      '9 min faster · $3.87 more',
    ]);
  });

  it('RC-DIFF-03: equal times, or a difference under 1 min, read "Same time"', () => {
    expect(formatDiff({ minutes: 0, cents: 100 })).toBe('Same time · $1.00 more');
    const [line0, line1] = parallel(2, 1000);
    const top = route({ durationSec: 1320, encodedPolyline: line0 });
    // 20 s slower and $0.50 dearer: both round to 22 min.
    const close = route({
      durationSec: 1340,
      encodedPolyline: line1,
      toll: { hasTolls: true, priceUSD: 0.5 },
    });
    expect(diffStrings('fastest', [top, close])).toEqual([null, 'Same time · $0.50 more']);
  });

  it('RC-DIFF-04: equal cents read "Same cost"', () => {
    expect(formatDiff({ minutes: 3, cents: 0 })).toBe('3 min slower · Same cost');
    expect(formatDiff({ minutes: 0, cents: 0 })).toBe('Same time · Same cost');
  });

  it('RC-DIFF-05: an unknown toll on either route makes the cost part "cost unknown"', () => {
    expect(formatDiff({ minutes: 6, cents: null })).toBe('6 min slower · cost unknown');
    const [line0, line1] = parallel(2, 1000);
    const unknown = route({
      durationSec: 1440,
      encodedPolyline: line0,
      toll: { hasTolls: true, priceUSD: null },
    });
    const free = route({ durationSec: 1800, encodedPolyline: line1 });
    expect(diffStrings('fastest', [unknown, free])).toEqual([null, '6 min slower · cost unknown']);
    expect(diffStrings('cheapest', [unknown, free])).toEqual([null, '6 min faster · cost unknown']);
  });

  it('RC-DIFF-06: diffs use cent-rounded costs (C saves $3.87, not $3.88)', () => {
    const [top, , third] = rankRoutes(CANONICAL, 'fastest').options;
    // Exact difference 5.12204 − 1.24599 = 3.87605 would round to $3.88.
    expect(formatMoney(top!.tripUSD! - third!.tripUSD!)).toBe('$3.88');
    expect(formatDiff(third!.diff!)).toBe('9 min slower · saves $3.87');
  });
});

describe('formatters', () => {
  it('RC-FMT-01: duration', () => {
    expect(formatDuration(59)).toBe('1 min');
    expect(formatDuration(1)).toBe('1 min');
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(1320)).toBe('22 min');
    expect(formatDuration(3900)).toBe('1 hr 5 min');
    expect(formatDuration(7200)).toBe('2 hr');
    expect(formatDuration(3570)).toBe('1 hr'); // 59.5 min rounds to 60
  });

  it('spoken duration for VoiceOver', () => {
    expect(formatDurationSpoken(1320)).toBe('22 minutes');
    expect(formatDurationSpoken(59)).toBe('1 minute');
    expect(formatDurationSpoken(3660)).toBe('1 hour 1 minute');
    expect(formatDurationSpoken(3900)).toBe('1 hour 5 minutes');
    expect(formatDurationSpoken(3600)).toBe('1 hour');
    expect(formatDurationSpoken(7500)).toBe('2 hours 5 minutes');
  });

  it('RC-FMT-02: distance', () => {
    expect(formatDistance(15772)).toBe('9.8 mi');
    expect(formatDistance(160)).toBe('0.1 mi');
    expect(formatDistance(17059)).toBe('10.6 mi');
    expect(formatDistance(14323)).toBe('8.9 mi');
    expect(formatDistance(0)).toBe('0.0 mi');
    expect(formatDistanceSpoken(15772)).toBe('9.8 miles');
    expect(formatDistanceSpoken(1609)).toBe('1.0 mile');
  });

  it('RC-FMT-03: money rounds half-up to the cent', () => {
    expect(formatMoney(5.122)).toBe('$5.12');
    expect(formatMoney(0.005)).toBe('$0.01');
    expect(formatMoney(1.005)).toBe('$1.01');
    expect(formatMoney(3.75)).toBe('$3.75');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1234.5)).toBe('$1234.50');
  });

  it('RC-FMT-04: toll status strings', () => {
    expect(formatTollStatus({ hasTolls: true, tollUSD: 3.75 })).toBe('$3.75 toll');
    expect(formatTollStatus({ hasTolls: false, tollUSD: 0 })).toBe('No tolls');
    expect(formatTollStatus({ hasTolls: true, tollUSD: null })).toBe('Toll, price unknown');
    const [a, b, c] = rankRoutes(CANONICAL, 'fastest').options;
    expect([a, b, c].map((o) => formatTollStatus(o!))).toEqual([
      '$3.75 toll',
      'No tolls',
      'No tolls',
    ]);
  });

  it('RC-FMT-05: card cost', () => {
    expect(formatCardCost({ fuelUSD: 1.37204, tripUSD: 5.12204 })).toBe('$5.12');
    expect(formatCardCost({ fuelUSD: 1.37204, tripUSD: null })).toBe('$1.37 + toll');
    const options = rankRoutes(CANONICAL, 'cheapest').options;
    expect(options.map((o) => formatCardCost(o))).toEqual(['$1.25', '$1.48', '$5.12']);
  });

  it('RC-FMT-06: card accessibility label matches the UX example format', () => {
    const fastest = rankRoutes(CANONICAL, 'fastest').options;
    expect(cardAccessibilityLabel(fastest[0]!, 'fastest')).toBe(
      'Route A, fastest, 22 minutes, 9.8 miles, via Hwy 12, estimated cost $5.12 including $3.75 toll',
    );
    expect(cardAccessibilityLabel(fastest[1]!, 'fastest')).toBe(
      'Route B, 27 minutes, 10.6 miles, via Elm Ave & 3rd St, estimated cost $1.48, no tolls, 5 min slower, saves $3.64',
    );
    const cheapest = rankRoutes(CANONICAL, 'cheapest').options;
    expect(cardAccessibilityLabel(cheapest[0]!, 'cheapest')).toBe(
      'Route A, cheapest, 31 minutes, 8.9 miles, via Main St, estimated cost $1.25, no tolls',
    );
    const unknown = rankRoutes([{ ...A, toll: { hasTolls: true, priceUSD: null } }, C], 'fastest')
      .options[0]!;
    expect(cardAccessibilityLabel(unknown, 'fastest')).toBe(
      'Route A, fastest, 22 minutes, 9.8 miles, via Hwy 12, estimated cost $1.37 plus toll, toll price unknown',
    );
  });
});

describe('selectKeySteps', () => {
  const step = (distanceM: number, n: number): RouteStepInput => ({
    instruction: `Step ${n}`,
    maneuver: 'STRAIGHT',
    distanceM,
  });
  const long = KEY_STEP_MIN_M;
  const short = KEY_STEP_MIN_M - 1;

  it('RC-FMT-07: first step, steps of 0.5 mi or more, then an arrival row', () => {
    const steps = [
      step(100, 0),
      step(short, 1),
      step(long, 2),
      step(short, 3),
      step(2000, 4),
      step(300, 5),
    ];
    const { rows, hasMore } = selectKeySteps(steps, 'Union Station');
    expect(rows).toEqual([
      { kind: 'step', stepIndex: 0, instruction: 'Step 0', maneuver: 'STRAIGHT', distanceM: 100 },
      { kind: 'step', stepIndex: 2, instruction: 'Step 2', maneuver: 'STRAIGHT', distanceM: long },
      { kind: 'step', stepIndex: 4, instruction: 'Step 4', maneuver: 'STRAIGHT', distanceM: 2000 },
      { kind: 'arrival', instruction: 'Arrive at Union Station', distanceM: 300 },
    ]);
    expect(hasMore).toBe(true); // steps 1 and 3 are hidden
  });

  it('RC-FMT-07: at most 8 rows, with hasMore when steps are cut', () => {
    const steps = Array.from({ length: 12 }, (_, i) => step(1000, i));
    const { rows, hasMore } = selectKeySteps(steps, 'Home');
    expect(rows).toHaveLength(MAX_KEY_STEP_ROWS);
    expect(rows.slice(0, 7).map((r) => (r.kind === 'step' ? r.stepIndex : -1))).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(rows[7]).toEqual({ kind: 'arrival', instruction: 'Arrive at Home', distanceM: 1000 });
    expect(hasMore).toBe(true);
  });

  it('RC-FMT-07: hasMore is false when every step is shown', () => {
    const steps = Array.from({ length: 8 }, (_, i) => step(1000, i));
    const { rows, hasMore } = selectKeySteps(steps, 'Home');
    expect(rows).toHaveLength(8); // 7 steps plus arrival standing for step 7
    expect(hasMore).toBe(false);
    expect(selectKeySteps([step(50, 0), step(60, 1)], 'Home').hasMore).toBe(false);
  });

  it('handles one step and no steps', () => {
    expect(selectKeySteps([step(500, 0)], 'Home')).toEqual({
      rows: [
        { kind: 'step', stepIndex: 0, instruction: 'Step 0', maneuver: 'STRAIGHT', distanceM: 500 },
        { kind: 'arrival', instruction: 'Arrive at Home', distanceM: 500 },
      ],
      hasMore: false,
    });
    expect(selectKeySteps([], 'Home')).toEqual({ rows: [], hasMore: false });
  });
});

describe('strings', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(interpolate('plain')).toBe('plain');
    expect(enT('toll.none')).toBe('No tolls');
  });

  it('every string goes through the injected t', () => {
    const keys: string[] = [];
    const upper: Translate = (key, params) => {
      keys.push(key);
      return interpolate(EN_STRINGS[key], params).toUpperCase();
    };
    const option = rankRoutes(CANONICAL, 'fastest').options[1]!;
    expect(formatDiff(option.diff!, upper)).toBe('5 MIN SLOWER · SAVES $3.64');
    expect(formatTollStatus(option, upper)).toBe('NO TOLLS');
    expect(formatDuration(3900, upper)).toBe('1 HR 5 MIN');
    expect(selectKeySteps([], 'x', upper).rows).toEqual([]);
    expect(
      selectKeySteps([{ instruction: 'go', maneuver: 'DEPART', distanceM: 1 }], 'Home', upper)
        .rows[1],
    ).toEqual({ kind: 'arrival', instruction: 'ARRIVE AT HOME', distanceM: 1 });
    expect(cardAccessibilityLabel(option, 'fastest', upper)).toBe(
      'ROUTE B, 27 MINUTES, 10.6 MILES, VIA ELM AVE & 3RD ST, ESTIMATED COST $1.48, NO TOLLS, 5 MIN SLOWER, SAVES $3.64',
    );
    expect(keys).toContain('a11y.separator');
  });
});
