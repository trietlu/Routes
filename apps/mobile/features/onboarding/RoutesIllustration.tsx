import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

/** Three routes on a street grid, in the route colors (UX screen 1). Decorative. */
export function RoutesIllustration() {
  const { colors, dark } = useTheme();
  const block = dark ? '#2A2A2A' : '#E8E3DA';
  const street = dark ? '#121212' : '#FFFFFF';
  return (
    <Svg
      width="100%"
      height={220}
      viewBox="0 0 320 220"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="onboarding-illustration"
    >
      <Rect x={0} y={0} width={320} height={220} rx={24} fill={block} />
      {[80, 160, 240].map((x) => (
        <Rect key={`v${x}`} x={x} y={0} width={8} height={220} fill={street} />
      ))}
      {[55, 110, 165].map((y) => (
        <Rect key={`h${y}`} x={0} y={y} width={320} height={8} fill={street} />
      ))}
      <Path
        d="M44 176 C 120 150, 150 120, 200 96 S 260 40, 276 40"
        stroke={colors.routeB}
        strokeWidth={6}
        fill="none"
      />
      <Path
        d="M44 176 C 110 170, 160 110, 210 80 S 262 44, 276 40"
        stroke={colors.routeA}
        strokeWidth={6}
        fill="none"
      />
      <Path
        d="M44 176 L 200 176 C 250 176, 270 150, 276 40"
        stroke={colors.routeC}
        strokeWidth={6}
        fill="none"
      />
      <Circle cx={44} cy={176} r={9} fill={colors.routeA} stroke={street} strokeWidth={3} />
      <Circle cx={276} cy={40} r={10} fill={colors.text} stroke={street} strokeWidth={3} />
      <Circle cx={276} cy={40} r={4} fill={street} />
    </Svg>
  );
}
