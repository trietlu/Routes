import { rankRoutes } from '@routes/routing-core';
import appConfig from '../app.config';
import {
  APP_STORE_URL,
  type HandoffEndpoint,
  type Linker,
  buildDirectionsUrl,
  buildShareText,
  openInGoogleMaps,
} from '../handoff';
import { fixtureRoutes } from './fixtures';

const HERE: HandoffEndpoint = { kind: 'current', lat: 39.7392, lng: -104.9903 };
const UNION: HandoffEndpoint = {
  kind: 'place',
  name: 'Union Station',
  placeId: 'fixture-union-station',
  lat: 39.8255,
  lng: -104.906,
};
const HOME: HandoffEndpoint = {
  kind: 'place',
  name: 'Home',
  placeId: 'home-1',
  lat: 39.7,
  lng: -105,
};

const params = (url: string) => new URL(url).searchParams;

function linker(
  installed: boolean | Error,
  open: 'ok' | Error = 'ok',
): Linker & {
  canOpenURL: jest.Mock;
  openURL: jest.Mock;
} {
  return {
    canOpenURL: jest.fn(async () => {
      if (installed instanceof Error) throw installed;
      return installed;
    }),
    openURL: jest.fn(async () => {
      if (open instanceof Error) throw open;
      return true;
    }),
  };
}

describe('Google Maps link', () => {
  it('APP-HAND-01: current-location start omits origin; has destination, place ID, driving and navigate', () => {
    const url = buildDirectionsUrl(HERE, UNION);
    expect(url.startsWith('https://www.google.com/maps/dir/?api=1&')).toBe(true);
    const p = params(url);
    expect(p.has('origin')).toBe(false);
    expect(p.get('destination')).toBe('Union Station');
    expect(p.get('destination_place_id')).toBe('fixture-union-station');
    expect(p.get('travelmode')).toBe('driving');
    expect(p.get('dir_action')).toBe('navigate');
  });

  it('APP-HAND-02: a typed start → origin=lat,lng; current destination (after a swap) → destination=lat,lng, no place ID', () => {
    const p = params(buildDirectionsUrl(HOME, HERE));
    expect(p.get('origin')).toBe('39.7,-105');
    expect(p.get('destination')).toBe('39.7392,-104.9903');
    expect(p.has('destination_place_id')).toBe(false);

    // A destination with no place ID also falls back to coordinates.
    const noId = params(buildDirectionsUrl(HERE, { ...UNION, placeId: null }));
    expect(noId.get('destination')).toBe('39.8255,-104.906');
    expect(noId.has('destination_place_id')).toBe(false);
  });

  it('APP-HAND-03: names with &, #, spaces and unicode are URL-encoded', () => {
    const name = 'Café & Bar #2 — Ünion';
    const url = buildDirectionsUrl(HERE, { ...UNION, name, placeId: 'id with space&x' });
    expect(url).toContain(`destination=${encodeURIComponent(name)}`);
    expect(url).toContain('destination_place_id=id%20with%20space%26x');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('#');
    expect(params(url).get('destination')).toBe(name);
    expect(params(url).get('travelmode')).toBe('driving'); // the & in the name didn't split the query
    expect(buildDirectionsUrl(HOME, UNION)).toContain('origin=39.7%2C-105');
  });
});

describe('opening Google Maps', () => {
  it('APP-HAND-04: installed → openURL(link) → opened', async () => {
    const l = linker(true);
    expect(await openInGoogleMaps('https://maps/link', l)).toEqual({ result: 'opened' });
    expect(l.canOpenURL).toHaveBeenCalledWith('comgooglemaps://');
    expect(l.openURL).toHaveBeenCalledWith('https://maps/link');
  });

  it('APP-HAND-04: not installed → notInstalled without opening; openURL rejecting → notInstalled', async () => {
    const missing = linker(false);
    expect(await openInGoogleMaps('https://maps/link', missing)).toEqual({
      result: 'notInstalled',
    });
    expect(missing.openURL).not.toHaveBeenCalled();

    const failing = linker(true, new Error('cannot open'));
    expect(await openInGoogleMaps('https://maps/link', failing)).toEqual({
      result: 'notInstalled',
    });

    const broken = linker(new Error('query failed'));
    expect(await openInGoogleMaps('https://maps/link', broken)).toEqual({ result: 'notInstalled' });
  });

  it('APP-HAND-05: the App Store URL', () => {
    expect(APP_STORE_URL).toBe('https://apps.apple.com/app/id585027354');
  });

  it('LSApplicationQueriesSchemes contains comgooglemaps', () => {
    const config = appConfig({ config: {} } as never);
    expect(config.ios?.infoPlist?.LSApplicationQueriesSchemes).toContain('comgooglemaps');
  });

  it('the default linker uses expo-linking', async () => {
    const Linking = jest.requireMock('expo-linking') as {
      canOpenURL: jest.Mock;
      openURL: jest.Mock;
    };
    Linking.canOpenURL.mockResolvedValueOnce(true);
    expect(await openInGoogleMaps('https://maps/link')).toEqual({ result: 'opened' });
    expect(Linking.openURL).toHaveBeenCalledWith('https://maps/link');
  });
});

describe('share text', () => {
  const url = 'https://www.google.com/maps/dir/?api=1&x';

  it('APP-HAND-06: priced, toll-free and unknown-toll routes', () => {
    const [a, b] = rankRoutes(fixtureRoutes('fixture-union-station'), 'fastest').options;
    expect(buildShareText(a!, 'Union Station', url)).toBe(
      `Route A via Hwy 12 to Union Station: 22 min, 9.8 mi, est. $5.12 (incl. $3.75 toll). ${url}`,
    );
    expect(buildShareText(b!, 'Union Station', url)).toBe(
      `Route B via Elm Ave & 3rd St to Union Station: 27 min, 10.6 mi, est. $1.48 (no tolls). ${url}`,
    );
    const [unknown] = rankRoutes(fixtureRoutes('fixture-unknown-toll'), 'fastest').options;
    expect(buildShareText(unknown!, 'Unknown Toll Test', url)).toMatch(
      /^Route A via Toll Rd 7 to Unknown Toll Test: 24 min, 12\.0 mi, est\. \$\d+\.\d\d \+ toll \(toll price unknown\)\. https:/,
    );
  });
});
