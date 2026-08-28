import { validateRuntimeConfig } from './runtime-config';

describe('runtime production configuration', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://saraya:strong@postgres:5432/saraya',
    JWT_SECRET: 'j'.repeat(64),
    ENCRYPTION_KEY: 'e'.repeat(64),
    CORS_ORIGINS: 'https://saraya.example.com,null',
    ENABLE_SWAGGER: 'false',
    ALLOW_DEMO_SEED: 'false',
    TRUST_PROXY_HOPS: '1',
  };

  it('accepts an explicit production configuration and normalizes numeric settings', () => {
    expect(validateRuntimeConfig(production)).toEqual(expect.objectContaining({
      PORT: 4000,
      DB_POOL_MAX: 10,
      TRUST_PROXY_HOPS: 1,
    }));
  });

  it.each([
    [{ ...production, JWT_SECRET: 'replace-with-secret' }, 'JWT_SECRET'],
    [{ ...production, ENCRYPTION_KEY: undefined }, 'ENCRYPTION_KEY'],
    [{ ...production, ENCRYPTION_KEY: 'j'.repeat(64) }, 'must be different'],
    [{ ...production, CORS_ORIGINS: '*' }, 'explicit allowlist'],
    [{ ...production, CORS_ORIGINS: 'http://saraya.example.com' }, 'HTTPS origin'],
    [{ ...production, ENABLE_SWAGGER: 'true' }, 'forbidden'],
    [{ ...production, ALLOW_DEMO_SEED: 'true' }, 'forbidden'],
    [{ ...production, TRUST_PROXY_HOPS: '0' }, 'TRUST_PROXY_HOPS'],
  ])('rejects unsafe production configuration', (config, expected) => {
    expect(() => validateRuntimeConfig(config)).toThrow(expected as string);
  });

  it('keeps development compatible while still requiring database and JWT basics', () => {
    expect(validateRuntimeConfig({
      NODE_ENV: 'development', DATABASE_URL: production.DATABASE_URL, JWT_SECRET: 'x'.repeat(32),
    })).toEqual(expect.objectContaining({ NODE_ENV: 'development', TRUST_PROXY_HOPS: 0 }));
    expect(() => validateRuntimeConfig({ NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(32) }))
      .toThrow('DATABASE_URL');
  });
});
