import { type LatLng } from './polyline';

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

/*
 * Math functions bound once at load. Reading the global `Math` on every call
 * is slow inside Node `vm` contexts (where Jest runs tests), which would skew
 * the RC-PERF-01 timing; on device this is merely harmless.
 */
const { asin, cos, hypot, max, min, sin, sqrt } = Math;
const RADIANS_PER_DEGREE = Math.PI / 180;

const toRadians = (degrees: number): number => degrees * RADIANS_PER_DEGREE;

/** Great-circle distance between two points, in metres. */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = sin(dLat / 2) ** 2 + cos(toRadians(a.lat)) * cos(toRadians(b.lat)) * sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * asin(min(1, sqrt(h)));
}

/**
 * Flat x/y metres around a reference latitude (equirectangular projection).
 * Accurate to well under a metre over the few kilometres a route segment spans.
 */
export interface Projection {
  x(point: LatLng): number;
  y(point: LatLng): number;
}

export function equirectangular(referenceLat: number): Projection {
  const metresPerDegree = toRadians(1) * EARTH_RADIUS_M;
  const metresPerDegreeLng = metresPerDegree * cos(toRadians(referenceLat));
  return {
    x: (point) => point.lng * metresPerDegreeLng,
    y: (point) => point.lat * metresPerDegree,
  };
}

/** Distance from (px, py) to the segment (ax, ay)–(bx, by), all in planar metres. */
export function planarPointToSegmentM(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Distance from a point to the segment a–b in metres, using an equirectangular
 * approximation centred on the three points.
 */
export function pointToSegmentDistanceM(point: LatLng, a: LatLng, b: LatLng): number {
  const projection = equirectangular((point.lat + a.lat + b.lat) / 3);
  return planarPointToSegmentM(
    projection.x(point),
    projection.y(point),
    projection.x(a),
    projection.y(a),
    projection.x(b),
    projection.y(b),
  );
}

/** Total length of a polyline in metres. */
export function polylineLengthM(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceM(points[i - 1]!, points[i]!);
  }
  return total;
}

/**
 * Slack so a sample landing within a centimetre of a vertex snaps to it, and
 * the end point is not added twice (a "1 km" line often measures 1000.001 m).
 */
const RESAMPLE_EPSILON_M = 0.01;

/**
 * Points every `stepM` metres along a polyline, starting at the first point
 * and always ending at the last one. A 1 km line at 25 m gives 41 points.
 */
export function resamplePolyline(points: readonly LatLng[], stepM: number): LatLng[] {
  if (!(stepM > 0)) {
    throw new RangeError('stepM must be greater than 0');
  }
  const first = points[0];
  if (first === undefined) {
    return [];
  }

  const samples: LatLng[] = [first];
  let travelled = 0; // distance from the start to the current segment's start
  let next = stepM; // distance from the start of the next sample

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = haversineDistanceM(a, b);
    while (length > 0 && next <= travelled + length + RESAMPLE_EPSILON_M) {
      const t = (next - travelled) / length;
      samples.push(
        next >= travelled + length - RESAMPLE_EPSILON_M
          ? b
          : { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
      );
      next += stepM;
    }
    travelled += length;
  }

  const last = points[points.length - 1]!;
  if (next - stepM < travelled - RESAMPLE_EPSILON_M) {
    samples.push(last);
  }
  return samples;
}

/**
 * The point `fraction` (0–1) of the way along a polyline by distance, e.g.
 * 0.5 for the midpoint where the map puts a route's bubble. Null when empty.
 */
export function pointAlongPolyline(points: readonly LatLng[], fraction: number): LatLng | null {
  const first = points[0];
  if (first === undefined) return null;
  const target = polylineLengthM(points) * min(1, max(0, fraction));
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = haversineDistanceM(a, b);
    if (length > 0 && travelled + length >= target) {
      const t = (target - travelled) / length;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    travelled += length;
  }
  return points[points.length - 1]!;
}
