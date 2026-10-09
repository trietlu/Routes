/** Network state; tests flip `isConnected` to exercise offline states (FR-21). */
type State = { isConnected: boolean | null; isInternetReachable: boolean | null; type: string };

let state: State = { isConnected: true, isInternetReachable: true, type: 'wifi' };
const listeners = new Set<(next: State) => void>();

export function setNetworkState(next: Partial<State>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

export function resetNetworkState(): void {
  state = { isConnected: true, isInternetReachable: true, type: 'wifi' };
}

const NetInfo = {
  fetch: jest.fn(async () => state),
  addEventListener: jest.fn((listener: (next: State) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
  useNetInfo: jest.fn(() => state),
};

export const useNetInfo = NetInfo.useNetInfo;
export default NetInfo;
