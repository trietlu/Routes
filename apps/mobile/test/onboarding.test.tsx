import * as Location from 'expo-location';
import { fireEvent, screen } from 'expo-router/testing-library';
import { a11yProblems, pressables } from './a11y';
import { renderApp, useTestStorage } from './appHarness';

const mocked = Location as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.requestForegroundPermissionsAsync!.mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  });
});

async function showOnboarding() {
  const storage = await useTestStorage();
  await renderApp('/onboarding');
  await screen.findByRole('header', { name: 'Three good ways there.' });
  return storage;
}

describe('Screen 1 — Onboarding', () => {
  it('UI-ONB-01: renders title, body, both buttons and footnote; no permission request on mount', async () => {
    await showOnboarding();
    expect(
      screen.getByText(
        "Routes compares the fastest and the cheapest ways to get where you're going. Share your location and we'll fill in where you're starting from.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allow location access' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter a start address instead' })).toBeTruthy();
    expect(
      screen.getByText(
        'Your location is only used to set your starting point. You can change this anytime in Settings.',
      ),
    ).toBeTruthy();
    // Decorative, so hidden from VoiceOver.
    expect(
      screen.getByTestId('onboarding-illustration', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('UI-ONB-02: "Allow" requests foreground permission, records the prompt and goes to Home', async () => {
    const storage = await showOnboarding();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow location access' }));
    expect(await screen.findByText('Show me the')).toBeTruthy(); // Home
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await storage.preferences.getLocationPromptShown()).toBe(true);
  });

  it('UI-ONB-02: "Allow" still goes to Home when the user denies', async () => {
    mocked.requestForegroundPermissionsAsync!.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    const storage = await showOnboarding();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow location access' }));
    expect(await screen.findByText('Show me the')).toBeTruthy(); // Home
    expect(await storage.preferences.getLocationPromptShown()).toBe(true);
  });

  it('UI-ONB-02: "Enter a start address" opens Search for From with no permission request', async () => {
    const storage = await showOnboarding();
    await fireEvent.press(screen.getByRole('button', { name: 'Enter a start address instead' }));
    expect(await screen.findByRole('header', { name: 'Search' })).toBeTruthy();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(await storage.preferences.getLocationPromptShown()).toBe(true);
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    await showOnboarding();
    expect(pressables(screen.root)).toHaveLength(2);
    expect(a11yProblems(screen.root)).toEqual([]);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
