import { Pressable, StyleSheet } from 'react-native';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/** Near-black filled button (UX § Visual language). At least 44 pt tall (NFR-6). */
export function PrimaryButton({ label, onPress, disabled = false, testID }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.colors.primary, borderRadius: theme.radii.md },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <AppText variant="heading" style={{ color: theme.colors.onPrimary, textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Text-only button in the accent color. Still a 44 pt target. */
export function LinkButton({ label, onPress, testID }: Omit<ButtonProps, 'disabled'>) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.link, pressed && styles.dimmed]}
    >
      <AppText variant="heading" style={{ color: theme.colors.accent, textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 52,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dimmed: { opacity: 0.6 },
});
