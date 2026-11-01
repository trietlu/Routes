/** expo-splash-screen: no native splash in tests; calls are recorded for assertions. */
export const preventAutoHideAsync = jest.fn(async () => true);
export const hideAsync = jest.fn(async () => undefined);
export const hide = jest.fn();
export const setOptions = jest.fn();
