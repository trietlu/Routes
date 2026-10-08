import { decodePolyline, encodePolyline } from './index';
import { walk } from './testRoutes';

const GOOGLE_EXAMPLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('polyline', () => {
  it('RC-POLY-01: decodes the example from Google’s Encoded Polyline Algorithm docs', () => {
    expect(decodePolyline(GOOGLE_EXAMPLE)).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('RC-POLY-02: encode(decode(x)) === x for fixture polylines', () => {
    const generated = encodePolyline(
      walk({ lat: 38.8977, lng: -77.0365 }, [
        { eastM: 3000, northM: 0 },
        { eastM: 0, northM: -2500 },
        { eastM: -1200, northM: 900 },
      ]),
    );
    const fixtures = [GOOGLE_EXAMPLE, generated, '??', '~oia@_upzN'];
    for (const encoded of fixtures) {
      expect(encodePolyline(decodePolyline(encoded))).toBe(encoded);
    }
  });

  it('encodes the Google example points and handles an empty polyline', () => {
    expect(
      encodePolyline([
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
      ]),
    ).toBe(GOOGLE_EXAMPLE);
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
  });

  it('rejects a truncated polyline', () => {
    expect(() => decodePolyline('_p~iF~ps|')).toThrow('truncated');
  });
});
