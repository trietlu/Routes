import { EN_STRINGS as CORE_STRINGS } from '@routes/routing-core';

/**
 * The app's en-US strings table (NFR-11). Every user-visible string comes
 * from here. It includes routing-core's strings, so one `t()` serves the
 * formatters too. Placeholders are `{name}`.
 */
export const APP_STRINGS = {
  'app.name': 'Routes',
  'screen.results.title': 'Routes',
  'screen.route.title': 'Route {letter}',
  'screen.vehicle.title': 'Your vehicle',
  'screen.setPlace.home': 'Set Home',
  'screen.setPlace.work': 'Set Work',
  'placeholder.body': 'This screen is coming soon.',
  'home.from': 'From',
  'home.to': 'To',
  'home.currentLocation': 'Current location',
  'home.currentLocationWithAddress': 'Current location, {address}',
  'home.locating': 'Finding your location…',
  'home.enterStart': 'Enter a start address',
  'home.whereTo': 'Where to?',
  'home.fieldLabel': '{field}: {value}',
  'home.fieldHint': 'Opens search',
  'home.swap': 'Swap start and destination',
  'home.locationOff': 'Location is off.',
  'home.turnOnInSettings': 'Turn on in Settings',
  'home.recenter': 'Re-center map',
  'home.showMeThe': 'Show me the',
  'home.fastest': 'Fastest',
  'home.cheapest': 'Cheapest',
  'home.recent': 'RECENT',
  'home.clear': 'Clear',
  'home.clearRecentsLabel': 'Clear recent destinations',
  'home.clearConfirmTitle': 'Clear recent destinations?',
  'home.clearConfirmMessage': 'Saved places stay.',
  'home.cancel': 'Cancel',
  'home.saved': 'SAVED',
  'home.home': 'Home',
  'home.work': 'Work',
  'home.setHome': 'Set Home',
  'home.setWork': 'Set Work',
  'home.placeLabel': '{name}, {address}',
  'home.offline': "You're offline",
  'home.retry': 'Retry',
  'home.change': 'Change',
  'home.remove': 'Remove',
  'search.back': 'Back',
  'search.fromPlaceholder': 'Search for a start',
  'search.toPlaceholder': 'Search for a destination',
  'search.savedPlaceholder': 'Search for an address',
  'search.fromLabel': 'Start address',
  'search.toLabel': 'Destination',
  'search.clear': 'Clear search',
  'search.loading': 'Searching',
  'search.noResults': "No places match '{query}'",
  'search.unavailable': "Search isn't available right now",
  'search.retry': 'Retry',
  'search.suggestionLabel': '{name}, {address}',
  'search.suggestionWithDistance': '{name}, {address}, {distance}',
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
