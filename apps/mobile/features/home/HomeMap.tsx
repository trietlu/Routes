import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { getAppConfig } from '../../config/env';
import { t } from '../../i18n';
import { type Coordinates } from '../../state/location';
import { MIN_TOUCH_TARGET, useTheme } from '../../theme';
import { CrosshairIcon } from '../common/icons';

/** Shown when there is no location at all, so the map is never blank. */
export const CONTINENTAL_US: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 28,
  longitudeDelta: 28,
};

const regionAround = (coords: Coordinates): Region => ({
  latitude: coords.lat,
  longitude: coords.lng,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
});

/**
 * Full-bleed map centered on the current location (blue dot), or the last
 * region it showed, or the continental US (UX screen 2).
 */
export function HomeMap({ coords }: { coords: Coordinates | null }) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const provider = getAppConfig().mapProvider === 'google' ? PROVIDER_GOOGLE : undefined;

  useEffect(() => {
    if (coords) map.current?.animateToRegion(regionAround(coords), 300);
  }, [coords]);

  return (
    <>
      <MapView
        ref={map}
        provider={provider}
        style={StyleSheet.absoluteFill}
        initialRegion={coords ? regionAround(coords) : CONTINENTAL_US}
        showsUserLocation={coords !== null}
        showsMyLocationButton={false}
        testID="home-map"
      />
      {coords ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.recenter')}
          onPress={() => map.current?.animateToRegion(regionAround(coords), 300)}
          testID="recenter"
          style={[styles.recenter, { backgroundColor: theme.colors.surface }]}
        >
          <CrosshairIcon color={theme.colors.accent} />
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: '50%',
    width: MIN_TOUCH_TARGET + 4,
    height: MIN_TOUCH_TARGET + 4,
    borderRadius: (MIN_TOUCH_TARGET + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
