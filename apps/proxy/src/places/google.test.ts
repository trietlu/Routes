import nock from 'nock';
import { type FastifyInstance } from 'fastify';
import { AutocompleteResponseSchema, PlaceDetailsSchema } from '@routes/api-types';
import { buildApp, loadConfig } from '../index';
import { normalizeAutocomplete, normalizeDetails } from './normalize';

const API_KEY = 'test-places-key-xyz789';
const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const PLACES = 'https://places.googleapis.com';

const AUTOCOMPLETE_BODY = {
  suggestions: [
    {
      placePrediction: {
        place: 'places/ChIJunion',
        placeId: 'ChIJunion',
        text: { text: 'Union Station, 100 Union Plaza' },
        structuredFormat: {
          mainText: { text: 'Union Station' },
          secondaryText: { text: '100 Union Plaza' },
        },
        distanceMeters: 14645,
      },
    },
    { queryPrediction: { text: { text: 'union station parking' } } },
  ],
};

const DETAILS_BODY = {
  id: 'ChIJunion',
  displayName: { text: 'Union Station', languageCode: 'en' },
  formattedAddress: '100 Union Plaza',
  location: { latitude: 39.8255, longitude: -104.906 },
};

type Body = Record<string, unknown>;
let app: FastifyInstance;
let logLines: string[];

function setup(env: Record<string, string> = {}): void {
  logLines = [];
  app = buildApp(
    loadConfig({
      NODE_ENV: 'test',
      PROVIDER: 'google',
      GOOGLE_MAPS_API_KEY: API_KEY,
      // These tests exercise the provider; repeated requests must reach Google.
      AUTOCOMPLETE_CACHE_TTL_SEC: '0',
      DETAILS_CACHE_TTL_SEC: '0',
      ...env,
    }),
    { logStream: { write: (line: string) => void logLines.push(line) } },
  );
}

const get = (url: string) =>
  app.inject({ method: 'GET', url, headers: { 'x-device-id': DEVICE_ID } });

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
afterEach(async () => {
  nock.cleanAll();
  await app?.close();
});

describe('Google places provider', () => {
  it('PX-PLACES-01: autocomplete sends input, origin, locationBias, includedRegionCodes and sessionToken; maps distanceMeters', async () => {
    setup();
    let sent: Body | undefined;
    let headers: Record<string, unknown> = {};
    const scope = nock(PLACES)
      .post('/v1/places:autocomplete')
      .reply(function (_uri, body) {
        sent = body as Body;
        headers = this.req.headers;
        return [200, AUTOCOMPLETE_BODY];
      });

    const response = await get('/places/autocomplete?q=Union&lat=39.7392&lng=-104.9903&session=s1');
    expect(scope.isDone()).toBe(true);
    expect(sent).toEqual({
      input: 'Union',
      sessionToken: 's1',
      includedRegionCodes: ['us'],
      origin: { latitude: 39.7392, longitude: -104.9903 },
      locationBias: {
        circle: { center: { latitude: 39.7392, longitude: -104.9903 }, radius: 50_000 },
      },
    });
    expect(headers['x-goog-api-key']).toBe(API_KEY);
    expect(response.statusCode).toBe(200);
    // Place predictions only; the query prediction is skipped.
    expect(AutocompleteResponseSchema.parse(response.json())).toEqual({
      suggestions: [
        {
          placeId: 'ChIJunion',
          primaryText: 'Union Station',
          secondaryText: '100 Union Plaza',
          distanceMeters: 14645,
        },
      ],
    });
  });

  it('PX-PLACES-01: without a start there is no origin, bias or distance', async () => {
    setup();
    let sent: Body | undefined;
    nock(PLACES)
      .post('/v1/places:autocomplete')
      .reply((_uri, body) => {
        sent = body as Body;
        return [200, AUTOCOMPLETE_BODY];
      });
    const response = await get('/places/autocomplete?q=Union&session=s1');
    expect(sent).toEqual({ input: 'Union', sessionToken: 's1', includedRegionCodes: ['us'] });
    expect(response.json().suggestions[0].distanceMeters).toBeUndefined();

    nock(PLACES).post('/v1/places:autocomplete').reply(200, {});
    expect((await get('/places/autocomplete?q=zzzz&session=s1')).json()).toEqual({
      suggestions: [],
    });
  });

  it('PX-PLACES-02: details uses the session token and a minimal field mask', async () => {
    setup();
    let headers: Record<string, unknown> = {};
    const scope = nock(PLACES)
      .get('/v1/places/ChIJunion')
      .query({ sessionToken: 's1' })
      .reply(function () {
        headers = this.req.headers;
        return [200, DETAILS_BODY];
      });
    const response = await get('/places/details?placeId=ChIJunion&session=s1');
    expect(scope.isDone()).toBe(true);
    expect(headers['x-goog-fieldmask']).toBe('id,displayName,formattedAddress,location');
    expect(headers['x-goog-api-key']).toBe(API_KEY);
    expect(PlaceDetailsSchema.parse(response.json())).toEqual({
      placeId: 'ChIJunion',
      name: 'Union Station',
      address: '100 Union Plaza',
      lat: 39.8255,
      lng: -104.906,
    });
  });

  it('upstream errors, malformed bodies and timeouts use the error envelope; the key never leaks', async () => {
    setup({ UPSTREAM_TIMEOUT_MS: '50' });
    nock(PLACES)
      .post('/v1/places:autocomplete')
      .reply(400, { error: { message: `bad key ${API_KEY}` } });
    const failed = await get('/places/autocomplete?q=Union&session=s1');
    expect(failed.statusCode).toBe(502);
    expect(failed.json().error.code).toBe('UPSTREAM_ERROR');

    nock(PLACES).get('/v1/places/ChIJunion').query(true).reply(200, { id: 'ChIJunion' });
    const malformed = await get('/places/details?placeId=ChIJunion&session=s1');
    expect(malformed.statusCode).toBe(502);
    expect(malformed.json().error.code).toBe('UPSTREAM_ERROR');

    nock(PLACES).post('/v1/places:autocomplete').delay(500).reply(200, AUTOCOMPLETE_BODY);
    const slow = await get('/places/autocomplete?q=Union&session=s1');
    expect(slow.statusCode).toBe(504);
    expect(slow.json().error.code).toBe('UPSTREAM_TIMEOUT');

    for (const text of [failed.body, malformed.body, slow.body, logLines.join('\n')]) {
      expect(text).not.toContain(API_KEY);
    }
  });

  it('PX-LOG-01: places logs carry no query text, coordinates, place ID or session', async () => {
    setup();
    nock(PLACES).post('/v1/places:autocomplete').reply(200, AUTOCOMPLETE_BODY);
    nock(PLACES).get('/v1/places/ChIJunion').query(true).reply(200, DETAILS_BODY);
    await get('/places/autocomplete?q=Secret%20Cafe&lat=39.7392&lng=-104.9903&session=tok55');
    await get('/places/details?placeId=ChIJunion&session=tok55');
    const logs = logLines.join('\n');
    expect(logs).toContain('/places/autocomplete');
    expect(logs).toContain('/places/details');
    for (const secret of [
      'Secret',
      'Cafe',
      '39.7392',
      '-104.9903',
      'tok55',
      'ChIJunion',
      'Union',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});

describe('places normalization', () => {
  it('falls back sensibly when optional fields are missing', () => {
    expect(
      normalizeAutocomplete(
        { suggestions: [{ placePrediction: { placeId: 'p', text: { text: 'Somewhere' } } }] },
        true,
      ),
    ).toEqual({ suggestions: [{ placeId: 'p', primaryText: 'Somewhere', secondaryText: '' }] });
    expect(
      normalizeAutocomplete({ suggestions: [{ placePrediction: { placeId: 'p' } }] }, false),
    ).toEqual({ suggestions: [{ placeId: 'p', primaryText: '', secondaryText: '' }] });
    expect(normalizeDetails({ id: 'p', location: { latitude: 1, longitude: 2 } })).toEqual({
      placeId: 'p',
      name: '',
      address: '',
      lat: 1,
      lng: 2,
    });
  });
});
