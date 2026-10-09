import { getForegroundPermissionsAsync, requestForegroundPermissionsAsync } from 'expo-location';
import { openURL } from 'expo-linking';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

const statusOf = (response: { granted: boolean; status: string }): PermissionStatus => {
  if (response.granted) return 'granted';
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
};

/** Current When-In-Use permission, without prompting (FR-1). */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  return statusOf(await getForegroundPermissionsAsync());
}

/**
 * Shows the iOS When-In-Use prompt. Only the onboarding "Allow" button calls
 * this; nothing requests permission automatically (FR-1, NFR-4).
 */
export async function requestPermission(): Promise<PermissionStatus> {
  return statusOf(await requestForegroundPermissionsAsync());
}

/** Opens this app's page in iOS Settings (FR-3). */
export async function openAppSettings(): Promise<void> {
  await openURL('app-settings:');
}
