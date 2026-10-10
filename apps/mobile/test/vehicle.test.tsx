import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { parseMpg, parsePrice } from '../features/vehicle/validation';
import { a11yProblems, pressables } from './a11y';
import { grantLocation, openDetail, openUnionResults } from './flows';

beforeEach(() => {
  jest.clearAllMocks();
  grantLocation();
});

const mpgField = () => screen.getByLabelText('Fuel economy, miles per gallon');
const priceField = () => screen.getByLabelText('Fuel price, dollars per gallon');
const saveButton = () => screen.getByRole('button', { name: 'Save' });

async function openVehicleFromDetail() {
  const storage = await openDetail('A');
  await fireEvent.press(screen.getByRole('link', { name: 'Set your vehicle' }));
  await screen.findByRole('header', { name: 'Your vehicle' });
  return storage;
}

describe('S1 — Edit vehicle', () => {
  it('UI-VEH-01: shows the defaults; invalid mpg and price show errors and disable Save', async () => {
    await openVehicleFromDetail();
    expect(mpgField()).toHaveProp('value', '25');
    expect(priceField()).toHaveProp('value', '3.50');
    expect(screen.getByRole('radio', { name: 'Regular' })).toBeSelected();
    expect(
      screen.getByText("Used to estimate fuel cost. Fuel prices aren't updated automatically."),
    ).toBeTruthy();
    expect(saveButton()).toBeEnabled();

    for (const bad of ['0', '151', 'abc', '25.55']) {
      await fireEvent.changeText(mpgField(), bad);
      expect(screen.getByText('Enter a number from 5 to 150, with up to 1 decimal.')).toBeTruthy();
      expect(saveButton()).toBeDisabled();
    }
    await fireEvent.changeText(mpgField(), '33.5');
    expect(screen.queryByText('Enter a number from 5 to 150, with up to 1 decimal.')).toBeNull();
    expect(saveButton()).toBeEnabled();

    for (const bad of ['0.49', '15.01', '4.005', '']) {
      await fireEvent.changeText(priceField(), bad);
      expect(
        screen.getByText('Enter a price from $0.50 to $15.00, with up to 2 decimals.'),
      ).toBeTruthy();
      expect(saveButton()).toBeDisabled();
    }
    await fireEvent.changeText(priceField(), '15.00');
    expect(saveButton()).toBeEnabled();
  });

  it('numeric fields use the decimal keyboard and are labelled', async () => {
    await openVehicleFromDetail();
    expect(mpgField()).toHaveProp('keyboardType', 'decimal-pad');
    expect(priceField()).toHaveProp('keyboardType', 'decimal-pad');
    await fireEvent.changeText(mpgField(), '0');
    expect(mpgField()).toHaveProp(
      'accessibilityHint',
      'Enter a number from 5 to 150, with up to 1 decimal.',
    );
  });

  it('UI-VEH-02: Save persists, returns, and costs update (40 mpg, $4.00 → A $4.73) on detail and Results', async () => {
    const storage = await openVehicleFromDetail();
    await fireEvent.changeText(mpgField(), '40');
    await fireEvent.changeText(priceField(), '4.00');
    await fireEvent.press(screen.getByRole('radio', { name: 'Premium' }));
    await fireEvent.press(saveButton());

    // Back on route A's detail.
    const card = await screen.findByTestId('cost-card');
    await waitFor(() => expect(within(card).getByText('$4.73')).toBeTruthy());
    expect(screen.getByText('Fuel uses your vehicle settings.')).toBeTruthy();
    expect(await storage.vehicle.get()).toEqual({
      mpg: 40,
      fuelType: 'premium',
      pricePerGallon: 4,
      isUserSet: true,
    });
    expect(await storage.preferences.getCheapestVehiclePromptShown()).toBe(true);

    // And on Results.
    await fireEvent.press(screen.getByRole('button', { name: 'Back to routes' }));
    const cardA = await screen.findByTestId('route-card-A');
    expect(within(cardA).getByText('$4.73')).toBeTruthy();
  });

  it('Back leaves without saving', async () => {
    const storage = await openVehicleFromDetail();
    await fireEvent.changeText(mpgField(), '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByTestId('cost-card')).toBeTruthy();
    expect((await storage.vehicle.get()).isUserSet).toBe(false);
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    await openVehicleFromDetail();
    expect(pressables(screen.root).length).toBeGreaterThanOrEqual(6);
    expect(a11yProblems(screen.root)).toEqual([]);
  });
});

describe('Cheapest vehicle prompt (UI-RES-12)', () => {
  const PROMPT = 'Using 25 mpg at $3.50/gal.';

  it('shows on the first Cheapest view with the default vehicle, not on Fastest', async () => {
    await openUnionResults();
    expect(screen.queryByText(PROMPT)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Set your vehicle' })).toBeTruthy();
  });

  it('dismissing hides it permanently', async () => {
    const storage = await openUnionResults();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(await storage.preferences.getCheapestVehiclePromptShown()).toBe(true);

    // Switching away and back doesn't bring it back.
    await fireEvent.press(screen.getByRole('radio', { name: 'Fastest' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('stays dismissed on a later launch (the flag is stored)', async () => {
    await openUnionResults(undefined, (s) => s.preferences.setCheapestVehiclePromptShown(true));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    await screen.findByText('Ranked by trip cost');
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('is not shown once a vehicle is set', async () => {
    await openUnionResults(undefined, async (s) => {
      await s.vehicle.save({ mpg: 30, fuelType: 'regular', pricePerGallon: 3.5 });
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    await screen.findByText('Ranked by trip cost');
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('"Set your vehicle" opens S1, and saving retires the prompt', async () => {
    const storage = await openUnionResults();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    await fireEvent.press(await screen.findByRole('link', { name: 'Set your vehicle' }));
    await screen.findByRole('header', { name: 'Your vehicle' });
    await fireEvent.press(saveButton());
    await screen.findByText('Ranked by trip cost');
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(await storage.preferences.getCheapestVehiclePromptShown()).toBe(true);
  });
});

describe('vehicle validation', () => {
  it('accepts the documented ranges and decimals', () => {
    expect(parseMpg('5')).toBe(5);
    expect(parseMpg('150')).toBe(150);
    expect(parseMpg(' 33.5 ')).toBe(33.5);
    expect(parseMpg('40.')).toBe(40);
    expect(parseMpg('.5')).toBeNull(); // below 5
    expect(parseMpg('4.9')).toBeNull();
    expect(parseMpg('-10')).toBeNull();
    expect(parsePrice('0.50')).toBe(0.5);
    expect(parsePrice('.75')).toBe(0.75);
    expect(parsePrice('15')).toBe(15);
    expect(parsePrice('3.499')).toBeNull();
    expect(parsePrice('$3')).toBeNull();
  });
});
