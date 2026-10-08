import {
  equirectangular,
  planarPointToSegmentM,
  resamplePolyline,
  type Projection,
} from './geometry';
import { type LatLng } from './polyline';

/** Spacing of the samples taken along each route when measuring overlap. */
export const RESAMPLE_STEP_M = 25;

/** A sample is shared when it lies within this distance of the other route. */
export const SHARED_DISTANCE_M = 20;

/** Routes overlapping by more than this fraction are near-duplicates (BRD rule 3). */
export const OVERLAP_THRESHOLD = 0.8;

/** Grid cell size for the segment index. Larger than SHARED_DISTANCE_M on purpose. */
const CELL_SIZE_M = 250;

/**
 * Segments of a polyline in planar metres, bucketed into a grid so a lookup
 * only checks the few segments near a point. Each segment is filed under
 * every cell its bounding box (grown by the search radius) touches.
 */
class SegmentIndex {
  private readonly cells = new Map<string, number[]>();
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
      const minCol = cell(Math.min(ax, bx) - radiusM);
      const maxCol = cell(Math.max(ax, bx) + radiusM);
      const minRow = cell(Math.min(ay, by) - radiusM);
      const maxRow = cell(Math.max(ay, by) + radiusM);
      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          const key = `${col}:${row}`;
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(s);
          else this.cells.set(key, [s]);
        }
      }
    }
  }

  /** Whether (x, y) lies within the search radius of any segment. */
  isNear(x: number, y: number): boolean {
    const bucket = this.cells.get(`${cell(x)}:${cell(y)}`);
    if (!bucket) return false;
    for (const s of bucket) {
      const o = s * 4;
      const d = planarPointToSegmentM(
        x,
        y,
        this.coords[o]!,
        this.coords[o + 1]!,
        this.coords[o + 2]!,
        this.coords[o + 3]!,
      );
      if (d <= this.radiusM) return true;
    }
    return false;
  }
}

const cell = (metres: number): number => Math.floor(metres / CELL_SIZE_M);

interface PreparedRoute {
  sampleXs: number[];
  sampleYs: number[];
  index: SegmentIndex;
}

function prepare(points: readonly LatLng[], projection: Projection): PreparedRoute {
  const samples = resamplePolyline(points, RESAMPLE_STEP_M);
  return {
    sampleXs: samples.map(projection.x),
    sampleYs: samples.map(projection.y),
    index: new SegmentIndex(points.map(projection.x), points.map(projection.y), SHARED_DISTANCE_M),
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

  const preparedA = prepare(a, projection);
  const preparedB = prepare(b, projection);
  return Math.max(sharedFraction(preparedA, preparedB), sharedFraction(preparedB, preparedA));
}
