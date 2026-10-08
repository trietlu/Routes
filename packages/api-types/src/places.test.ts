import {
  AutocompleteQuerySchema,
  AutocompleteResponseSchema,
  PlaceDetailsQuerySchema,
  PlaceDetailsSchema,
} from './index';

// Query strings arrive from the HTTP layer as strings.
const validQuery = { q: 'Union', lat: '38.8977', lng: '-77.0365', session: 'session-1' };

describe('AutocompleteQuerySchema', () => {
  it('AT-03: a valid query parses and coordinates become numbers', () => {
    expect(AutocompleteQuerySchema.parse(validQuery)).toEqual({
      q: 'Union',
      lat: 38.8977,
      lng: -77.0365,
      session: 'session-1',
    });
  });

  it('AT-03: q shorter than 2 characters fails', () => {
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, q: 'U' }).success).toBe(false);
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, q: '' }).success).toBe(false);
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, q: ' U ' }).success).toBe(false);
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, q: 'Un' }).success).toBe(true);
  });

  it('AT-03: session is required', () => {
    const { q, lat, lng } = validQuery;
    expect(AutocompleteQuerySchema.safeParse({ q, lat, lng }).success).toBe(false);
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, session: '' }).success).toBe(false);
  });

  it('AT-03: lat and lng are optional, but only together', () => {
    const noStart = { q: validQuery.q, session: validQuery.session };
    expect(AutocompleteQuerySchema.safeParse(noStart).success).toBe(true);
    expect(AutocompleteQuerySchema.safeParse({ ...noStart, lat: '38.9' }).success).toBe(false);
  });

  it('AT-03: blank, non-numeric or out-of-range coordinates fail', () => {
    for (const lat of ['', ' ', 'north', '91']) {
      expect(AutocompleteQuerySchema.safeParse({ ...validQuery, lat }).success).toBe(false);
    }
  });

  it('AT-03: unknown query parameters fail', () => {
    expect(AutocompleteQuerySchema.safeParse({ ...validQuery, key: 'abc' }).success).toBe(false);
  });

  it('AT-03: the autocomplete response accepts suggestions with and without a distance', () => {
    const response = {
      suggestions: [
        {
          placeId: 'fixture-union-station',
          primaryText: 'Union Station',
          secondaryText: '100 Union Plaza',
          distanceMeters: 14645,
        },
        { placeId: 'p2', primaryText: 'Union St & 9th Ave', secondaryText: 'Intersection' },
      ],
    };
    expect(AutocompleteResponseSchema.parse(response)).toEqual(response);
  });
});

describe('PlaceDetails schemas', () => {
  it('place details query requires placeId and session, and nothing else', () => {
    const query = { placeId: 'fixture-union-station', session: 'session-1' };
    expect(PlaceDetailsQuerySchema.parse(query)).toEqual(query);
    expect(PlaceDetailsQuerySchema.safeParse({ placeId: 'p' }).success).toBe(false);
    expect(PlaceDetailsQuerySchema.safeParse({ ...query, fields: '*' }).success).toBe(false);
  });

  it('place details response parses', () => {
    const details = {
      placeId: 'fixture-union-station',
      name: 'Union Station',
      address: '100 Union Plaza',
      lat: 38.8973,
      lng: -77.0063,
    };
    expect(PlaceDetailsSchema.parse(details)).toEqual(details);
    expect(PlaceDetailsSchema.safeParse({ ...details, lat: 100 }).success).toBe(false);
  });
});
