import * as SplashScreen from 'expo-splash-screen';
import { screen, waitFor } from 'expo-router/testing-library';
import { SPLASH_MIN_VISIBLE_MS, configureStorageOpener } from '../features/app/services';
import { type Storage } from '../storage';
import { renderApp, useTestStorage } from './appHarness';

const mocked = SplashScreen as unknown as Record<string, jest.Mock>;

describe('splash screen (#85)', () => {
  it('APP-SPL-01: is held from startup, and hidden 1.5 s after storage opens and the first screen mounts', async () => {
    expect(SPLASH_MIN_VISIBLE_MS).toBe(1500);
    // Called when the app module loads, before anything renders.
    expect(mocked.preventAutoHideAsync).toHaveBeenCalled();
    expect(mocked.setOptions).toHaveBeenCalledWith({ duration: 250, fade: true });

    const storage = await useTestStorage((s) => s.preferences.setLocationPromptShown(true));
    let open: (value: Storage) => void = () => undefined;
    configureStorageOpener(() => new Promise<Storage>((resolve) => (open = resolve)));

    await renderApp('/');
    expect(mocked.hideAsync).not.toHaveBeenCalled();

    open(storage);
    await screen.findByText('Show me the');
    // The app is ready, but the splash stays up for the minimum time first.
    expect(mocked.hideAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(mocked.hideAsync).toHaveBeenCalledTimes(1), {
      timeout: SPLASH_MIN_VISIBLE_MS + 1000,
    });
  });
});
