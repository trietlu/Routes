/**
 * English defaults for every string routing-core produces. The app passes its
 * own `t` so these can live in its i18n table (NFR-11). Placeholders are
 * `{name}` and are filled from `params`.
 */
export const EN_STRINGS = {
  'duration.min': '{min} min',
  'duration.hr': '{hr} hr',
  'duration.hrMin': '{hr} hr {min} min',
  'duration.spoken.minute': '{min} minute',
  'duration.spoken.minutes': '{min} minutes',
  'duration.spoken.hour': '{hr} hour',
  'duration.spoken.hours': '{hr} hours',
  'duration.spoken.hourMinutes': '{hours} {minutes}',
  'distance.mi': '{mi} mi',
  'distance.spoken.mile': '{mi} mile',
  'distance.spoken.miles': '{mi} miles',
  'money.usd': '${amount}',
  'toll.priced': '{amount} toll',
  'toll.none': 'No tolls',
  'toll.unknown': 'Toll, price unknown',
  'cost.plusToll': '{fuel} + toll',
  'diff.slower': '{min} min slower',
  'diff.faster': '{min} min faster',
  'diff.sameTime': 'Same time',
  'diff.saves': 'saves {amount}',
  'diff.more': '{amount} more',
  'diff.sameCost': 'Same cost',
  'diff.costUnknown': 'cost unknown',
  'diff.joined': '{time} · {cost}',
  'a11y.route': 'Route {id}',
  'a11y.fastest': 'fastest',
  'a11y.cheapest': 'cheapest',
  'a11y.via': 'via {via}',
  'a11y.costWithToll': 'estimated cost {trip} including {toll} toll',
  'a11y.costNoTolls': 'estimated cost {trip}, no tolls',
  'a11y.costUnknownToll': 'estimated cost {fuel} plus toll, toll price unknown',
  'a11y.separator': ', ',
  'keySteps.arrive': 'Arrive at {name}',
} as const;

export type StringKey = keyof typeof EN_STRINGS;
export type StringParams = Readonly<Record<string, string | number>>;

/** Looks up a string and fills its placeholders. */
export type Translate = (key: StringKey, params?: StringParams) => string;

/** Fills `{name}` placeholders; unknown placeholders are left as they are. */
export function interpolate(template: string, params: StringParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** The default `t`: English strings from `EN_STRINGS`. */
export const enT: Translate = (key, params) => interpolate(EN_STRINGS[key], params);
