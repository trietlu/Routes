import {
  type CostVehicle,
  type RouteCost,
  type RouteInput,
  type RouteStepInput,
  DEFAULT_VEHICLE,
  computeCost,
  toCents,
} from './cost';
import { OVERLAP_THRESHOLD, routeOverlap } from './overlap';
import { type LatLng, decodePolyline } from './polyline';

export type RankMode = 'fastest' | 'cheapest';

/** How many routes the results screen shows (FR-8). */
export const MAX_OPTIONS = 3;

/** Card letters, in ranked order (FR-12). */
export const OPTION_IDS = ['A', 'B', 'C'] as const;
export type OptionId = (typeof OPTION_IDS)[number];

/**
 * A card's difference from the top pick, from whole minutes and cent-rounded
 * trip costs (BRD rule 4). Positive means slower or dearer. `cents` is null
 * when either route's toll price is unknown.
 */
export interface RouteDiff {
  minutes: number;
  cents: number | null;
}

/** A ranked route as shown on a card (technical design § Data model). */
export interface RouteOption extends RouteCost {
  id: OptionId;
  /** The encoded polyline, as received. */
  polyline: string;
  durationSec: number;
  distanceM: number;
  viaLabel: string;
  steps: readonly RouteStepInput[];
  /** Null on the top pick. */
  diff: RouteDiff | null;
  isTopPick: boolean;
}

export interface RankedRoutes {
  options: RouteOption[];
  /** Set to the option count when fewer than three distinct routes exist (BRD rule 5). */
  onlyN: number | null;
}

/** Overlap measure, injectable so tests can pin exact fractions. */
export type OverlapFn = (a: readonly LatLng[], b: readonly LatLng[]) => number;

/** Whether two routes are near-duplicates. Exactly at the threshold is not. */
export function isNearDuplicate(overlap: number): boolean {
  return overlap > OVERLAP_THRESHOLD;
}

interface Candidate {
  route: RouteInput;
  cost: RouteCost;
  index: number;
  points?: LatLng[];
}

const byFastest = (a: Candidate, b: Candidate): number =>
  a.route.durationSec - b.route.durationSec ||
  a.route.distanceM - b.route.distanceM ||
  a.index - b.index;

const byCheapest = (a: Candidate, b: Candidate): number => {
  const aTrip = a.cost.tripUSD;
  const bTrip = b.cost.tripUSD;
  if (aTrip === null || bTrip === null) {
    // Priced routes first; unknown-toll routes after them, by duration.
    if (aTrip !== bTrip) return aTrip === null ? 1 : -1;
    return a.route.durationSec - b.route.durationSec || a.index - b.index;
  }
  return aTrip - bTrip || a.route.durationSec - b.route.durationSec || a.index - b.index;
};

const pointsOf = (candidate: Candidate): LatLng[] =>
  (candidate.points ??= decodePolyline(candidate.route.encodedPolyline));

const wholeMinutes = (durationSec: number): number => Math.round(durationSec / 60);

function diffFrom(top: Candidate, option: Candidate): RouteDiff {
  const topTrip = top.cost.tripUSD;
  const trip = option.cost.tripUSD;
  return {
    minutes: wholeMinutes(option.route.durationSec) - wholeMinutes(top.route.durationSec),
    cents: topTrip === null || trip === null ? null : toCents(trip) - toCents(topTrip),
  };
}

/**
 * Cost → sort for the mode → drop near-duplicates → take three → letters and
 * diffs (technical design § On-device processing). Both sources feed both
 * modes. Every sort ends on input order, so the result is deterministic.
 */
export function rankRoutes(
  routes: readonly RouteInput[],
  mode: RankMode,
  vehicle: CostVehicle = DEFAULT_VEHICLE,
  overlap: OverlapFn = routeOverlap,
): RankedRoutes {
  const candidates: Candidate[] = routes.map((route, index) => ({
    route,
    cost: computeCost(route, vehicle),
    index,
  }));
  candidates.sort(mode === 'fastest' ? byFastest : byCheapest);

  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    if (kept.length === MAX_OPTIONS) break;
    const duplicate = kept.some((other) =>
      isNearDuplicate(overlap(pointsOf(other), pointsOf(candidate))),
    );
    if (!duplicate) kept.push(candidate);
  }

  const options = kept.map((candidate, i): RouteOption => ({
    id: OPTION_IDS[i]!,
    polyline: candidate.route.encodedPolyline,
    durationSec: candidate.route.durationSec,
    distanceM: candidate.route.distanceM,
    viaLabel: candidate.route.description,
    steps: candidate.route.steps,
    ...candidate.cost,
    diff: i === 0 ? null : diffFrom(kept[0]!, candidate),
    isTopPick: i === 0,
  }));
  return { options, onlyN: options.length < MAX_OPTIONS ? options.length : null };
}
