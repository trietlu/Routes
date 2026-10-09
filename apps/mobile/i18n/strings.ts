import { EN_STRINGS as CORE_STRINGS } from '@routes/routing-core';

/**
 * The app's en-US strings table (NFR-11). Every user-visible string comes
 * from here. It includes routing-core's strings, so one `t()` serves the
 * formatters too. Placeholders are `{name}`.
 */
export const APP_STRINGS = {
  'app.name': 'Routes',
  'screen.home.title': 'Home',
  'screen.search.title': 'Search',
  'screen.results.title': 'Routes',
  'screen.route.title': 'Route {letter}',
  'screen.vehicle.title': 'Your vehicle',
  'screen.setPlace.home': 'Set Home',
  'screen.setPlace.work': 'Set Work',
  'placeholder.body': 'This screen is coming soon.',
  'onboarding.title': 'Three good ways there.',
  'onboarding.body':
    "Routes compares the fastest and the cheapest ways to get where you're going. Share your location and we'll fill in where you're starting from.",
  'onboarding.allow': 'Allow location access',
  'onboarding.enterAddress': 'Enter a start address instead',
  'onboarding.footnote':
    'Your location is only used to set your starting point. You can change this anytime in Settings.',
} as const;

export const STRINGS = { ...CORE_STRINGS, ...APP_STRINGS } as const;

export type AppStringKey = keyof typeof STRINGS;
