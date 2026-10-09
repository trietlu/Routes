/** Foreground-only location APIs (NFR-4). Tests set the resolved values. */
export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
} as const;

export const Accuracy = { Balanced: 3, High: 4 } as const;

const permission = { status: PermissionStatus.UNDETERMINED, granted: false, canAskAgain: true };

export const getForegroundPermissionsAsync = jest.fn(async () => permission);
export const requestForegroundPermissionsAsync = jest.fn(async () => permission);
export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 },
  timestamp: 0,
}));
export const getLastKnownPositionAsync = jest.fn(async () => null);
export const reverseGeocodeAsync = jest.fn(async () => [
  { streetNumber: '1437', street: 'Bannock St', city: 'Denver', region: 'CO' },
]);
