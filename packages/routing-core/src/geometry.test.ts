import {
  haversineDistanceM,
  pointAlongPolyline,
  pointToSegmentDistanceM,
  polylineLengthM,
  resamplePolyline,
} from './index';
import { walk } from './testRoutes';

const DC = { lat: 38.8977, lng: -77.0365 };

describe('geometry', () => {
  it('haversine matches a known distance', () => {
    // One degree of latitude on the mean-radius sphere.
    expect(haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195.08, 1);
    expect(haversineDistanceM(DC, DC)).toBe(0);
  });

  it('RC-GEO-01: point-to-segment distance is within 0.5 m of haversine for short segments', () => {
    const a = DC;
    const b = { lat: DC.lat + 0.01, lng: DC.lng + 0.008 }; // about 1.4 km north-east
    const cases = [
      // Perpendicular foot inside the segment: compare with the haversine distance to the foot.
      { point: { lat: DC.lat + 0.004, lng: DC.lng + 0.0045 }, t: undefined },
      { point: { lat: DC.lat + 0.006, lng: DC.lng + 0.0035 }, t: undefined },
      // Beyond either end: the nearest point is the endpoint.
      { point: { lat: DC.lat - 0.002, lng: DC.lng - 0.001 }, t: 0 },
      { point: { lat: DC.lat + 0.012, lng: DC.lng + 0.0095 }, t: 1 },
    ];
    for (const { point, t } of cases) {
      const reference =
        t === 0
          ? haversineDistanceM(point, a)
          : t === 1
            ? haversineDistanceM(point, b)
            : minHaversineToSegment(point, a, b);
      expect(Math.abs(pointToSegmentDistanceM(point, a, b) - reference)).toBeLessThan(0.5);
    }
  });

  it('point-to-segment distance handles a zero-length segment', () => {
    const point = { lat: DC.lat + 0.001, lng: DC.lng };
    expect(pointToSegmentDistanceM(point, DC, DC)).toBeCloseTo(haversineDistanceM(point, DC), 0);
  });

  it('RC-GEO-02: resampling a 1 km line every 25 m yields 41 points, ends included', () => {
    const line = walk(DC, [{ eastM: 1000, northM: 0 }], 1000);
    expect(polylineLengthM(line)).toBeCloseTo(1000, 0);
    const samples = resamplePolyline(line, 25);
    expect(samples).toHaveLength(41);
    expect(samples[0]).toEqual(line[0]);
    expect(samples[40]).toEqual(line[1]);
    for (let i = 1; i < samples.length; i++) {
      expect(haversineDistanceM(samples[i - 1]!, samples[i]!)).toBeCloseTo(25, 1);
    }
  });

  it('resampling keeps the end point when the length is not a multiple of the step', () => {
    const line = walk(DC, [{ eastM: 1010, northM: 0 }], 100);
    const samples = resamplePolyline(line, 25);
    expect(samples).toHaveLength(42);
    expect(samples[41]).toEqual(line[line.length - 1]);
  });

  it('resampling handles empty, single-point and repeated-point polylines', () => {
    expect(resamplePolyline([], 25)).toEqual([]);
    expect(resamplePolyline([DC], 25)).toEqual([DC]);
    expect(resamplePolyline([DC, DC, DC], 25)).toEqual([DC]);
    expect(() => resamplePolyline([DC], 0)).toThrow(RangeError);
  });
});

/** Brute-force reference: smallest haversine distance to points along a–b. */
function minHaversineToSegment(
  point: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  let best = Infinity;
  const steps = 20_000;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const onSegment = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    best = Math.min(best, haversineDistanceM(point, onSegment));
  }
  return best;
}

describe('pointAlongPolyline', () => {
  const start = { lat: 38.8977, lng: -77.0365 };
  // 1 km east, then 1 km north.
  const lShape = walk(start, [
    { eastM: 1000, northM: 0 },
    { eastM: 0, northM: 1000 },
  ]);

  it('finds the midpoint by distance, not by vertex count', () => {
    const mid = pointAlongPolyline(lShape, 0.5)!;
    expect(haversineDistanceM(mid, lShape[10]!)).toBeLessThan(1); // the corner, 1 km in
    const quarter = pointAlongPolyline(lShape, 0.25)!;
    expect(haversineDistanceM(start, quarter)).toBeCloseTo(500, -1);
  });

  it('clamps the fraction and handles short polylines', () => {
    expect(pointAlongPolyline(lShape, -1)).toEqual(start);
    expect(pointAlongPolyline(lShape, 2)).toEqual(lShape[lShape.length - 1]);
    expect(pointAlongPolyline([], 0.5)).toBeNull();
    expect(pointAlongPolyline([start], 0.5)).toEqual(start);
    expect(pointAlongPolyline([start, start], 0.5)).toEqual(start);
  });
});
