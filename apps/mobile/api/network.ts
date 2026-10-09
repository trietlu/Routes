import NetInfo, { type NetInfoState, useNetInfo } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** Offline only when NetInfo says so; an unknown state counts as online. */
export const isOfflineState = (state: Pick<NetInfoState, 'isConnected'>): boolean =>
  state.isConnected === false;

export async function isDeviceOffline(): Promise<boolean> {
  return isOfflineState(await NetInfo.fetch());
}

/** Network status for banners (FR-21). */
export function useNetworkStatus(): { isOffline: boolean } {
  return { isOffline: isOfflineState(useNetInfo()) };
}

/** Lets TanStack Query pause while offline and refetch on reconnect. */
export function wireOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(!isOfflineState(state))),
  );
}
