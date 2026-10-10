import { act, renderHook } from '@testing-library/react-native';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import { type ProviderRoute } from '@routes/api-types';
import { useNow } from '../features/common/useNow';
import { formatClockTime } from '../i18n/time';
import { a11yProblems, pressables } from './a11y';
import { fixtureRoutes } from './fixtures';
import { fakeRoutesClient, grantLocation, openDetail } from './flows';

beforeEach(() => {
  jest.clearAllMocks();
  grantLocation();
});
afterEach(() => jest.useRealTimers());

const costText = (label: string) => {
  const card = screen.getByTestId('cost-card');
  const texts = within(card)
    .getAllByText(/.+/)
    .map((n) => n.props.children as string);
  return texts[texts.indexOf(label) + 1];
};

describe('Screen 5 — Route detail', () => {
  it('UI-DET-01: canonical A — header, "9.8 mi · arrive h:mm", Tolls $3.75, Fuel $1.37, Trip cost $5.12', async () => {
    await openDetail('A');
    expect(screen.getByRole('header', { name: 'via Hwy 12 · Union Station' })).toBeTruthy();
    expect(screen.getByText('FASTEST')).toBeTruthy();
    expect(screen.getByText('22 min')).toBeTruthy();
    expect(screen.getByTestId('detail-arrival').props.children).toMatch(
      /^9\.8 mi · arrive \d{1,2}:\d{2} (AM|PM)$/,
    );
    expect(costText('Tolls')).toBe('$3.75');
    expect(costText('Fuel (estimated)')).toBe('$1.37');
    expect(costText('Trip cost (estimated)')).toBe('$5.12');
  });

  it('the map shows only the selected route, without bubbles', async () => {
    await openDetail('B');
    const map = screen.getByTestId('detail-map', { includeHiddenElements: true });
    expect(
      within(map)
        .getAllByTestId(/^route-line-/, { includeHiddenElements: true })
        .map((n) => n.props.testID),
    ).toEqual(['route-line-B']);
    expect(
      within(map).queryAllByTestId(/^route-bubble-/, { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  it('UI-DET-02: arrival = now + duration, refreshed each minute', async () => {
    expect(formatClockTime(new Date(2026, 9, 9, 14, 0))).toBe('2:00 PM');
    expect(formatClockTime(new Date(2026, 9, 9, 0, 5))).toBe('12:05 AM');
    expect(formatClockTime(new Date(2026, 9, 9, 12, 30))).toBe('12:30 PM');
    expect(formatClockTime(new Date(2026, 9, 9, 9, 7))).toBe('9:07 AM');

    jest.useFakeTimers({ now: new Date(2026, 9, 9, 14, 0, 0) });
    const { result } = await renderHook(() => useNow());
    const arrival = () => formatClockTime(new Date(result.current.getTime() + 1320 * 1000));
    expect(arrival()).toBe('2:22 PM');
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(arrival()).toBe('2:23 PM');
  });

  it('UI-DET-03: key steps capped at 8 with "Show all steps"; no toll row', async () => {
    const canonical = fixtureRoutes('fixture-union-station')[0]!;
    const longRoute: ProviderRoute = {
      ...canonical,
      steps: Array.from({ length: 12 }, (_, i) => ({
        instruction: `Step ${i + 1}`,
        maneuver: i % 2 ? 'TURN_LEFT' : 'TURN_RIGHT',
        distanceM: 1000,
      })),
    };
    await openDetail('A', fakeRoutesClient([longRoute]));
    const steps = () => within(screen.getByTestId('key-steps')).getAllByTestId(/^step-/);
    expect(steps()).toHaveLength(8);
    expect(steps()[7]).toHaveProp('accessibilityLabel', 'Arrive at Union Station, 0.6 mi');
    expect(screen.queryByText(/toll/i, { exact: false })).not.toBeNull(); // the cost card has "Tolls"…
    expect(within(screen.getByTestId('key-steps')).queryByText(/toll/i)).toBeNull(); // …the steps don't
    await fireEvent.press(screen.getByRole('button', { name: 'Show all steps' }));
    expect(steps()).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Show all steps' })).toBeNull();
  });

  it('UI-DET-04: the handoff note; a toll-free route adds the Avoid tolls hint, a tolled one does not', async () => {
    await openDetail('A');
    expect(
      screen.getByText('Directions open in Google Maps, which may pick a different road.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('To keep this route toll-free, turn on Avoid tolls in Google Maps.'),
    ).toBeNull();
  });

  it('UI-DET-04: toll-free route B shows the Avoid tolls hint', async () => {
    await openDetail('B');
    expect(
      screen.getByText('Directions open in Google Maps, which may pick a different road.'),
    ).toBeTruthy();
    expect(
      screen.getByText('To keep this route toll-free, turn on Avoid tolls in Google Maps.'),
    ).toBeTruthy();
    expect(costText('Tolls')).toBe('No tolls');
  });

  it('UI-DET-05: default-vehicle footnote; "Set your vehicle" opens Edit vehicle', async () => {
    await openDetail('A');
    expect(screen.getByText('Fuel uses default settings (25 mpg, $3.50/gal).')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Set your vehicle' }));
    expect(await screen.findByRole('header', { name: 'Your vehicle' })).toBeTruthy();
  });

  it('UI-DET-05: user-set vehicle footnote with "Edit vehicle"', async () => {
    await openDetail('A', undefined, async (s) => {
      await s.vehicle.save({ mpg: 40, fuelType: 'regular', pricePerGallon: 4 });
    });
    expect(screen.getByText('Fuel uses your vehicle settings.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit vehicle' })).toBeTruthy();
    expect(costText('Trip cost (estimated)')).toBe('$4.73');
  });

  it('unknown toll shows "Price unknown" and "$X.XX + toll"', async () => {
    const unknown = fixtureRoutes('fixture-unknown-toll');
    await openDetail('A', fakeRoutesClient(unknown));
    expect(costText('Tolls')).toBe('Price unknown');
    expect(costText('Trip cost (estimated)')).toMatch(/^\$\d+\.\d\d \+ toll$/);
  });

  it('Back returns to Results with the same selection', async () => {
    await openDetail('C');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to routes' }));
    expect(await screen.findByRole('button', { name: 'Go with route C' })).toBeTruthy();
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    await openDetail('A');
    expect(pressables(screen.root).length).toBeGreaterThanOrEqual(4);
    expect(a11yProblems(screen.root)).toEqual([]);
  });
});
