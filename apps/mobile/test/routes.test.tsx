import path from 'node:path';
import { renderRouter, screen } from 'expo-router/testing-library';

const APP_DIR = path.join(__dirname, '..', 'app');

/** Every placeholder route renders its title (R-11 smoke test). */
describe('placeholder routes', () => {
  const cases: [string, string][] = [
    ['/', 'Home'],
    ['/onboarding', 'Welcome to Routes'],
    ['/search', 'Search'],
    ['/results', 'Routes'],
    ['/route/B', 'Route B'],
    ['/vehicle', 'Your vehicle'],
    ['/set-place/home', 'Set Home'],
    ['/set-place/work', 'Set Work'],
  ];

  it.each(cases)('%s renders "%s"', async (route, title) => {
    await renderRouter(APP_DIR, { initialUrl: route });
    expect(await screen.findByRole('header', { name: title })).toBeTruthy();
  });
});
