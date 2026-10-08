import { type LatLng } from './polyline';

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
