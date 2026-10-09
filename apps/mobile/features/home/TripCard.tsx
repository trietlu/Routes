import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { PinIcon, SwapIcon } from '../common/icons';

export interface FieldView {
  /** Shown text, e.g. "Current location", or the placeholder. */
  text: string;
  /** Placeholders are grey. */
  placeholder: boolean;
  /** Spoken value, e.g. including the street address (FR-2). */
  spoken: string;
}

interface TripCardProps {
  from: FieldView;
  to: FieldView;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
}

/** The From/To card with the swap button (UX screen 2, FR-4). */
export function TripCard({ from, to, onPressFrom, onPressTo, onSwap }: TripCardProps) {
  const theme = useTheme();
  const field = (label: string, view: FieldView, onPress: () => void, testID: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.fieldLabel', { field: label, value: view.spoken })}
      accessibilityHint={t('home.fieldHint')}
      onPress={onPress}
      testID={testID}
      style={styles.field}
    >
      <AppText variant="caption" secondary>
        {label}
      </AppText>
      <AppText variant="heading" secondary={view.placeholder} numberOfLines={2}>
        {view.text}
      </AppText>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.dots}>
        <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <PinIcon color={theme.colors.text} />
      </View>
      <View style={styles.fields}>
        {field(t('home.from'), from, onPressFrom, 'field-from')}
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        {field(t('home.to'), to, onPressTo, 'field-to')}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.swap')}
        onPress={onSwap}
        testID="swap"
        style={[styles.swap, { borderColor: theme.colors.border }]}
      >
        <SwapIcon color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dots: { width: 24, alignItems: 'center', paddingVertical: 18 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { width: 2, flex: 1, minHeight: 24, marginVertical: 4 },
  fields: { flex: 1, paddingHorizontal: 8 },
  field: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  divider: { height: StyleSheet.hairlineWidth },
  swap: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
