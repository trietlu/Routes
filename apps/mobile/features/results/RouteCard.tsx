import { Pressable, StyleSheet, View } from 'react-native';
import {
  type RankMode,
  type RouteOption,
  cardAccessibilityLabel,
  formatCardCost,
  formatDiff,
  formatDistance,
  formatDuration,
  formatTollStatus,
} from '@routes/routing-core';
import { coreT, t } from '../../i18n';
import { MIN_TOUCH_TARGET, routeColor, useTheme } from '../../theme';
import { AppText } from '../common/AppText';

interface RouteCardProps {
  option: RouteOption;
  mode: RankMode;
  /** Options shown, for "Best of N". */
  count: number;
  selected: boolean;
  onPress: () => void;
}

/**
 * A route card (UX screen 4, FR-13). Every number and string comes from the
 * routing-core formatters; the letter is on the badge and in the spoken label,
 * so color is never the only cue (NFR-7).
 */
export function RouteCard({ option, mode, count, selected, onPress }: RouteCardProps) {
  const theme = useTheme();
  const { colors } = theme;
  const tollPriced = option.hasTolls;
  const pillBackground = tollPriced ? colors.tollAmberBackground : colors.tollGreenBackground;
  const pillText = tollPriced ? colors.tollAmberText : colors.tollGreenText;
  const line3 = option.diff ? formatDiff(option.diff, coreT) : t('results.bestOf', { n: count });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel(option, mode, coreT)}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`route-card-${option.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          gap: theme.spacing.md,
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: routeColor(colors, option.id) }]}>
        <AppText variant="heading" style={{ color: colors.onRoute }}>
          {option.id}
        </AppText>
      </View>
      <View style={styles.middle}>
        <View style={styles.line1}>
          <AppText variant="duration">{formatDuration(option.durationSec, coreT)}</AppText>
          <AppText variant="secondary" secondary>
            {formatDistance(option.distanceM, coreT)}
          </AppText>
          {option.isTopPick ? (
            <View
              style={[
                styles.topBadge,
                { backgroundColor: colors.border, borderRadius: theme.radii.sm },
              ]}
            >
              <AppText variant="caption" style={styles.bold}>
                {t(mode === 'fastest' ? 'results.badgeFastest' : 'results.badgeCheapest')}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="secondary">{t('results.via', { via: option.viaLabel })}</AppText>
        <AppText variant="caption" secondary>
          {line3}
        </AppText>
      </View>
      <View style={styles.right}>
        <View style={styles.cost}>
          <AppText variant="heading">{formatCardCost(option, coreT)}</AppText>
          <AppText variant="caption" secondary>
            {t('results.est')}
          </AppText>
        </View>
        <View
          style={[styles.pill, { backgroundColor: pillBackground, borderRadius: theme.radii.sm }]}
        >
          <AppText variant="caption" style={[styles.bold, { color: pillText }]}>
            {formatTollStatus(option, coreT)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  line1: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  topBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  right: { alignItems: 'flex-end', gap: 6, maxWidth: '40%' },
  cost: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
  },
  pill: { paddingHorizontal: 8, paddingVertical: 3 },
  bold: { fontWeight: '700' },
});
