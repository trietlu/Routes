import { EARTH_RADIUS_M, type LatLng } from '@routes/routing-core';

/** A point in metres east (x) and north (y) of the fixture origin. */
export interface Point {
  x: number;
  y: number;
}

/** A straight leg of a synthetic route, driven on one street. */
export interface Leg {
  from: Point;
  to: Point;
  street: string;
}

const METRES_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M;

/** Spacing of polyline vertices along each leg. */
const VERTEX_EVERY_M = 100;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const lerp = (a: Point, b: Point, t: number): Point => add(a, scale(sub(b, a), t));
export const lengthOf = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * A detour from `from` to `to` that is exactly `lengthM` long: out at an angle,
 * along a stretch parallel to the straight line (the middle third), and back.
 * `side` picks which side of the straight line it bulges to.
 */
export function trapezoid(
  from: Point,
  to: Point,
  lengthM: number,
  side: 1 | -1,
  streets: readonly [string, string, string],
): Leg[] {
  const d = lengthOf(from, to);
  if (lengthM < d) throw new Error(`Route of ${lengthM} m is shorter than the ${d} m crow-flies`);
  const third = d / 3;
  const slant = (lengthM - third) / 2;
  const h = Math.sqrt(slant * slant - third * third);
  const unit = scale(sub(to, from), 1 / d);
  const normal = scale({ x: -unit.y, y: unit.x }, side * h);
  const p1 = add(lerp(from, to, 1 / 3), normal);
  const p2 = add(lerp(from, to, 2 / 3), normal);
  return [
    { from, to: p1, street: streets[0] },
    { from: p1, to: p2, street: streets[1] },
    { from: p2, to, street: streets[2] },
  ];
}

/**
 * Replaces the middle `stretchM` of leg `legIndex` with a parallel stretch
 * `offsetM` to one side (positive = left of travel), joined by two short legs.
 * The result shares everything but the bump with the original route.
 */
export function bump(
  legs: readonly Leg[],
  legIndex: number,
  stretchM: number,
  offsetM: number,
  street: string,
): Leg[] {
  const leg = legs[legIndex]!;
  const length = lengthOf(leg.from, leg.to);
  const unit = scale(sub(leg.to, leg.from), 1 / length);
  const shift = scale({ x: -unit.y, y: unit.x }, offsetM);
  const start = lerp(leg.from, leg.to, (length - stretchM) / 2 / length);
  const end = lerp(leg.from, leg.to, (length + stretchM) / 2 / length);
  return [
    ...legs.slice(0, legIndex),
    { from: leg.from, to: start, street: leg.street },
    { from: start, to: add(start, shift), street },
    { from: add(start, shift), to: add(end, shift), street },
    { from: add(end, shift), to: end, street },
    { from: end, to: leg.to, street: leg.street },
    ...legs.slice(legIndex + 1),
  ];
}

export const legsLengthM = (legs: readonly Leg[]): number =>
  legs.reduce((sum, leg) => sum + lengthOf(leg.from, leg.to), 0);

/** Converts metre offsets to degrees around `origin` (equirectangular). */
export function toLatLng(origin: LatLng, point: Point): LatLng {
  const metresPerDegreeLng = METRES_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + point.y / METRES_PER_DEGREE,
    lng: origin.lng + point.x / metresPerDegreeLng,
  };
}

/** Polyline vertices along the legs, one about every 100 m. */
export function legsToPoints(origin: LatLng, legs: readonly Leg[]): LatLng[] {
  const points: LatLng[] = [toLatLng(origin, legs[0]!.from)];
  for (const leg of legs) {
    const steps = Math.max(1, Math.round(lengthOf(leg.from, leg.to) / VERTEX_EVERY_M));
    for (let i = 1; i <= steps; i++) {
      points.push(toLatLng(origin, lerp(leg.from, leg.to, i / steps)));
    }
  }
  return points;
}

const COMPASS = [
  'east',
  'northeast',
  'north',
  'northwest',
  'west',
  'southwest',
  'south',
  'southeast',
] as const;

/** Eight-point compass direction of travel along a leg. */
export function compassOf(leg: Leg): string {
  const angle = Math.atan2(leg.to.y - leg.from.y, leg.to.x - leg.from.x);
  const sector = Math.round(angle / (Math.PI / 4));
  return COMPASS[(sector + 8) % 8]!;
}

/** Which way the driver turns from leg `a` onto leg `b`. */
export function turnBetween(a: Leg, b: Leg): 'TURN_LEFT' | 'TURN_RIGHT' | 'STRAIGHT' {
  const u = sub(a.to, a.from);
  const v = sub(b.to, b.from);
  const cross = u.x * v.y - u.y * v.x;
  const sine = cross / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  if (Math.abs(sine) < 0.05) return 'STRAIGHT';
  return sine > 0 ? 'TURN_LEFT' : 'TURN_RIGHT';
}
