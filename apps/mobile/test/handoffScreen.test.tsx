import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import { fireEvent, screen } from 'expo-router/testing-library';
import { grantLocation, openDetail } from './flows';

const linking = Linking as unknown as { canOpenURL: jest.Mock; openURL: jest.Mock };
const EXPECTED_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Union%20Station&destination_place_id=fixture-union-station&travelmode=driving&dir_action=navigate';

beforeEach(() => {
  jest.clearAllMocks();
  grantLocation();
});

describe('Screen 5 handoff', () => {
  it('UI-DET-06: Share opens the share sheet with the expected text', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await openDetail('A');
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({
      message: `Route A via Hwy 12 to Union Station: 22 min, 9.8 mi, est. $5.12 (incl. $3.75 toll). ${EXPECTED_URL}`,
    });
    share.mockRestore();
  });

  it('UI-DET-07: installed → openURL with the directions link', async () => {
    linking.canOpenURL.mockResolvedValue(true);
    await openDetail('A');
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Google Maps' }));
    expect(linking.canOpenURL).toHaveBeenCalledWith('comgooglemaps://');
    expect(linking.openURL).toHaveBeenCalledWith(EXPECTED_URL);
    expect(screen.queryByText("Google Maps isn't installed")).toBeNull();
  });

  it('UI-DET-07: not installed → S3 sheet; Open in browser and Get Google Maps open the right links; Cancel closes', async () => {
    linking.canOpenURL.mockResolvedValue(false);
    await openDetail('A');
    const open = () => fireEvent.press(screen.getByRole('button', { name: 'Open in Google Maps' }));

    await open();
    expect(await screen.findByRole('header', { name: "Google Maps isn't installed" })).toBeTruthy();
    expect(
      screen.getByText('Open this route in your browser, or get the Google Maps app.'),
    ).toBeTruthy();
    expect(linking.openURL).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Open in browser' }));
    expect(linking.openURL).toHaveBeenLastCalledWith(EXPECTED_URL);
    expect(screen.queryByText("Google Maps isn't installed")).toBeNull();

    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Get Google Maps' }));
    expect(linking.openURL).toHaveBeenLastCalledWith('https://apps.apple.com/app/id585027354');

    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText("Google Maps isn't installed")).toBeNull();
    expect(linking.openURL).toHaveBeenCalledTimes(2);
  });
});
