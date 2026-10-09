/** Coordinates in degrees. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Where "Current location" is. The location module (R-15) implements this;
 * until then, and in tests, a fake stands in.
 */
export interface CurrentLocationSource {
  /** The device's position, or null when it isn't available. */
  getCurrentCoordinates(): Promise<Coordinates | null>;
}

/** A source with a fixed answer, for tests and for screens before R-15. */
export const fixedLocation = (coordinates: Coordinates | null): CurrentLocationSource => ({
  getCurrentCoordinates: async () => coordinates,
});
