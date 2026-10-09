import { type StringParams, type Translate, interpolate } from '@routes/routing-core';
import { type AppStringKey, STRINGS } from './strings';

export { type AppStringKey, STRINGS } from './strings';

/** Looks up a string from the table and fills its `{placeholders}`. */
export function t(key: AppStringKey, params?: StringParams): string {
  return interpolate(STRINGS[key], params);
}

/** `t` typed for routing-core's formatters, which take an injectable `Translate`. */
export const coreT: Translate = (key, params) => t(key, params);
