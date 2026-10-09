import { useColorScheme } from 'react-native';
import { type ColorTokens, DARK, LIGHT, RADII, SPACING, TYPOGRAPHY } from './tokens';

export * from './contrast';
export * from './tokens';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  typography: typeof TYPOGRAPHY;
  spacing: typeof SPACING;
  radii: typeof RADII;
}

export const themeFor = (dark: boolean): Theme => ({
  dark,
  colors: dark ? DARK : LIGHT,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radii: RADII,
});

/** The theme for the system appearance (`userInterfaceStyle: automatic`). */
export function useTheme(): Theme {
  return themeFor(useColorScheme() === 'dark');
}

/** A route letter's color. */
export function routeColor(colors: ColorTokens, letter: 'A' | 'B' | 'C'): string {
  return { A: colors.routeA, B: colors.routeB, C: colors.routeC }[letter];
}
