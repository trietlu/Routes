import {
  CONTRAST_PAIRS,
  DARK,
  LIGHT,
  contrastRatio,
  luminance,
  routeColor,
  themeFor,
} from '../theme';

describe('theme', () => {
  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('UI-A11Y-03: %s token pairs meet 4.5:1 contrast', (_mode, colors) => {
    for (const [foreground, background] of CONTRAST_PAIRS) {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      if (ratio < 4.5) throw new Error(`${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(() => luminance('blue')).toThrow('Expected #RRGGBB');
  });

  it('has a color per route letter with dark variants', () => {
    expect([routeColor(LIGHT, 'A'), routeColor(LIGHT, 'B'), routeColor(LIGHT, 'C')]).toEqual([
      LIGHT.routeA,
      LIGHT.routeB,
      LIGHT.routeC,
    ]);
    expect(new Set([LIGHT.routeA, LIGHT.routeB, LIGHT.routeC]).size).toBe(3);
    expect(DARK.routeA).not.toBe(LIGHT.routeA);
    expect(themeFor(true).colors).toBe(DARK);
    expect(themeFor(false).colors).toBe(LIGHT);
  });
});
