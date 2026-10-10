import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEFAULT_VEHICLE,
  type KeyStepRow,
  type OptionId,
  OPTION_IDS,
  type RouteOption,
  formatCardCost,
  formatDistance,
  formatDuration,
  formatMoney,
  selectKeySteps,
} from '@routes/routing-core';
import { coreT, t } from '../../i18n';
import { formatClockTime } from '../../i18n/time';
import { useCurrentLocation } from '../../location';
import { useRankedRoutes, useTrip, useVehicle } from '../../state';
import { MIN_TOUCH_TARGET, routeColor, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { PrimaryButton } from '../common/Button';
import { BackIcon, ManeuverIcon, PinIcon, ShareIcon } from '../common/icons';
import { useNow } from '../common/useNow';
import { fieldView } from '../home/HomeScreen';
import { ResultsMap } from '../results/ResultsMap';

const asLetter = (value: string | undefined): OptionId =>
  (OPTION_IDS as readonly string[]).includes(value ?? '') ? (value as OptionId) : 'A';

/** Screen 5, Route detail (FR-15, FR-20; US-8). */
export function RouteDetailScreen({
  onShare = () => undefined,
  onOpenInGoogleMaps = () => undefined,
}: {
  /** Wired in R-23. */
  onShare?: (option: RouteOption) => void;
  onOpenInGoogleMaps?: (option: RouteOption) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const letter = asLetter(useLocalSearchParams<{ letter: string }>().letter);
  const ranked = useRankedRoutes();
  const location = useCurrentLocation();
  const destination = useTrip((s) => s.destination);
  const mode = useTrip((s) => s.mode);
  const select = useTrip((s) => s.select);
  const vehicle = useVehicle((s) => s.vehicle);
  const now = useNow();
  const [sheetHeight, setSheetHeight] = useState(0);
  const [allSteps, setAllSteps] = useState(false);

  // Back returns to Results with this route still selected.
  useEffect(() => select(letter), [letter, select]);

  const option = ranked.options.find((o) => o.id === letter);
  const destinationName = fieldView(destination, location, t('home.whereTo')).text;

  if (!option) {
    return (
      <SafeAreaView
        style={[
          styles.fill,
          { backgroundColor: theme.colors.background, padding: theme.spacing.lg },
        ]}
      >
        <AppText accessibilityRole="header" secondary>
          {t('detail.loading')}
        </AppText>
      </SafeAreaView>
    );
  }

  const arrival = new Date(now.getTime() + option.durationSec * 1000);
  const tolls = !option.hasTolls
    ? t('detail.noTolls')
    : option.tollUSD === null
      ? t('detail.priceUnknown')
      : formatMoney(option.tollUSD, coreT);
  const keySteps = selectKeySteps(option.steps, destinationName, coreT);
  // "Show all steps": every step, with the last one shown as the arrival row (as in key steps).
  const rows: KeyStepRow[] = allSteps
    ? [
        ...option.steps
          .slice(0, -1)
          .map((step, stepIndex) => ({ ...step, kind: 'step' as const, stepIndex })),
        ...keySteps.rows.filter((row) => row.kind === 'arrival'),
      ]
    : keySteps.rows;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <ResultsMap
        start={ranked.start}
        destination={ranked.destination}
        options={[option]}
        selected={option.id}
        mode={mode}
        onSelect={() => undefined}
        sheetHeight={sheetHeight}
        bubbles={false}
        testID="detail-map"
      />
      <SafeAreaView edges={['top']} style={{ padding: theme.spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('detail.back')}
          onPress={() => router.back()}
          testID="detail-back"
          style={[styles.round, { backgroundColor: theme.colors.surface }]}
        >
          <BackIcon color={theme.colors.text} />
        </Pressable>
      </SafeAreaView>

      <View
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
          },
        ]}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <View style={[styles.badge, { backgroundColor: routeColor(theme.colors, option.id) }]}>
              <AppText variant="heading" style={{ color: theme.colors.onRoute }}>
                {option.id}
              </AppText>
            </View>
            <AppText style={styles.shrink} accessibilityRole="header">
              {t('detail.viaTo', { via: option.viaLabel, destination: destinationName })}
            </AppText>
            {option.isTopPick ? (
              <View
                style={[
                  styles.topBadge,
                  { backgroundColor: theme.colors.border, borderRadius: theme.radii.sm },
                ]}
              >
                <AppText variant="caption" style={styles.bold}>
                  {t(mode === 'fastest' ? 'results.badgeFastest' : 'results.badgeCheapest')}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={[styles.durationRow, { gap: theme.spacing.sm }]}>
            <AppText variant="duration" style={styles.big}>
              {formatDuration(option.durationSec, coreT)}
            </AppText>
            <AppText secondary testID="detail-arrival">
              {t('detail.distanceArrive', {
                distance: formatDistance(option.distanceM, coreT),
                time: formatClockTime(arrival),
              })}
            </AppText>
          </View>

          <View
            testID="cost-card"
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <CostRow label={t('detail.tolls')} value={tolls} />
            <CostRow label={t('detail.fuel')} value={formatMoney(option.fuelUSD, coreT)} />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <CostRow label={t('detail.tripCost')} value={formatCardCost(option, coreT)} strong />
            <View style={[styles.footnote, { gap: 4 }]}>
              <AppText variant="caption" secondary>
                {vehicle.isUserSet
                  ? t('detail.footnoteUser')
                  : t('detail.footnoteDefault', {
                      mpg: DEFAULT_VEHICLE.mpg,
                      price: formatMoney(DEFAULT_VEHICLE.pricePerGallon, coreT),
                    })}
              </AppText>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t(
                  vehicle.isUserSet ? 'detail.editVehicle' : 'detail.setVehicle',
                )}
                onPress={() => router.push('/vehicle')}
                testID="vehicle-link"
                style={styles.link}
              >
                <AppText
                  variant="caption"
                  style={{ color: theme.colors.accent, fontWeight: '600' }}
                >
                  {t(vehicle.isUserSet ? 'detail.editVehicle' : 'detail.setVehicle')}
                </AppText>
              </Pressable>
            </View>
          </View>

          <View testID="key-steps">
            {rows.map((row, i) => (
              <View
                key={`${row.kind}-${i}`}
                accessible
                accessibilityLabel={t('detail.stepLabel', {
                  instruction: row.instruction,
                  distance: formatDistance(row.distanceM, coreT),
                })}
                testID={`step-${i}`}
                style={[styles.step, { borderColor: theme.colors.border, gap: theme.spacing.md }]}
              >
                {row.kind === 'arrival' ? (
                  <PinIcon color={theme.colors.text} />
                ) : (
                  <ManeuverIcon maneuver={row.maneuver} color={theme.colors.text} />
                )}
                <AppText style={styles.shrink}>{row.instruction}</AppText>
                <AppText variant="secondary" secondary>
                  {formatDistance(row.distanceM, coreT)}
                </AppText>
              </View>
            ))}
            {keySteps.hasMore && !allSteps ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('detail.showAllSteps')}
                onPress={() => setAllSteps(true)}
                testID="show-all-steps"
                style={styles.link}
              >
                <AppText style={{ color: theme.colors.accent, fontWeight: '600' }}>
                  {t('detail.showAllSteps')}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: 4 }}>
            <AppText variant="caption" secondary style={styles.center}>
              {t('detail.handoffNote')}
            </AppText>
            {option.hasTolls ? null : (
              <AppText variant="caption" secondary style={styles.center}>
                {t('detail.avoidTollsHint')}
              </AppText>
            )}
          </View>
        </ScrollView>
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.actions,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('detail.share')}
            onPress={() => onShare(option)}
            testID="share"
            style={[
              styles.shareButton,
              { borderColor: theme.colors.border, borderRadius: theme.radii.md },
            ]}
          >
            <ShareIcon color={theme.colors.text} />
          </Pressable>
          <View style={styles.fill}>
            <PrimaryButton
              label={t('detail.openInGoogleMaps')}
              onPress={() => onOpenInGoogleMaps(option)}
              testID="open-google-maps"
            />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

function CostRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.costRow}>
      <AppText variant={strong ? 'heading' : 'body'} style={styles.shrink}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: '700' },
  big: { fontSize: 40 },
  center: { textAlign: 'center' },
  round: {
    width: MIN_TOUCH_TARGET + 4,
    height: MIN_TOUCH_TARGET + 4,
    borderRadius: (MIN_TOUCH_TARGET + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '72%' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  durationRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  divider: { height: StyleSheet.hairlineWidth },
  footnote: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  link: { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET, justifyContent: 'center' },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  shareButton: {
    width: 56,
    minHeight: 52,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
