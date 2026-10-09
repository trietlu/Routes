import { EN_STRINGS as CORE_STRINGS } from '@routes/routing-core';

/**
 * The app's en-US strings table (NFR-11). Every user-visible string comes
 * from here. It includes routing-core's strings, so one `t()` serves the
 * formatters too. Placeholders are `{name}`.
 */
export const APP_STRINGS = {
  'app.name': 'Routes',
  'screen.onboarding.title': 'Welcome to Routes',
  'screen.home.title': 'Home',
  'screen.search.title': 'Search',
  'screen.results.title': 'Routes',
  'screen.route.title': 'Route {letter}',
  'screen.vehicle.title': 'Your vehicle',
  'screen.setPlace.home': 'Set Home',
  'screen.setPlace.work': 'Set Work',
  'placeholder.body': 'This screen is coming soon.',
} as const;

export const STRINGS = { ...CORE_STRINGS, ...APP_STRINGS } as const;

export type AppStringKey = keyof typeof STRINGS;
