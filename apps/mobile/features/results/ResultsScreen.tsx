import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ApiErrorKind } from '../../api/errors';
import { t } from '../../i18n';
import { useCurrentLocation } from '../../location';
import { useRankedRoutes, useTrip } from '../../state';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { PrimaryButton } from '../common/Button';
import { BackIcon } from '../common/icons';
import { fieldView } from '../home/HomeScreen';
import { ModeToggle } from '../home/ModeToggle';
import { ResultsMap } from './ResultsMap';
import { RouteCard } from './RouteCard';

const ERROR_COPY: Record<ApiErrorKind, () => string> = {
  noRoute: () => t('results.noRoute'),
  generic: () => t('results.error'),
  offline: () => t('results.offline'),
  rateLimited: () => t('results.rateLimited'),
};

/** Screen 4, Results: the sheet and route cards (FR-8 to FR-14, FR-20; US-5 to US-7). */
export function ResultsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const location = useCurrentLocation();
  const ranked = useRankedRoutes();
  const start = useTrip((s) => s.start);
  const destination = useTrip((s) => s.destination);
  const mode = useTrip((s) => s.mode);
  const selected = useTrip((s) => s.selectedLetter);
  const { setMode, select } = useTrip((s) => s);

  const startText = fieldView(start, location, t('home.enterStart')).text;
  const destinationText = fieldView(destination, location, t('home.whereTo')).text;
  const count = ranked.options.length;
  const title =
    ranked.onlyN === null
      ? t('results.count', { n: count })
      : ranked.onlyN === 1
        ? t('results.onlyOne')
        : t('results.onlyN', { n: ranked.onlyN });

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const errorState = (kind: ApiErrorKind) => (
    <View accessibilityRole="alert" style={[styles.state, { gap: theme.spacing.md }]}>
      <AppText variant="heading">{ERROR_COPY[kind]()}</AppText>
      {kind === 'noRoute' ? (
        <PrimaryButton
          label={t('results.changeDestination')}
          onPress={() => router.push({ pathname: '/search', params: { field: 'to' } })}
          testID="change-destination"
        />
      ) : (
        <PrimaryButton label={t('results.retry')} onPress={ranked.retry} testID="results-retry" />
      )}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <ResultsMap start={ranked.start} destination={ranked.destination} />
      <SafeAreaView
        edges={['top']}
        style={[styles.top, { padding: theme.spacing.md, gap: theme.spacing.sm }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('results.back')}
          onPress={goHome}
          testID="results-back"
          style={[styles.round, { backgroundColor: theme.colors.surface }]}
        >
          <BackIcon color={theme.colors.text} />
        </Pressable>
        <View
          accessible
          accessibilityLabel={t('results.pill', { start: startText, destination: destinationText })}
          style={[
            styles.pill,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.pill },
          ]}
        >
          <AppText numberOfLines={1} style={styles.shrink}>
            {t('results.pill', { start: startText, destination: destinationText })}
          </AppText>
        </View>
      </SafeAreaView>

      <View
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
          <View style={styles.headerRow}>
            <View style={styles.shrink}>
              {ranked.status === 'success' ? (
                <AppText variant="title" accessibilityRole="header">
                  {title}
                </AppText>
              ) : null}
              <AppText variant="secondary" secondary>
                {t(mode === 'fastest' ? 'results.byTime' : 'results.byCost')}
              </AppText>
            </View>
            <ModeToggle mode={mode} onChange={setMode} />
          </View>

          {ranked.status === 'success'
            ? ranked.options.map((option) => (
                <RouteCard
                  key={option.id}
                  option={option}
                  mode={mode}
                  count={count}
                  selected={option.id === selected}
                  onPress={() => select(option.id)}
                />
              ))
            : null}
          {ranked.status === 'loading' || ranked.status === 'idle' ? (
            <View
              accessible
              accessibilityLabel={t('results.loading')}
              testID="results-loading"
              style={{ gap: theme.spacing.md }}
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.skeleton,
                    { backgroundColor: theme.colors.border, borderRadius: theme.radii.md },
                  ]}
                />
              ))}
            </View>
          ) : null}
          {ranked.status === 'error' && ranked.errorKind ? errorState(ranked.errorKind) : null}
        </ScrollView>
        {ranked.status === 'success' ? (
          <SafeAreaView
            edges={['bottom']}
            style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}
          >
            <PrimaryButton
              label={t('results.goWith', { letter: selected })}
              onPress={() =>
                router.push({ pathname: '/route/[letter]', params: { letter: selected } })
              }
              testID="go-with-route"
            />
          </SafeAreaView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center' },
  round: {
    width: MIN_TOUCH_TARGET + 4,
    height: MIN_TOUCH_TARGET + 4,
    borderRadius: (MIN_TOUCH_TARGET + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { flex: 1, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 16 },
  shrink: { flexShrink: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '62%' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  state: { paddingVertical: 16, alignItems: 'stretch' },
  skeleton: { height: 88 },
});
