/**
 * Design tokens (UX § Visual language): warm off-white background, near-black
 * primary button, blue accent, and a color plus letter per route (A blue,
 * B green, C orange). Every text/background pair below meets 4.5:1 in both
 * modes (NFR-6, checked by UI-A11Y-03).
 */
export interface ColorTokens {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  danger: string;
  routeA: string;
  routeB: string;
  routeC: string;
  /** Text on a route color, e.g. the letter badge. */
  onRoute: string;
  tollAmberBackground: string;
  tollAmberText: string;
  tollGreenBackground: string;
  tollGreenText: string;
}

export const LIGHT: ColorTokens = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#5C5C5C',
  border: '#E3DED6',
  primary: '#1A1A1A',
  onPrimary: '#FFFFFF',
  accent: '#1F5FD1',
  danger: '#B3261E',
  routeA: '#1F5FD1',
  routeB: '#1E7B3A',
  routeC: '#B4530F',
  onRoute: '#FFFFFF',
  tollAmberBackground: '#FDECC8',
  tollAmberText: '#6B4200',
  tollGreenBackground: '#DDF3E4',
  tollGreenText: '#1E5E31',
};

export const DARK: ColorTokens = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#F2F2F2',
  textSecondary: '#B3B3B3',
  border: '#333333',
  primary: '#F2F2F2',
  onPrimary: '#121212',
  accent: '#86AEF7',
  danger: '#FF8A80',
  routeA: '#86AEF7',
  routeB: '#6CCB8A',
  routeC: '#F0A060',
  onRoute: '#121212',
  tollAmberBackground: '#4A3500',
  tollAmberText: '#FFD58A',
  tollGreenBackground: '#163A22',
  tollGreenText: '#9EE2B4',
};

/** Text/background pairs that must reach 4.5:1 (UI-A11Y-03). */
export const CONTRAST_PAIRS: readonly [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['onPrimary', 'primary'],
  ['accent', 'background'],
  ['accent', 'surface'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['onRoute', 'routeA'],
  ['onRoute', 'routeB'],
  ['onRoute', 'routeC'],
  ['tollAmberText', 'tollAmberBackground'],
  ['tollGreenText', 'tollGreenBackground'],
];

/** Font sizes in points. Text scales with Dynamic Type (`allowFontScaling`). */
export const TYPOGRAPHY = {
  duration: { fontSize: 28, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  secondary: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof TYPOGRAPHY;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const RADII = { sm: 8, md: 12, lg: 16, sheet: 24, pill: 999 } as const;

/** Minimum touch target (NFR-6). */
export const MIN_TOUCH_TARGET = 44;
