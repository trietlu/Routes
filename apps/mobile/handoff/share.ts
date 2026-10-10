import {
  type RouteOption,
  formatDistance,
  formatDuration,
  formatMoney,
} from '@routes/routing-core';
import { coreT, t } from '../i18n';

/**
 * Share text (FR-18, UX screen 5), e.g. "Route A via Hwy 12 to Union Station:
 * 22 min, 9.8 mi, est. $5.12 (incl. $3.75 toll). https://…".
 */
export function buildShareText(option: RouteOption, destinationName: string, url: string): string {
  const common = {
    letter: option.id,
    via: option.viaLabel,
    destination: destinationName,
    duration: formatDuration(option.durationSec, coreT),
    distance: formatDistance(option.distanceM, coreT),
    url,
  };
  if (option.tripUSD === null) {
    return t('share.unknownToll', { ...common, fuel: formatMoney(option.fuelUSD, coreT) });
  }
  if (option.hasTolls && option.tollUSD !== null) {
    return t('share.priced', {
      ...common,
      trip: formatMoney(option.tripUSD, coreT),
      toll: formatMoney(option.tollUSD, coreT),
    });
  }
  return t('share.noTolls', { ...common, trip: formatMoney(option.tripUSD, coreT) });
}
