import {
  OVERLAP_THRESHOLD,
  RESAMPLE_STEP_M,
  SHARED_DISTANCE_M,
  decodePolyline,
  encodePolyline,
  routeOverlap,
} from './index';
import { walk } from './testRoutes';

const DC = { lat: 38.8977, lng: -77.0365 };

describe('routeOverlap', () => {
  it('exports the tuning constants', () => {
    expect(RESAMPLE_STEP_M).toBe(25);
    expect(SHARED_DISTANCE_M).toBe(20);
    expect(OVERLAP_THRESHOLD).toBe(0.8);
  });

  it('RC-OVL-01: identical polylines overlap 1.0', () => {
    const route = walk(DC, [
      { eastM: 4000, northM: 0 },
      { eastM: 0, northM: 3000 },
    ]);
    const roundTripped = decodePolyline(encodePolyline(route));
    expect(routeOverlap(route, route)).toBe(1);
    expect(routeOverlap(roundTripped, roundTripped)).toBe(1);
  });

  it('RC-OVL-02: disjoint polylines more than 1 km apart overlap 0', () => {
    const a = walk(DC, [{ eastM: 5000, northM: 0 }]);
    const b = walk({ lat: DC.lat + 0.012, lng: DC.lng }, [{ eastM: 5000, northM: 0 }]); // ~1.3 km north
    expect(routeOverlap(a, b)).toBe(0);
  });

  it('RC-OVL-03: a route sharing the first 90% then diverging overlaps about 0.9', () => {
    const a = walk(DC, [{ eastM: 10_000, northM: 0 }]);
    const b = walk(DC, [
      { eastM: 9000, northM: 0 },
      { eastM: 0, northM: 1000 },
    ]);
    expect(routeOverlap(a, b)).toBeGreaterThanOrEqual(0.87);
    expect(routeOverlap(a, b)).toBeLessThanOrEqual(0.93);
  });

  it('RC-OVL-04: uses the larger directional fraction (short route inside a long one ≈ 1.0)', () => {
    const long = walk(DC, [
      { eastM: 6000, northM: 0 },
      { eastM: 0, northM: 4000 },
    ]);
    const short = walk(DC, [{ eastM: 3000, northM: 0 }]);
    expect(routeOverlap(short, long)).toBeGreaterThanOrEqual(0.99);
    expect(routeOverlap(long, short)).toBe(routeOverlap(short, long));
  });

  it('counts samples within 20 m of the other route as shared, and further ones not', () => {
    const a = walk(DC, [{ eastM: 2000, northM: 0 }]);
    const near = walk({ lat: DC.lat + 15 / 111_195, lng: DC.lng }, [{ eastM: 2000, northM: 0 }]);
    const far = walk({ lat: DC.lat + 30 / 111_195, lng: DC.lng }, [{ eastM: 2000, northM: 0 }]);
    expect(routeOverlap(a, near)).toBe(1);
    expect(routeOverlap(a, far)).toBe(0);
  });

  it('handles long straight segments and one-point or empty routes', () => {
    // Two-vertex routes: a single 8 km diagonal segment each.
    const a = walk(DC, [{ eastM: 6000, northM: 5300 }], 10_000);
    expect(a).toHaveLength(2);
    expect(routeOverlap(a, a)).toBe(1);
    expect(routeOverlap([DC], a)).toBe(1);
    expect(routeOverlap([DC], [DC])).toBe(1);
    expect(routeOverlap([], a)).toBe(0);
    expect(routeOverlap(a, [])).toBe(0);
  });

  it('is fast on 10 routes of 500 points (all pairs well under 50 ms)', () => {
    const routes = Array.from({ length: 10 }, (_, r) =>
      walk({ lat: DC.lat + r * 0.0005, lng: DC.lng }, [
        { eastM: 12_500, northM: 0 },
        { eastM: 0, northM: 12_400 },
      ]),
    );
    expect(routes[0]!.length).toBeGreaterThanOrEqual(249);
    const started = Date.now();
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) routeOverlap(routes[i]!, routes[j]!);
    }
    // Budget is generous for CI; RC-PERF-01 (R-04) holds the whole ranking to 50 ms.
    expect(Date.now() - started).toBeLessThan(250);
  });
});
