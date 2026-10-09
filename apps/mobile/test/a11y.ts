import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

/** A host element as RNTL exposes it; walked generically across RNTL versions. */
interface HostNode {
  type: unknown;
  props: Record<string, unknown>;
  children?: readonly (HostNode | string)[];
}
import { MIN_TOUCH_TARGET } from '../theme';

type Insets = { top?: number; bottom?: number; left?: number; right?: number } | number | undefined;

/** Host elements that respond to presses. */
export function pressables(root: unknown): HostNode[] {
  const found: HostNode[] = [];
  const walk = (node: HostNode | string): void => {
    if (typeof node === 'string') return;
    if (typeof node.type === 'string' && typeof node.props.onClick === 'function') found.push(node);
    node.children?.forEach(walk);
  };
  walk(root as HostNode);
  return found;
}

const slop = (insets: Insets, a: 'top' | 'left', b: 'bottom' | 'right'): number =>
  typeof insets === 'number' ? 2 * insets : (insets?.[a] ?? 0) + (insets?.[b] ?? 0);

/**
 * UI-A11Y-01 and -02: every pressable has a role and a label, and a touch
 * target of at least 44 × 44 (min size from style, plus hitSlop).
 */
export function a11yProblems(root: unknown): string[] {
  const problems: string[] = [];
  for (const node of pressables(root)) {
    const { accessibilityRole, accessibilityLabel, testID, hitSlop } = node.props as Record<
      string,
      unknown
    >;
    const name =
      (testID as string | undefined) ?? (accessibilityLabel as string | undefined) ?? '(unnamed)';
    if (!accessibilityRole) problems.push(`${name}: no accessibilityRole`);
    if (!accessibilityLabel) problems.push(`${name}: no accessibilityLabel`);
    const style = (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}) as ViewStyle;
    const height =
      (Number(style.minHeight ?? style.height) || 0) + slop(hitSlop as Insets, 'top', 'bottom');
    const width =
      (Number(style.minWidth ?? style.width) || 0) + slop(hitSlop as Insets, 'left', 'right');
    if (height < MIN_TOUCH_TARGET || width < MIN_TOUCH_TARGET) {
      problems.push(`${name}: touch target ${width}×${height} < 44×44`);
    }
  }
  return problems;
}
