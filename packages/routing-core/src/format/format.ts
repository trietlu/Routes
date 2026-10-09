import { METRES_PER_MILE, type RouteCost, toCents } from '../cost';
import { type RankMode, type RouteDiff, type RouteOption } from '../rank';
import { type Translate, enT } from './strings';

/** Whole minutes, with anything under a minute (but over zero) shown as 1. */
function displayMinutes(sec: number): number {
  return sec <= 0 ? 0 : Math.max(1, Math.round(sec / 60));
}

/** "22 min", "1 hr 5 min", "2 hr"; under 60 s rounds up to "1 min" (FR-13). */
export function formatDuration(sec: number, t: Translate = enT): string {
  const total = displayMinutes(sec);
  const hr = Math.floor(total / 60);
  const min = total % 60;
  if (hr === 0) return t('duration.min', { min });
  return min === 0 ? t('duration.hr', { hr }) : t('duration.hrMin', { hr, min });
}

/** Duration in words for VoiceOver: "22 minutes", "1 hour 5 minutes". */
export function formatDurationSpoken(sec: number, t: Translate = enT): string {
  const total = displayMinutes(sec);
  const hr = Math.floor(total / 60);
  const min = total % 60;
  const minutes = t(min === 1 ? 'duration.spoken.minute' : 'duration.spoken.minutes', { min });
  if (hr === 0) return minutes;
  const hours = t(hr === 1 ? 'duration.spoken.hour' : 'duration.spoken.hours', { hr });
  return min === 0 ? hours : t('duration.spoken.hourMinutes', { hours, minutes });
}

/** Miles to one decimal, rounded half-up on the tenth. */
function milesText(m: number): string {
  return (Math.round((m / METRES_PER_MILE) * 10 + 1e-7) / 10).toFixed(1);
}

/** "9.8 mi" (NFR-11: miles, one decimal). */
export function formatDistance(m: number, t: Translate = enT): string {
  return t('distance.mi', { mi: milesText(m) });
}

/** Distance in words for VoiceOver: "9.8 miles". */
export function formatDistanceSpoken(m: number, t: Translate = enT): string {
  const mi = milesText(m);
  return t(mi === '1.0' ? 'distance.spoken.mile' : 'distance.spoken.miles', { mi });
}

/** Whole cents as "$5.12". */
export function formatCents(cents: number, t: Translate = enT): string {
  return t('money.usd', { amount: (cents / 100).toFixed(2) });
}

/** "$5.12", rounded half-up to the cent. */
export function formatMoney(usd: number, t: Translate = enT): string {
  return formatCents(toCents(usd), t);
}

type TollFields = Pick<RouteCost, 'hasTolls' | 'tollUSD'>;

/** The toll pill: "$3.75 toll", "No tolls" or "Toll, price unknown". */
export function formatTollStatus(option: TollFields, t: Translate = enT): string {
  if (!option.hasTolls) return t('toll.none');
  if (option.tollUSD === null) return t('toll.unknown');
  return t('toll.priced', { amount: formatMoney(option.tollUSD, t) });
}

/** The card's cost: "$5.12", or "$1.37 + toll" when the toll price is unknown. */
export function formatCardCost(
  option: Pick<RouteCost, 'fuelUSD' | 'tripUSD'>,
  t: Translate = enT,
): string {
  if (option.tripUSD === null) return t('cost.plusToll', { fuel: formatMoney(option.fuelUSD, t) });
  return formatMoney(option.tripUSD, t);
}

function diffTime(minutes: number, t: Translate): string {
  if (minutes > 0) return t('diff.slower', { min: minutes });
  if (minutes < 0) return t('diff.faster', { min: -minutes });
  return t('diff.sameTime');
}

function diffCost(cents: number | null, t: Translate): string {
  if (cents === null) return t('diff.costUnknown');
  if (cents < 0) return t('diff.saves', { amount: formatCents(-cents, t) });
  if (cents > 0) return t('diff.more', { amount: formatCents(cents, t) });
  return t('diff.sameCost');
}

/** A card's difference from the top pick, e.g. "5 min slower · saves $3.64" (BRD rule 4). */
export function formatDiff(diff: RouteDiff, t: Translate = enT): string {
  return t('diff.joined', { time: diffTime(diff.minutes, t), cost: diffCost(diff.cents, t) });
}

/**
 * VoiceOver label for a route card, e.g. "Route A, fastest, 22 minutes,
 * 9.8 miles, via Hwy 12, estimated cost $5.12 including $3.75 toll". Only the
 * top pick names the mode; the others end with their difference.
 */
export function cardAccessibilityLabel(
  option: RouteOption,
  mode: RankMode,
  t: Translate = enT,
): string {
  const parts = [t('a11y.route', { id: option.id })];
  if (option.isTopPick) parts.push(t(mode === 'fastest' ? 'a11y.fastest' : 'a11y.cheapest'));
  parts.push(
    formatDurationSpoken(option.durationSec, t),
    formatDistanceSpoken(option.distanceM, t),
    t('a11y.via', { via: option.viaLabel }),
  );
  if (option.tripUSD === null) {
    parts.push(t('a11y.costUnknownToll', { fuel: formatMoney(option.fuelUSD, t) }));
  } else if (option.hasTolls && option.tollUSD !== null) {
    parts.push(
      t('a11y.costWithToll', {
        trip: formatMoney(option.tripUSD, t),
        toll: formatMoney(option.tollUSD, t),
      }),
    );
  } else {
    parts.push(t('a11y.costNoTolls', { trip: formatMoney(option.tripUSD, t) }));
  }
  if (option.diff) {
    parts.push(diffTime(option.diff.minutes, t), diffCost(option.diff.cents, t));
  }
  return parts.join(t('a11y.separator'));
}
