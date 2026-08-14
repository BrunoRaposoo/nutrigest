import { getJwtSecret } from './env';

describe('config/env', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('returns dev-secret fallback in non-production without JWT_SECRET', () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;

    expect(getJwtSecret()).toBe('dev-secret');
  });

  it('returns JWT_SECRET when set in non-production', () => {
    delete process.env.NODE_ENV;
    process.env.JWT_SECRET = 'some-test-secret';

    expect(getJwtSecret()).toBe('some-test-secret');
  });

  it('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('throws in production when JWT_SECRET is the dev-secret fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret';

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('throws in production when JWT_SECRET is too short', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short-secret';

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('accepts a strong JWT_SECRET in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-very-strong-secret-that-is-long-enough-123456';

    expect(getJwtSecret()).toBe(
      'a-very-strong-secret-that-is-long-enough-123456',
    );
  });
});
