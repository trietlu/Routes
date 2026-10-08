import { PACKAGE_NAME } from './index';

describe('proxy', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@routes/proxy');
  });
});
