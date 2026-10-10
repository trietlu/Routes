import { canOpenURL, openURL } from 'expo-linking';
import { GOOGLE_MAPS_SCHEME } from './link';

/** The two Linking calls the handoff needs; injected so the logic is unit-tested. */
export interface Linker {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
}

export const expoLinker: Linker = { canOpenURL, openURL };

export type HandoffResult = { result: 'opened' } | { result: 'notInstalled' };

/**
 * Opens `url` in the Google Maps app (FR-16). An https link always opens
 * somewhere, so the app checks for Google Maps first; if it is missing, or
 * opening fails, the caller shows the "isn't installed" sheet (FR-17).
 */
export async function openInGoogleMaps(
  url: string,
  linker: Linker = expoLinker,
): Promise<HandoffResult> {
  try {
    if (!(await linker.canOpenURL(GOOGLE_MAPS_SCHEME))) return { result: 'notInstalled' };
    await linker.openURL(url);
    return { result: 'opened' };
  } catch {
    return { result: 'notInstalled' };
  }
}
