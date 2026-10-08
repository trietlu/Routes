import { DEVICE_ID_HEADER, RoutesRequestSchema, type RoutesRequest } from '@routes/api-types';
import { PACKAGE_NAME } from './index';

describe('proxy', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@routes/proxy');
  });

  it('consumes the shared contract from @routes/api-types', () => {
    const body: RoutesRequest = {
      origin: { lat: 38.8977, lng: -77.0365 },
      destination: { placeId: 'fixture-union-station', lat: 38.8973, lng: -77.0063 },
    };
    expect(RoutesRequestSchema.parse(body)).toEqual(body);
    expect(DEVICE_ID_HEADER).toBe('X-Device-Id');
  });
});
