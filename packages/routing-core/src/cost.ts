/** Metres in a statute mile. */
export const METRES_PER_MILE = 1609.344;

export type FuelType = 'regular' | 'midgrade' | 'premium' | 'diesel';

/** The user's vehicle (technical design § Data model). */
export interface VehicleProfile {
  mpg: number;
  fuelType: FuelType;
  pricePerGallon: number;
  /** True once the user has saved their own figures (FR-22). */
  isUserSet: boolean;
}

/** Used until the user sets a vehicle (BRD cost calculation). */
export const DEFAULT_VEHICLE: Readonly<VehicleProfile> = Object.freeze({
  mpg: 25,
  fuelType: 'regular',
  pricePerGallon: 3.5,
  isUserSet: false,
});

/** The vehicle figures that cost depends on. */
export type CostVehicle = Pick<VehicleProfile, 'mpg' | 'pricePerGallon'>;

/**
 * Tolls for a whole route, as normalized by the proxy. `priceUSD` is null when
 * the route has tolls but no USD price is known. Structurally matches
 * `Toll` in `@routes/api-types`, without depending on zod.
 */
export interface RouteToll {
  hasTolls: boolean;
  priceUSD: number | null;
}

/** One navigation step. Matches `RouteStep` in `@routes/api-types`. */
export interface RouteStepInput {
  instruction: string;
  maneuver: string;
  distanceM: number;
}

/** A normalized provider route. Matches `ProviderRoute` in `@routes/api-types`. */
export interface RouteInput {
  durationSec: number;
  distanceM: number;
  encodedPolyline: string;
  description: string;
  toll: RouteToll;
  steps: readonly RouteStepInput[];
  source: 'tolls' | 'avoidTolls';
}

export interface RouteCost {
  fuelUSD: number;
  /** 0 when the route has no tolls; null when it has tolls of unknown price. */
  tollUSD: number | null;
  tollUnknown: boolean;
  hasTolls: boolean;
  /** Fuel plus tolls; null when the toll price is unknown. */
  tripUSD: number | null;
}

/**
 * Fuel, toll and trip cost at full precision. Round only for display
 * (technical design § On-device processing, step 1).
 */
export function computeCost(
  route: Pick<RouteInput, 'distanceM' | 'toll'>,
  vehicle: CostVehicle = DEFAULT_VEHICLE,
): RouteCost {
  const fuelUSD = (route.distanceM / METRES_PER_MILE / vehicle.mpg) * vehicle.pricePerGallon;
  const { hasTolls } = route.toll;
  const tollUSD = hasTolls ? route.toll.priceUSD : 0;
  return {
    fuelUSD,
    tollUSD,
    tollUnknown: tollUSD === null,
    hasTolls,
    tripUSD: tollUSD === null ? null : fuelUSD + tollUSD,
  };
}

/** Google's `Money`: `units` is an int64, which JSON carries as a string. */
export interface ProviderMoney {
  currencyCode: string;
  units?: string | number;
  nanos?: number;
}

/**
 * Sums the USD entries of Google's `tollInfo.estimatedPrice` as
 * `units + nanos / 1e9`. Returns null when there is no USD entry, so a toll
 * priced only in another currency counts as "price unknown".
 */
export function sumTollPricesUSD(prices: readonly ProviderMoney[] | undefined): number | null {
  const usd = (prices ?? []).filter((price) => price.currencyCode === 'USD');
  if (usd.length === 0) {
    return null;
  }
  return usd.reduce((sum, price) => sum + Number(price.units ?? 0) + (price.nanos ?? 0) / 1e9, 0);
}

/**
 * Whole cents, half-up. The small nudge stops binary representation error
 * from rounding a value such as 1.005 (stored as 1.00499…) down.
 */
export function toCents(usd: number): number {
  return Math.round(usd * 100 + 1e-7);
}
