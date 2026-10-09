import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isDeviceOffline, useNetworkStatus } from '../../api/network';
import { t } from '../../i18n';
import { type CurrentLocation, openAppSettings, useCurrentLocation } from '../../location';
import { type Endpoint, useTrip } from '../../state';
import { type Place, type PlaceInput, type SavedKind } from '../../storage/places';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { useStorage } from '../app/services';
import { AppText } from '../common/AppText';
import { ClockIcon, HomeIcon, WorkIcon } from '../common/icons';
import { HomeMap } from './HomeMap';
import { ModeToggle } from './ModeToggle';
import { PlaceRow } from './PlaceRow';
import { type FieldView, TripCard } from './TripCard';

const placeholder = (text: string): FieldView => ({ text, placeholder: true, spoken: text });
const filled = (text: string, spoken = text): FieldView => ({ text, placeholder: false, spoken });

/** How an endpoint reads in the From/To card, given the device location. */
export function fieldView(
  endpoint: Endpoint | null,
  location: CurrentLocation,
  empty: string,
): FieldView {
  if (endpoint === null) return placeholder(empty);
  if (endpoint !== 'current') return filled(endpoint.name, `${endpoint.name}, ${endpoint.address}`);
  if (location.state === 'locating') return placeholder(t('home.locating'));
  if (location.state !== 'ready') return placeholder(t('home.enterStart'));
  const spoken = location.address
    ? t('home.currentLocationWithAddress', { address: location.address })
    : t('home.currentLocation');
  return filled(t('home.currentLocation'), spoken);
}

const toInput = ({ name, address, placeId, lat, lng }: Place): PlaceInput => ({
  name,
  address,
  placeId,
  lat,
  lng,
});

/** Screen 2, Home (FR-2, 3, 4, 6, 7, 11, 21; US-4). */
export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { places } = useStorage();
  const location = useCurrentLocation();
  const { isOffline } = useNetworkStatus();
  const start = useTrip((s) => s.start);
  const destination = useTrip((s) => s.destination);
  const mode = useTrip((s) => s.mode);
  const { setStart, setDestination, swap, setMode } = useTrip((s) => s);

  const [recents, setRecents] = useState<Place[]>([]);
  const [saved, setSaved] = useState<Record<SavedKind, Place | null>>({ home: null, work: null });

  const reload = useCallback(async () => {
    const [list, home, work] = await Promise.all([
      places.listRecents(),
      places.getSaved('home'),
      places.getSaved('work'),
    ]);
    setRecents(list);
    setSaved({ home, work });
  }, [places]);

  // Reload when Home comes back into view, e.g. after Search saved a recent.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // With location available and no start chosen, start from here (FR-2).
  const locationReady = location.state === 'ready';
  useEffect(() => {
    if (locationReady && start === null) setStart('current');
  }, [locationReady, start, setStart]);

  const coords = location.state === 'ready' ? location.coords : null;
  const locationOff = location.state === 'denied' || location.state === 'unavailable';
  const startSet = start !== null && (start !== 'current' || locationReady);
  const from = fieldView(
    start ?? (location.state === 'locating' ? 'current' : null),
    location,
    t('home.enterStart'),
  );
  const to = fieldView(destination, location, t('home.whereTo'));

  const openSearch = (field: 'from' | 'to') =>
    router.push({ pathname: '/search', params: { field } });

  const choose = async (place: PlaceInput) => {
    setDestination(place);
    await places.addRecent(place).catch(() => undefined);
    if (startSet) router.push('/results');
    else void reload();
  };

  const confirmClear = () =>
    Alert.alert(t('home.clearConfirmTitle'), t('home.clearConfirmMessage'), [
      { text: t('home.cancel'), style: 'cancel' },
      {
        text: t('home.clear'),
        style: 'destructive',
        onPress: () => void places.clearRecents().then(reload),
      },
    ]);

  const savedRow = (kind: SavedKind) => {
    const place = saved[kind];
    const Icon = kind === 'home' ? HomeIcon : WorkIcon;
    const icon = <Icon color={theme.colors.text} />;
    if (!place) {
      const label = t(kind === 'home' ? 'home.setHome' : 'home.setWork');
      return (
        <PlaceRow
          key={kind}
          icon={icon}
          title={label}
          accessibilityLabel={label}
          onPress={() => router.push({ pathname: '/set-place/[kind]', params: { kind } })}
          testID={`saved-${kind}`}
        />
      );
    }
    const title = t(kind === 'home' ? 'home.home' : 'home.work');
    return (
      <PlaceRow
        key={kind}
        icon={icon}
        title={title}
        subtitle={place.address}
        accessibilityLabel={t('home.placeLabel', { name: title, address: place.address })}
        onPress={() => void choose(toInput(place))}
        testID={`saved-${kind}`}
      />
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <HomeMap coords={coords} />
      <SafeAreaView
        edges={['top']}
        style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}
      >
        <TripCard
          from={from}
          to={to}
          onPressFrom={() => openSearch('from')}
          onPressTo={() => openSearch('to')}
          onSwap={swap}
        />
        {locationOff ? (
          <View
            style={[
              styles.note,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
            ]}
          >
            <AppText variant="secondary">{t('home.locationOff')}</AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('home.turnOnInSettings')}
              onPress={() => void openAppSettings()}
              testID="open-settings"
              style={styles.inlineButton}
            >
              <AppText
                variant="secondary"
                style={{ color: theme.colors.accent, fontWeight: '600' }}
              >
                {t('home.turnOnInSettings')}
              </AppText>
            </Pressable>
          </View>
        ) : null}
        {isOffline ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.note,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
            ]}
          >
            <AppText variant="secondary">{t('home.offline')}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.retry')}
              onPress={() => void isDeviceOffline()}
              testID="offline-retry"
              style={styles.inlineButton}
            >
              <AppText
                variant="secondary"
                style={{ color: theme.colors.accent, fontWeight: '600' }}
              >
                {t('home.retry')}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
          },
        ]}
      >
        {/* Scrolls at large Dynamic Type sizes instead of clipping. */}
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <View style={styles.modeRow}>
            <AppText variant="heading">{t('home.showMeThe')}</AppText>
            <ModeToggle mode={mode} onChange={setMode} />
          </View>

          {recents.length > 0 ? (
            <View>
              <View style={styles.sectionHeader}>
                <AppText variant="caption" secondary accessibilityRole="header">
                  {t('home.recent')}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('home.clearRecentsLabel')}
                  onPress={confirmClear}
                  testID="clear-recents"
                  style={styles.inlineButton}
                >
                  <AppText variant="secondary" style={{ color: theme.colors.accent }}>
                    {t('home.clear')}
                  </AppText>
                </Pressable>
              </View>
              {recents.map((place) => (
                <PlaceRow
                  key={place.id}
                  icon={<ClockIcon color={theme.colors.text} />}
                  title={place.name}
                  subtitle={place.address}
                  accessibilityLabel={t('home.placeLabel', {
                    name: place.name,
                    address: place.address,
                  })}
                  onPress={() => void choose(toInput(place))}
                  testID={`recent-${place.id}`}
                />
              ))}
            </View>
          ) : null}

          <View>
            <AppText variant="caption" secondary accessibilityRole="header">
              {t('home.saved')}
            </AppText>
            {savedRow('home')}
            {savedRow('work')}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 12,
  },
  inlineButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '55%' },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
