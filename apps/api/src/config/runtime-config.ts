const PLACEHOLDER_PATTERN = /(replace|change[-_ ]?me|example|demo|development|supersecret|password)/i;

export type RuntimeEnvironment = Record<string, unknown>;

export function validateRuntimeConfig(input: RuntimeEnvironment): RuntimeEnvironment {
  const environment = { ...input };
  const nodeEnvironment = stringValue(environment.NODE_ENV) || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  environment.NODE_ENV = nodeEnvironment;

  const databaseUrl = requiredString(environment.DATABASE_URL, 'DATABASE_URL');
  let parsedDatabase: URL;
  try {
    parsedDatabase = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsedDatabase.protocol) || !parsedDatabase.pathname.slice(1)) {
    throw new Error('DATABASE_URL must identify a PostgreSQL database');
  }

  const jwtSecret = requiredString(environment.JWT_SECRET, 'JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');

  environment.PORT = integerInRange(environment.PORT, 'PORT', 1, 65_535, 4000);
  environment.DB_POOL_MAX = integerInRange(environment.DB_POOL_MAX, 'DB_POOL_MAX', 1, 100, 10);
  environment.DB_CONNECTION_TIMEOUT_MS = integerInRange(
    environment.DB_CONNECTION_TIMEOUT_MS, 'DB_CONNECTION_TIMEOUT_MS', 1_000, 120_000, 10_000,
  );
  environment.DB_IDLE_TIMEOUT_MS = integerInRange(
    environment.DB_IDLE_TIMEOUT_MS, 'DB_IDLE_TIMEOUT_MS', 1_000, 600_000, 30_000,
  );
  environment.TRUST_PROXY_HOPS = integerInRange(environment.TRUST_PROXY_HOPS, 'TRUST_PROXY_HOPS', 0, 10, 0);

  if (nodeEnvironment === 'production') validateProduction(environment, jwtSecret);
  return environment;
}

function validateProduction(environment: RuntimeEnvironment, jwtSecret: string) {
  if (PLACEHOLDER_PATTERN.test(jwtSecret)) throw new Error('JWT_SECRET contains a known placeholder or development value');
  const encryptionKey = requiredString(environment.ENCRYPTION_KEY, 'ENCRYPTION_KEY');
  if (encryptionKey.length < 32 || PLACEHOLDER_PATTERN.test(encryptionKey)) {
    throw new Error('ENCRYPTION_KEY must be a non-placeholder value containing at least 32 characters');
  }
  if (encryptionKey === jwtSecret) throw new Error('JWT_SECRET and ENCRYPTION_KEY must be different secrets');

  const origins = requiredString(environment.CORS_ORIGINS, 'CORS_ORIGINS')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*')) throw new Error('Production CORS_ORIGINS must be an explicit allowlist');
  for (const origin of origins) {
    if (origin === 'null') continue;
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid production CORS origin: ${origin}`);
    }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(`Production CORS origin must be an HTTPS origin without a path: ${origin}`);
    }
  }
  if (stringValue(environment.ENABLE_SWAGGER) === 'true') {
    throw new Error('ENABLE_SWAGGER=true is forbidden in production');
  }
  if (stringValue(environment.ALLOW_DEMO_SEED) === 'true') {
    throw new Error('ALLOW_DEMO_SEED=true is forbidden in production');
  }
  if (Number(environment.TRUST_PROXY_HOPS) < 1) {
    throw new Error('Production requires TRUST_PROXY_HOPS>=1 behind the approved reverse proxy');
  }
}

function requiredString(value: unknown, name: string) {
  const parsed = stringValue(value);
  if (!parsed) throw new Error(`${name} must be configured`);
  return parsed;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function integerInRange(value: unknown, name: string, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}
