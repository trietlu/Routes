import { METRES_PER_MILE, type RouteStepInput } from '../cost';
import { type Translate, enT } from './strings';

/** Steps at least this long are always shown (technical design § Key steps). */
export const KEY_STEP_MIN_M = 0.5 * METRES_PER_MILE;

/** Rows shown before "Show all steps", the arrival row included. */
export const MAX_KEY_STEP_ROWS = 8;

export type KeyStepRow =
  | (RouteStepInput & { kind: 'step'; stepIndex: number })
  | { kind: 'arrival'; instruction: string; distanceM: number };

export interface KeySteps {
  rows: KeyStepRow[];
  /** True when any step is not shown, so the "Show all steps" row is useful. */
  hasMore: boolean;
}

/**
 * The route detail's key steps (FR-15): the first step, every later step of
 * 0.5 mi or more, then "Arrive at {name}" carrying the final step's distance.
 * The final step is represented by the arrival row rather than repeated.
 * At most 8 rows in all.
 */
export function selectKeySteps(
  steps: readonly RouteStepInput[],
  destinationName: string,
  t: Translate = enT,
): KeySteps {
  if (steps.length === 0) return { rows: [], hasMore: false };

  const last = steps.length - 1;
  const candidates: number[] = [0];
  for (let i = 1; i < last; i++) {
    if (steps[i]!.distanceM >= KEY_STEP_MIN_M) candidates.push(i);
  }
  const shown = candidates.slice(0, MAX_KEY_STEP_ROWS - 1);

  const rows: KeyStepRow[] = shown.map((stepIndex) => ({
    ...steps[stepIndex]!,
    kind: 'step',
    stepIndex,
  }));
  rows.push({
    kind: 'arrival',
    instruction: t('keySteps.arrive', { name: destinationName }),
    distanceM: steps[last]!.distanceM,
  });

  // Steps before the last (which the arrival row stands for) that are not shown.
  // A one-step route shows that step, so nothing is hidden.
  const hidden = Math.max(last, 1) - shown.length;
  return { rows, hasMore: hidden > 0 };
}
