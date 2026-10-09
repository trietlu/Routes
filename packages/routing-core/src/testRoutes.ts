import { type RouteInput } from './cost';
import { type LatLng, encodePolyline } from './polyline';

/** Metres per degree of latitude on the mean-radius sphere. */
export const METRES_PER_DEGREE_LAT = 111_195.08;

/**
 * Builds a polyline that starts at `start` and follows straight legs, each
 * given as metres east and north. One vertex every `vertexEveryM` metres.
 * Test helper only; not exported from the package entry.
 */
export function walk(
  start: LatLng,
  legs: readonly { eastM: number; northM: number }[],
  vertexEveryM = 100,
): LatLng[] {
  const points: LatLng[] = [start];
  let current = start;
  for (const { eastM, northM } of legs) {
    const length = Math.hypot(eastM, northM);
    const steps = Math.max(1, Math.round(length / vertexEveryM));
    const origin = current;
    const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);
    for (let i = 1; i <= steps; i++) {
      current = {
        lat: origin.lat + (northM * i) / steps / METRES_PER_DEGREE_LAT,
        lng: origin.lng + (eastM * i) / steps / metresPerDegreeLng,
      };
      points.push(current);
    }
  }
  return points;
}

/** Canonical test fixture (test plan §2), built inline until the shared fixtures land in R-06. */

export const DC = { lat: 38.8977, lng: -77.0365 };

/** Distinct geometries between the same two points, 6 km east and 6 km north. */
export const VIA_HWY = encodePolyline(
  walk(DC, [
    { eastM: 6000, northM: 0 },
    { eastM: 0, northM: 6000 },
  ]),
);
export const VIA_ELM = encodePolyline(
  walk(DC, [
    { eastM: 3000, northM: 0 },
    { eastM: 0, northM: 6000 },
    { eastM: 3000, northM: 0 },
  ]),
);
export const VIA_MAIN = encodePolyline(
  walk(DC, [
    { eastM: 0, northM: 6000 },
    { eastM: 6000, northM: 0 },
  ]),
);

export function route(overrides: Partial<RouteInput>): RouteInput {
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
export const A = route({
  durationSec: 1320,
  distanceM: 15772,
  encodedPolyline: VIA_HWY,
  description: 'Hwy 12',
  toll: { hasTolls: true, priceUSD: 3.75 },
  steps: [{ instruction: 'Head east', maneuver: 'DEPART', distanceM: 6000 }],
});
export const B = route({
  durationSec: 1620,
  distanceM: 17059,
  encodedPolyline: VIA_ELM,
  description: 'Elm Ave & 3rd St',
});
export const B_AVOID = { ...B, source: 'avoidTolls' as const };
export const C = route({
  durationSec: 1860,
  distanceM: 14323,
  encodedPolyline: VIA_MAIN,
  description: 'Main St',
  source: 'avoidTolls',
});
export const CANONICAL = [A, B, B_AVOID, C];

/** Parallel east-west lines `spacingM` apart; > 20 m apart means distinct. */
export function parallel(
  count: number,
  spacingM: number,
  lengthM = 3000,
  vertexEveryM = 100,
): string[] {
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
