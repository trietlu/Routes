import nock from 'nock';
import { type FastifyInstance } from 'fastify';
import { AutocompleteResponseSchema, PlaceDetailsSchema } from '@routes/api-types';
import { buildApp, loadConfig } from '../index';

const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const MILE_M = 1609.344;

let app: FastifyInstance;
let logLines: string[];

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
beforeEach(() => {
  logLines = [];
  app = buildApp(loadConfig({ NODE_ENV: 'test', PROVIDER: 'mock' }), {
    logStream: { write: (line: string) => void logLines.push(line) },
  });
});
afterEach(async () => {
  await app.close();
});

const get = (url: string) =>
  app.inject({ method: 'GET', url, headers: { 'x-device-id': DEVICE_ID } });

async function suggest(q: string, withStart = true) {
  const start = withStart ? '&lat=39.7392&lng=-104.9903' : '';
  const response = await get(`/places/autocomplete?q=${encodeURIComponent(q)}${start}&session=s1`);
  expect(response.statusCode).toBe(200);
  return AutocompleteResponseSchema.parse(response.json()).suggestions;
}

describe('PX-MOCK-01 (places): PROVIDER=mock serves the places fixtures', () => {
  it('"Union" returns the three sketch suggestions with 9.1, 4.3 and 6.8 mi', async () => {
    const suggestions = await suggest('Union');
    expect(suggestions.map((s) => [s.placeId, s.primaryText, s.secondaryText])).toEqual([
      ['fixture-union-station', 'Union Station', '100 Union Plaza'],
      ['fixture-union-street-market', 'Union Street Market', '42 Union St'],
      ['fixture-union-st-9th-ave', 'Union St & 9th Ave', 'Intersection'],
    ]);
    expect(suggestions.map((s) => (s.distanceMeters! / MILE_M).toFixed(1))).toEqual([
      '9.1',
      '4.3',
      '6.8',
    ]);
    expect((await suggest('  union st')).length).toBe(3);
  });

  it('each edge-case search text returns its fixture place, with details', async () => {
    const cases: [string, string][] = [
      ['Two Routes Test', 'fixture-two-routes'],
      ['One Route Test', 'fixture-one-route'],
      ['Unknown Toll Test', 'fixture-unknown-toll'],
      ['Near Duplicates Test', 'fixture-near-duplicates'],
      ['No Route Test', 'fixture-no-route'],
      ['Error Test', 'fixture-upstream-error'],
      ['Partial Error Test', 'fixture-partial-error'],
      ['Slow Test', 'fixture-slow'],
    ];
    for (const [text, placeId] of cases) {
      const [suggestion, ...rest] = await suggest(text);
      expect(rest).toEqual([]);
      expect(suggestion).toMatchObject({ placeId, primaryText: text });
      const details = await get(`/places/details?placeId=${placeId}&session=s1`);
      expect(PlaceDetailsSchema.parse(details.json())).toMatchObject({ placeId, name: text });
    }
  });

  it('details for the Union places; an unknown place ID is an upstream error', async () => {
    const response = await get('/places/details?placeId=fixture-union-station&session=s1');
    expect(PlaceDetailsSchema.parse(response.json())).toMatchObject({
      placeId: 'fixture-union-station',
      name: 'Union Station',
      address: '100 Union Plaza',
    });
    const unknown = await get('/places/details?placeId=nope&session=s1');
    expect(unknown.statusCode).toBe(502);
    expect(unknown.json().error.code).toBe('UPSTREAM_ERROR');
  });

  it('no match → no suggestions; no start → no distances', async () => {
    expect(await suggest('Zebra Crossing')).toEqual([]);
    const noStart = await suggest('Union', false);
    expect(noStart).toHaveLength(3);
    expect(noStart.every((s) => s.distanceMeters === undefined)).toBe(true);
  });

  it('PX-LOG-01: query text is never logged', async () => {
    await suggest('Union Secret');
    await get('/places/details?placeId=fixture-union-station&session=tok77');
    const logs = logLines.join('\n');
    expect(logs).toContain('/places/autocomplete');
    for (const secret of [
      'Union',
      'Secret',
      '39.7392',
      '-104.9903',
      'tok77',
      'fixture-union-station',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});
