import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type AutocompleteSuggestion } from '@routes/api-types';
import { formatDistance } from '@routes/routing-core';
import { useAutocomplete, usePlaceDetails } from '../../api/hooks';
import { coreT, t } from '../../i18n';
import { useCurrentLocation } from '../../location';
import { type Endpoint, useTrip } from '../../state';
import { type PlaceInput, type SavedKind } from '../../storage/places';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { useStorage } from '../app/services';
import { AppText } from '../common/AppText';
import { BackIcon, ClockIcon, CloseIcon, HomeIcon, PinIcon, WorkIcon } from '../common/icons';
import { fieldView } from '../home/HomeScreen';
import { PlaceRow } from '../home/PlaceRow';
import { useDefaultStart } from '../home/useDefaultStart';
import { useStoredPlaces } from './useStoredPlaces';

/** What the search is for: a trip endpoint (screen 3) or a saved place (S2). */
export type SearchTarget =
  { kind: 'trip'; field: 'from' | 'to' } | { kind: 'saved'; saved: SavedKind };

const MIN_QUERY = 2;

/** Screen 3, Search (FR-5, US-3); also S2, Set Home / Work (FR-7). */
export function SearchScreen({ target }: { target: SearchTarget }) {
  const theme = useTheme();
  const router = useRouter();
  const { places } = useStorage();
  const location = useCurrentLocation();
  const start = useTrip((s) => s.start);
  const destination = useTrip((s) => s.destination);
  const { setStart, setDestination } = useTrip((s) => s);
  const stored = useStoredPlaces();
  useDefaultStart(location);
  const [query, setQuery] = useState('');

  // Distances are from the trip start: a typed start, else the device location.
  const here = location.state === 'ready' ? location.coords : null;
  const origin =
    target.kind === 'trip' && target.field === 'to' && start !== null && start !== 'current'
      ? { lat: start.lat, lng: start.lng }
      : here;

  const suggestions = useAutocomplete(query, origin);
  const details = usePlaceDetails();
  const typing = query.trim().length >= MIN_QUERY;

  const startKnown = (endpoint: Endpoint | null) =>
    endpoint !== null && (endpoint !== 'current' || location.state === 'ready');

  const choose = async (place: PlaceInput) => {
    if (target.kind === 'saved') {
      await places.setSaved(target.saved, place);
      router.back();
      return;
    }
    await places.addRecent(place).catch(() => undefined);
    const nextStart = target.field === 'from' ? place : start;
    const nextDestination = target.field === 'to' ? place : destination;
    if (target.field === 'from') setStart(place);
    else setDestination(place);
    if (startKnown(nextStart) && nextDestination !== null) router.replace('/results');
    else router.back();
  };

  const pickSuggestion = async (suggestion: AutocompleteSuggestion) => {
    const place = await details.mutateAsync(suggestion.placeId).catch(() => null);
    if (!place) return;
    await choose({
      name: place.name || suggestion.primaryText,
      address: place.address || suggestion.secondaryText,
      placeId: place.placeId,
      lat: place.lat,
      lng: place.lng,
    });
  };

  const fieldPlaceholder =
    target.kind === 'saved'
      ? t('search.savedPlaceholder')
      : t(target.field === 'from' ? 'search.fromPlaceholder' : 'search.toPlaceholder');
  const fieldLabel =
    target.kind === 'saved'
      ? t(target.saved === 'home' ? 'home.setHome' : 'home.setWork')
      : t(target.field === 'from' ? 'search.fromLabel' : 'search.toLabel');
  const other =
    target.kind === 'trip'
      ? target.field === 'from'
        ? fieldView(destination, location, t('home.whereTo'))
        : fieldView(
            start ?? (location.state === 'locating' ? 'current' : null),
            location,
            t('home.enterStart'),
          )
      : null;

  const failed = suggestions.isError || details.isError;
  const loading = typing && (suggestions.isFetching || details.isPending);
  const results = suggestions.data?.suggestions ?? [];

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: theme.spacing.md, gap: theme.spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('search.back')}
          onPress={() => router.back()}
          testID="search-back"
          style={styles.iconButton}
        >
          <BackIcon color={theme.colors.text} />
        </Pressable>
        <View style={[styles.fields, { gap: theme.spacing.sm }]}>
          {target.kind === 'saved' ? (
            <AppText variant="title" accessibilityRole="header">
              {fieldLabel}
            </AppText>
          ) : (
            <View
              accessible
              accessibilityLabel={other!.spoken}
              testID="search-other"
              style={[
                styles.other,
                { backgroundColor: theme.colors.border, borderRadius: theme.radii.md },
              ]}
            >
              <AppText secondary={other!.placeholder} numberOfLines={1}>
                {other!.text}
              </AppText>
            </View>
          )}
          <View
            style={[
              styles.input,
              {
                borderColor: theme.colors.accent,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <PinIcon color={theme.colors.text} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={fieldPlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              accessibilityLabel={fieldLabel}
              autoCorrect={false}
              returnKeyType="search"
              testID="search-input"
              style={[styles.textInput, theme.typography.body, { color: theme.colors.text }]}
            />
            {loading ? (
              <ActivityIndicator accessibilityLabel={t('search.loading')} testID="search-loading" />
            ) : null}
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('search.clear')}
                onPress={() => setQuery('')}
                testID="search-clear"
                style={styles.iconButton}
              >
                <CloseIcon color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }}
      >
        {!typing ? (
          <>
            {stored.recents.map((place) => (
              <PlaceRow
                key={place.id}
                icon={<ClockIcon color={theme.colors.text} />}
                title={place.name}
                subtitle={place.address}
                accessibilityLabel={t('home.placeLabel', {
                  name: place.name,
                  address: place.address,
                })}
                onPress={() => void choose(place)}
                testID={`search-recent-${place.id}`}
              />
            ))}
            {(['home', 'work'] as const).map((kind) => {
              const saved = stored.saved[kind];
              if (!saved || target.kind === 'saved') return null;
              const title = t(kind === 'home' ? 'home.home' : 'home.work');
              const Icon = kind === 'home' ? HomeIcon : WorkIcon;
              return (
                <PlaceRow
                  key={kind}
                  icon={<Icon color={theme.colors.text} />}
                  title={title}
                  subtitle={saved.address}
                  accessibilityLabel={t('home.placeLabel', { name: title, address: saved.address })}
                  onPress={() => void choose(saved)}
                  testID={`search-saved-${kind}`}
                />
              );
            })}
          </>
        ) : failed ? (
          <View style={[styles.message, { gap: theme.spacing.sm }]}>
            <AppText secondary>{t('search.unavailable')}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.retry')}
              onPress={() => {
                details.reset();
                void suggestions.refetch();
              }}
              testID="search-retry"
              style={styles.iconButton}
            >
              <AppText style={{ color: theme.colors.accent, fontWeight: '600' }}>
                {t('search.retry')}
              </AppText>
            </Pressable>
          </View>
        ) : suggestions.isSuccess && results.length === 0 && !suggestions.isFetching ? (
          <View style={styles.message}>
            <AppText secondary>{t('search.noResults', { query: query.trim() })}</AppText>
          </View>
        ) : (
          results.map((suggestion) => {
            const distance =
              suggestion.distanceMeters !== undefined && origin !== null
                ? formatDistance(suggestion.distanceMeters, coreT)
                : null;
            return (
              <Pressable
                key={suggestion.placeId}
                accessibilityRole="button"
                accessibilityLabel={
                  distance
                    ? t('search.suggestionWithDistance', {
                        name: suggestion.primaryText,
                        address: suggestion.secondaryText,
                        distance,
                      })
                    : t('search.suggestionLabel', {
                        name: suggestion.primaryText,
                        address: suggestion.secondaryText,
                      })
                }
                onPress={() => void pickSuggestion(suggestion)}
                testID={`suggestion-${suggestion.placeId}`}
                style={[
                  styles.suggestion,
                  { borderColor: theme.colors.border, gap: theme.spacing.md },
                ]}
              >
                <View style={[styles.suggestionIcon, { backgroundColor: theme.colors.border }]}>
                  <PinIcon color={theme.colors.text} />
                </View>
                <View style={styles.fill}>
                  <AppText variant="heading">{suggestion.primaryText}</AppText>
                  <AppText variant="secondary" secondary>
                    {suggestion.secondaryText}
                  </AppText>
                </View>
                {distance ? (
                  <AppText variant="secondary" secondary>
                    {distance}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  fields: { flex: 1 },
  other: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 12 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    paddingLeft: 12,
    minHeight: MIN_TOUCH_TARGET + 4,
  },
  textInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 10 },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { paddingVertical: 24, alignItems: 'flex-start' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    minWidth: MIN_TOUCH_TARGET,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
