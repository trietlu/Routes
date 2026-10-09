import { Pressable, StyleSheet, View } from 'react-native';
import { type RankMode } from '@routes/routing-core';
import { t } from '../../i18n';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { AppText } from '../common/AppText';

const MODES: readonly { mode: RankMode; label: () => string }[] = [
  { mode: 'fastest', label: () => t('home.fastest') },
  { mode: 'cheapest', label: () => t('home.cheapest') },
];

/** Segmented "Fastest | Cheapest" control (FR-11). */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: RankMode;
  onChange: (mode: RankMode) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, { backgroundColor: theme.colors.border, borderRadius: theme.radii.md }]}
    >
      {MODES.map((option) => {
        const selected = option.mode === mode;
        return (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityLabel={option.label()}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.mode)}
            testID={`mode-${option.mode}`}
            style={[
              styles.segment,
              { borderRadius: theme.radii.sm },
              selected && { backgroundColor: theme.colors.surface },
            ]}
          >
            <AppText variant={selected ? 'heading' : 'body'}>{option.label()}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3 },
  segment: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
