import { z } from 'zod';
import { type ProviderRoute, ProviderRouteSchema, type RouteSource } from '@routes/api-types';
import { sumTollPricesUSD } from '@routes/routing-core';

/**
 * The parts of a Routes API `computeRoutes` body the proxy reads (its field
 * mask). Unknown fields are ignored so Google can add fields safely.
 */
const MoneySchema = z.object({
  currencyCode: z.string(),
  units: z.union([z.string(), z.number()]).optional(),
  nanos: z.number().optional(),
});

const GoogleStepSchema = z.object({
  distanceMeters: z.number().nonnegative().optional(),
  navigationInstruction: z
    .object({ maneuver: z.string().optional(), instructions: z.string().optional() })
    .optional(),
});

const GoogleRouteSchema = z.object({
  duration: z.string().regex(/^\d+(\.\d+)?s$/),
  distanceMeters: z.number().nonnegative().optional(),
  polyline: z.object({ encodedPolyline: z.string().min(1) }),
  description: z.string().optional(),
  travelAdvisory: z
    .object({ tollInfo: z.object({ estimatedPrice: z.array(MoneySchema).optional() }).optional() })
    .optional(),
  legs: z.array(z.object({ steps: z.array(GoogleStepSchema).optional() })).optional(),
});

/** Google returns `{}` when there is no route. */
export const ComputeRoutesResponseSchema = z.object({
  routes: z.array(GoogleRouteSchema).optional(),
});
export type ComputeRoutesResponse = z.infer<typeof ComputeRoutesResponseSchema>;
type GoogleRoute = z.infer<typeof GoogleRouteSchema>;

/** `"1320s"` → 1320. Fractional seconds round to the nearest second. */
export const parseDurationSec = (duration: string): number =>
  Math.round(Number(duration.slice(0, -1)));

/** One Google route as a `ProviderRoute` (technical design § Toll normalization). */
export function normalizeRoute(route: GoogleRoute, source: RouteSource): ProviderRoute {
  const tollInfo = route.travelAdvisory?.tollInfo;
  return ProviderRouteSchema.parse({
    durationSec: parseDurationSec(route.duration),
    distanceM: route.distanceMeters ?? 0,
    encodedPolyline: route.polyline.encodedPolyline,
    description: route.description ?? '',
    toll: tollInfo
      ? { hasTolls: true, priceUSD: sumTollPricesUSD(tollInfo.estimatedPrice) }
      : { hasTolls: false, priceUSD: null },
    steps: (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map((step) => ({
        instruction: step.navigationInstruction?.instructions ?? '',
        maneuver: step.navigationInstruction?.maneuver ?? '',
        distanceM: step.distanceMeters ?? 0,
      })),
    ),
    source,
  });
}

/** Parses and normalizes a whole `computeRoutes` body; throws if it is malformed. */
export function normalizeComputeRoutes(body: unknown, source: RouteSource): ProviderRoute[] {
  const parsed = ComputeRoutesResponseSchema.parse(body);
  return (parsed.routes ?? []).map((route) => normalizeRoute(route, source));
}
