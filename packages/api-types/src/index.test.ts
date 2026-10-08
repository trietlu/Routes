import { PACKAGE_NAME } from './index';

describe('api-types', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@routes/api-types');
  });
});
