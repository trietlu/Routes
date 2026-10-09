import { DEFAULT_VEHICLE, METRES_PER_MILE, computeCost, sumTollPricesUSD, toCents } from './index';

const noTolls = { hasTolls: false, priceUSD: null };

describe('computeCost', () => {
  it('RC-COST-01: fuel = miles ÷ mpg × price; canonical A is 1.37204', () => {
    const cost = computeCost(
      { distanceM: 15772, toll: { hasTolls: true, priceUSD: 3.75 } },
      { mpg: 25, pricePerGallon: 3.5 },
    );
    expect(cost.fuelUSD).toBeCloseTo(1.37204, 4);
    expect(cost.fuelUSD).toBeCloseTo((15772 / METRES_PER_MILE / 25) * 3.5, 10);
    expect(cost.tollUSD).toBe(3.75);
    expect(cost.tripUSD).toBeCloseTo(5.12204, 4);
    expect(cost).toMatchObject({ hasTolls: true, tollUnknown: false });
  });

  it('a route without tolls has a zero toll and trip equal to fuel', () => {
    const cost = computeCost({ distanceM: 14323, toll: noTolls });
    expect(cost.tollUSD).toBe(0);
    expect(cost.tripUSD).toBe(cost.fuelUSD);
    expect(cost.fuelUSD).toBeCloseTo(1.24599, 4);
    expect(cost).toMatchObject({ hasTolls: false, tollUnknown: false });
  });

  it('RC-COST-02: toll sum is units + nanos/1e9 across multiple estimatedPrice entries', () => {
    expect(
      sumTollPricesUSD([
        { currencyCode: 'USD', units: '2', nanos: 500_000_000 },
        { currencyCode: 'USD', units: '1', nanos: 250_000_000 },
        { currencyCode: 'USD', nanos: 10_000_000 },
        { currencyCode: 'USD', units: 1 },
      ]),
    ).toBeCloseTo(4.76, 10);
  });

  it('RC-COST-03: toll info with no USD price → tollUnknown and no trip cost', () => {
    expect(sumTollPricesUSD([])).toBeNull();
    expect(sumTollPricesUSD(undefined)).toBeNull();
    const cost = computeCost({ distanceM: 19312, toll: { hasTolls: true, priceUSD: null } });
    expect(cost).toMatchObject({ hasTolls: true, tollUnknown: true, tollUSD: null, tripUSD: null });
    expect(cost.fuelUSD).toBeGreaterThan(0);
  });

  it('RC-COST-04: a non-USD price only is treated as unknown', () => {
    const priceUSD = sumTollPricesUSD([{ currencyCode: 'CAD', units: '4', nanos: 0 }]);
    expect(priceUSD).toBeNull();
    expect(computeCost({ distanceM: 1000, toll: { hasTolls: true, priceUSD } })).toMatchObject({
      tollUnknown: true,
      tripUSD: null,
    });
    // USD entries are summed even when other currencies are present.
    expect(
      sumTollPricesUSD([
        { currencyCode: 'CAD', units: '4' },
        { currencyCode: 'USD', units: '3', nanos: 750_000_000 },
      ]),
    ).toBe(3.75);
  });

  it('RC-COST-05: the default vehicle (25 mpg, $3.50, regular) applies when none is given', () => {
    expect(DEFAULT_VEHICLE).toEqual({
      mpg: 25,
      fuelType: 'regular',
      pricePerGallon: 3.5,
      isUserSet: false,
    });
    const route = { distanceM: 17059, toll: noTolls };
    expect(computeCost(route)).toEqual(computeCost(route, DEFAULT_VEHICLE));
    expect(computeCost(route).fuelUSD).toBeCloseTo(1.484, 4);
  });
});

describe('toCents', () => {
  it('rounds half-up to whole cents', () => {
    expect(toCents(5.12204)).toBe(512);
    expect(toCents(1.24599)).toBe(125);
    expect(toCents(0.005)).toBe(1);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.0049)).toBe(0);
    expect(toCents(0)).toBe(0);
  });
});
