import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

/** Map calls a test can assert on, e.g. `fitToCoordinates` (UI-RES-06). */
export const mapMethods = {
  fitToCoordinates: jest.fn(),
  animateToRegion: jest.fn(),
};

// Map props are free-form here; tests read them back off the rendered views.
type Props = Record<string, unknown>;

const idOr = (props: Props, fallback: string): string =>
  typeof props.testID === 'string' ? props.testID : fallback;

const MapView = forwardRef<typeof mapMethods, Props>(function MapView(props, ref) {
  useImperativeHandle(ref, () => mapMethods);
  return <View testID={idOr(props, 'map-view')}>{props.children as ReactNode}</View>;
});

/** Overlays render as plain views carrying their props, so tests can inspect them. */
const overlay = (name: string) =>
  function Overlay(props: Props) {
    return <View {...props} testID={idOr(props, name)} />;
  };

export const Polyline = overlay('map-polyline');
export const Marker = overlay('map-marker');
export const Callout = overlay('map-callout');
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;
export default MapView;
