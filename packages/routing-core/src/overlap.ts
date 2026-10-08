import { equirectangular, planarPointToSegmentM } from './geometry';
import { type LatLng } from './polyline';

/** Spacing of the samples taken along each route when measuring overlap. */
export const RESAMPLE_STEP_M = 25;

/** A sample is shared when it lies within this distance of the other route. */
export const SHARED_DISTANCE_M = 20;

/** Routes overlapping by more than this fraction are near-duplicates (BRD rule 3). */
export const OVERLAP_THRESHOLD = 0.8;

/*
 * Math functions bound once at load. Reading the global `Math` on every call
 * is slow inside Node `vm` contexts (where Jest runs tests), which would skew
 * the RC-PERF-01 timing; on device this is merely harmless.
 */
const { ceil, floor, hypot, max, min } = Math;

/** Grid cell size for the segment index. */
const CELL_SIZE_M = 50;

/** Slack so a sample landing within a centimetre of a vertex is not repeated. */
const EPSILON_M = 0.01;

const cell = (metres: number): number => floor(metres / CELL_SIZE_M);

/**
 * Numeric key for a grid cell. Coordinates are relative to the trip, so rows
 * stay far below 2^20 in magnitude and keys never collide.
 */
const cellKey = (col: number, row: number): number => col * 2 ** 21 + row;

/**
 * Segments of a polyline in planar metres, bucketed into a grid so a lookup
 * only checks the few segments near a point. A segment is filed under every
 * cell within the search radius of it; long segments are walked in
 * cell-sized pieces so a long straight road touches only the cells along it.
 */
class SegmentIndex {
  private readonly cells = new Map<number, number[]>();
  private readonly coords: number[] = []; // ax, ay, bx, by per segment

  constructor(
    xs: readonly number[],
    ys: readonly number[],
    private readonly radiusM: number,
  ) {
    const segmentCount = xs.length === 1 ? 1 : xs.length - 1;
    for (let s = 0; s < segmentCount; s++) {
      const ax = xs[s]!;
      const ay = ys[s]!;
      const bx = xs[s + 1] ?? ax; // a one-point polyline is a zero-length segment
      const by = ys[s + 1] ?? ay;
      this.coords.push(ax, ay, bx, by);
      const pieces = max(1, ceil(hypot(bx - ax, by - ay) / CELL_SIZE_M));
      for (let p = 0; p < pieces; p++) {
        const x0 = ax + ((bx - ax) * p) / pieces;
        const y0 = ay + ((by - ay) * p) / pieces;
        const x1 = ax + ((bx - ax) * (p + 1)) / pieces;
        const y1 = ay + ((by - ay) * (p + 1)) / pieces;
        this.fileUnder(s, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1));
      }
    }
  }

  private fileUnder(s: number, minX: number, maxX: number, minY: number, maxY: number): void {
    const r = this.radiusM;
    for (let col = cell(minX - r); col <= cell(maxX + r); col++) {
      for (let row = cell(minY - r); row <= cell(maxY + r); row++) {
        const key = cellKey(col, row);
        const bucket = this.cells.get(key);
        if (!bucket) this.cells.set(key, [s]);
        else if (bucket[bucket.length - 1] !== s) bucket.push(s);
      }
    }
  }

  /** Whether (x, y) lies within the search radius of any segment. */
  isNear(x: number, y: number): boolean {
    const bucket = this.cells.get(cellKey(cell(x), cell(y)));
    if (!bucket) return false;
    const c = this.coords;
    for (const s of bucket) {
      const o = s * 4;
      if (planarPointToSegmentM(x, y, c[o]!, c[o + 1]!, c[o + 2]!, c[o + 3]!) <= this.radiusM) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Planar equivalent of `resamplePolyline`: points every `stepM` metres along
 * the line, first and last included. Works on projected metres, which avoids
 * trigonometry per segment and is accurate to well under a metre here.
 */
function resamplePlanar(
  xs: readonly number[],
  ys: readonly number[],
  stepM: number,
): { xs: number[]; ys: number[] } {
  const outXs = [xs[0]!];
  const outYs = [ys[0]!];
  let travelled = 0;
  let next = stepM;
  for (let i = 1; i < xs.length; i++) {
    const ax = xs[i - 1]!;
    const ay = ys[i - 1]!;
    const dx = xs[i]! - ax;
    const dy = ys[i]! - ay;
    const length = hypot(dx, dy);
    while (length > 0 && next <= travelled + length + EPSILON_M) {
      const t = min(1, (next - travelled) / length);
      outXs.push(ax + dx * t);
      outYs.push(ay + dy * t);
      next += stepM;
    }
    travelled += length;
  }
  if (next - stepM < travelled - EPSILON_M) {
    outXs.push(xs[xs.length - 1]!);
    outYs.push(ys[ys.length - 1]!);
  }
  return { xs: outXs, ys: outYs };
}

interface PreparedRoute {
  sampleXs: number[];
  sampleYs: number[];
  index: SegmentIndex;
}

function prepare(xs: number[], ys: number[]): PreparedRoute {
  const samples = resamplePlanar(xs, ys, RESAMPLE_STEP_M);
  return {
    sampleXs: samples.xs,
    sampleYs: samples.ys,
    index: new SegmentIndex(xs, ys, SHARED_DISTANCE_M),
  };
}

/** Fraction of `from`'s samples that lie near `to`. */
function sharedFraction(from: PreparedRoute, to: PreparedRoute): number {
  let shared = 0;
  for (let i = 0; i < from.sampleXs.length; i++) {
    if (to.index.isNear(from.sampleXs[i]!, from.sampleYs[i]!)) shared++;
  }
  return shared / from.sampleXs.length;
}

/**
 * How much two routes overlap, in [0, 1]. Each route is sampled every
 * RESAMPLE_STEP_M; a sample is shared if it lies within SHARED_DISTANCE_M of
 * the other route. Returns the larger of the two shared fractions, so a short
 * route contained in a long one scores about 1.
 */
export function routeOverlap(a: readonly LatLng[], b: readonly LatLng[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  let latSum = 0;
  for (const point of a) latSum += point.lat;
  for (const point of b) latSum += point.lat;
  const projection = equirectangular(latSum / (a.length + b.length));
  // Measure from a's first point so grid coordinates stay small.
  const originX = projection.x(a[0]!);
  const originY = projection.y(a[0]!);
  const project = (points: readonly LatLng[]): PreparedRoute =>
    prepare(
      points.map((point) => projection.x(point) - originX),
      points.map((point) => projection.y(point) - originY),
    );

  const preparedA = project(a);
  const preparedB = project(b);
  return max(sharedFraction(preparedA, preparedB), sharedFraction(preparedB, preparedA));
}
