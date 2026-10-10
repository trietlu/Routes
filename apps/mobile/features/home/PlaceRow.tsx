import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { AppText } from '../common/AppText';

interface PlaceRowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Extra actions (e.g. Change, Remove): long press, or VoiceOver's actions rotor. */
  actions?: readonly { name: string; label: string; run: () => void }[];
  onLongPress?: () => void;
  testID?: string;
}

/** A recent or saved place: icon, name and address (UX screen 2). */
export function PlaceRow({
  icon,
  title,
  subtitle,
  accessibilityLabel,
  onPress,
  actions,
  onLongPress,
  testID,
}: PlaceRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityActions={actions?.map(({ name, label }) => ({ name, label }))}
      onAccessibilityAction={(event) =>
        actions?.find((action) => action.name === event.nativeEvent.actionName)?.run()
      }
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderColor: theme.colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.border }]}>{icon}</View>
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="secondary" secondary>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    minWidth: MIN_TOUCH_TARGET,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  pressed: { opacity: 0.6 },
});
