import { z } from 'zod';
import { LatitudeSchema, LongitudeSchema } from './coordinates';

/** A trip endpoint. `placeId` is set when the place came from Places search. */
export const WaypointSchema = z.strictObject({
  placeId: z.string().min(1).optional(),
  lat: LatitudeSchema,
  lng: LongitudeSchema,
});
export type Waypoint = z.infer<typeof WaypointSchema>;

/** Body of `POST /routes`. */
export const RoutesRequestSchema = z.strictObject({
  origin: WaypointSchema,
  destination: WaypointSchema,
});
export type RoutesRequest = z.infer<typeof RoutesRequestSchema>;

/** Which of the two `computeRoutes` calls produced a route. */
export const RouteSourceSchema = z.enum(['tolls', 'avoidTolls']);
export type RouteSource = z.infer<typeof RouteSourceSchema>;

/**
 * Tolls for a whole route. Google reports tolls per route, not per step.
 * `priceUSD` is null when the route has tolls but no USD price is known.
 */
export const TollSchema = z.object({
  hasTolls: z.boolean(),
  priceUSD: z.number().finite().nonnegative().nullable(),
});
export type Toll = z.infer<typeof TollSchema>;

/** One navigation step, used for the route detail's key steps. */
export const RouteStepSchema = z.object({
  instruction: z.string(),
  /** Google's maneuver name, e.g. `TURN_LEFT`; drives the step icon. */
  maneuver: z.string(),
  distanceM: z.number().finite().nonnegative(),
});
export type RouteStep = z.infer<typeof RouteStepSchema>;

/** A route as normalized by the proxy. The app never sees raw Google payloads. */
export const ProviderRouteSchema = z.object({
  durationSec: z.number().int().nonnegative(),
  distanceM: z.number().finite().nonnegative(),
  encodedPolyline: z.string().min(1),
  /** The "via …" label. */
  description: z.string(),
  toll: TollSchema,
  steps: z.array(RouteStepSchema),
  source: RouteSourceSchema,
});
export type ProviderRoute = z.infer<typeof ProviderRouteSchema>;

/** Response of `POST /routes`: the merged list from both calls. */
export const RoutesResponseSchema = z.object({
  routes: z.array(ProviderRouteSchema),
});
export type RoutesResponse = z.infer<typeof RoutesResponseSchema>;
