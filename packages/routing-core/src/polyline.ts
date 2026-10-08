/** A point in degrees, WGS 84. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Google's Encoded Polyline Algorithm uses five decimal places. */
const PRECISION = 1e5;

/**
 * Decodes a Google encoded polyline (precision 5).
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) {
        throw new Error('Invalid encoded polyline: truncated value');
      }
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >>> 1) : result >>> 1;
  };

  while (index < encoded.length) {
    lat += readValue();
    lng += readValue();
    points.push({ lat: lat / PRECISION, lng: lng / PRECISION });
  }
  return points;
}

/** Encodes points as a Google encoded polyline (precision 5). */
export function encodePolyline(points: readonly LatLng[]): string {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  const writeValue = (delta: number): void => {
    let value = delta < 0 ? ~(delta << 1) : delta << 1;
    while (value >= 0x20) {
      output += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>>= 5;
    }
    output += String.fromCharCode(value + 63);
  };

  for (const point of points) {
    const lat = Math.round(point.lat * PRECISION);
    const lng = Math.round(point.lng * PRECISION);
    writeValue(lat - prevLat);
    writeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return output;
}
