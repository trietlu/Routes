import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { type Waypoint } from '@routes/api-types';
import { getAppConfig } from '../../config/env';
import { t } from '../../i18n';
import { useTheme } from '../../theme';
import { CONTINENTAL_US } from '../home/HomeMap';

/**
 * The map behind the Results sheet. For now it shows the start and destination
 * pins in every state, so it is never blank (NFR-8); R-20 draws the routes.
 */
export function ResultsMap({
  start,
  destination,
}: {
  start: Waypoint | null;
  destination: Waypoint | null;
}) {
  const theme = useTheme();
  const provider = getAppConfig().mapProvider === 'google' ? PROVIDER_GOOGLE : undefined;
  const pins = [start, destination].filter((p): p is Waypoint => p !== null);
  const initialRegion =
    pins.length > 0
      ? {
          latitude: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
          longitude: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }
      : CONTINENTAL_US;
  return (
    <MapView
      provider={provider}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      testID="results-map"
    >
      {start ? (
        <Marker
          coordinate={{ latitude: start.lat, longitude: start.lng }}
          title={t('results.startPin')}
          pinColor={theme.colors.accent}
          testID="pin-start"
        />
      ) : null}
      {destination ? (
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title={t('results.destinationPin')}
          pinColor={theme.colors.text}
          testID="pin-destination"
        />
      ) : null}
    </MapView>
  );
}
