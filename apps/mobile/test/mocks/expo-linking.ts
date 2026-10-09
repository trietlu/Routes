/** Linking calls the handoff tests assert on (APP-HAND-04, UI-DET-07). */
export const canOpenURL = jest.fn(async () => true);
export const openURL = jest.fn(async () => true);
export const openSettings = jest.fn(async () => undefined);
export const createURL = jest.fn((path: string) => `routes://${path.replace(/^\//, '')}`);
export const useURL = jest.fn(() => null);
export const parse = jest.fn((url: string) => ({ scheme: 'routes', path: url, queryParams: {} }));
