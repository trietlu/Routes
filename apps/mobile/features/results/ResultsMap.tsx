import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { type Waypoint } from '@routes/api-types';
import {
  type LatLng,
  type OptionId,
  type RankMode,
  type RouteOption,
  decodePolyline,
  formatDuration,
  formatDurationSpoken,
  pointAlongPolyline,
} from '@routes/routing-core';
import { getAppConfig } from '../../config/env';
import { coreT, t } from '../../i18n';
import { routeColor, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { CONTINENTAL_US } from '../home/HomeMap';

/** Line widths: the selected route is drawn thicker and on top (UX § Visual language). */
export const SELECTED_WIDTH = 7;
export const UNSELECTED_WIDTH = 4;
/** Gap between the routes and the sheet when fitting the camera. */
export const SHEET_MARGIN = 24;
const EDGE = { top: 120, right: 40, left: 40 };

interface ResultsMapProps {
  start: Waypoint | null;
  destination: Waypoint | null;
  options: readonly RouteOption[];
  selected: OptionId;
  mode: RankMode;
  onSelect: (letter: OptionId) => void;
  /** Measured sheet height, so the camera keeps routes above it (FR-12). */
  sheetHeight: number;
}

const toCoord = (point: LatLng) => ({ latitude: point.lat, longitude: point.lng });

/**
 * The map behind the Results sheet (FR-12, FR-14, NFR-7): every route in its
 * color with a lettered bubble, the selected one on top, and pins for both
 * ends in every state so the map is never blank.
 */
export function ResultsMap({
  start,
  destination,
  options,
  selected,
  mode,
  onSelect,
  sheetHeight,
}: ResultsMapProps) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const provider = getAppConfig().mapProvider === 'google' ? PROVIDER_GOOGLE : undefined;

  const lines = useMemo(
    () =>
      options.map((option) => {
        const points = decodePolyline(option.polyline);
        return {
          option,
          points,
          coords: points.map(toCoord),
          bubble: pointAlongPolyline(points, 0.5),
        };
      }),
    [options],
  );

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

  // Fit every route above the sheet on load, on mode change and when the sheet resizes.
  useEffect(() => {
    const all = lines.flatMap((line) => line.coords);
    if (all.length === 0) return;
    map.current?.fitToCoordinates(all, {
      edgePadding: { ...EDGE, bottom: sheetHeight + SHEET_MARGIN },
      animated: true,
    });
  }, [lines, mode, sheetHeight]);

  return (
    <MapView
      ref={map}
      provider={provider}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      testID="results-map"
    >
      {lines.map(({ option, coords }) => {
        const isSelected = option.id === selected;
        const color = routeColor(theme.colors, option.id);
        return (
          <Polyline
            key={`line-${option.id}`}
            coordinates={coords}
            strokeColor={isSelected ? color : `${color}99`}
            strokeWidth={isSelected ? SELECTED_WIDTH : UNSELECTED_WIDTH}
            zIndex={isSelected ? 3 : 1}
            tappable
            onPress={() => onSelect(option.id)}
            testID={`route-line-${option.id}`}
          />
        );
      })}
      {lines.map(({ option, bubble }) => {
        if (!bubble) return null;
        const isSelected = option.id === selected;
        const color = routeColor(theme.colors, option.id);
        return (
          <Marker
            key={`bubble-${option.id}`}
            coordinate={toCoord(bubble)}
            onPress={() => onSelect(option.id)}
            zIndex={isSelected ? 4 : 2}
            accessibilityLabel={t('results.bubbleLabel', {
              letter: option.id,
              duration: formatDurationSpoken(option.durationSec, coreT),
            })}
            testID={`route-bubble-${option.id}`}
          >
            <View
              style={[
                styles.bubble,
                { backgroundColor: isSelected ? color : theme.colors.surface, borderColor: color },
              ]}
            >
              <AppText
                variant="caption"
                style={[
                  styles.bold,
                  { color: isSelected ? theme.colors.onRoute : theme.colors.text },
                ]}
              >
                {t('results.bubble', {
                  letter: option.id,
                  duration: formatDuration(option.durationSec, coreT),
                })}
              </AppText>
            </View>
          </Marker>
        );
      })}
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

const styles = StyleSheet.create({
  bubble: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  bold: { fontWeight: '700' },
});
