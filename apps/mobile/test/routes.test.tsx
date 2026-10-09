import { screen } from 'expo-router/testing-library';
import { renderApp, useTestStorage } from './appHarness';

/** Every route renders (smoke test). Placeholders are replaced as screens land. */
describe('routes', () => {
  it('/ renders Home', async () => {
    await useTestStorage((storage) => storage.preferences.setLocationPromptShown(true));
    await renderApp('/');
    expect(await screen.findByText('Show me the')).toBeTruthy();
  });

  const cases: [string, string][] = [
    ['/onboarding', 'Three good ways there.'],
    ['/search', 'Search'],
    ['/results', 'Routes'],
    ['/route/B', 'Route B'],
    ['/vehicle', 'Your vehicle'],
    ['/set-place/home', 'Set Home'],
    ['/set-place/work', 'Set Work'],
  ];

  it.each(cases)('%s renders "%s"', async (route, title) => {
    await useTestStorage((storage) => storage.preferences.setLocationPromptShown(true));
    await renderApp(route);
    expect(await screen.findByRole('header', { name: title })).toBeTruthy();
  });

  it('first launch goes to onboarding instead of Home', async () => {
    await useTestStorage();
    await renderApp('/');
    expect(await screen.findByRole('header', { name: 'Three good ways there.' })).toBeTruthy();
  });
});
