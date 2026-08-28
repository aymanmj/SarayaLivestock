import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const sourceUrl = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('TEST_DATABASE_ADMIN_URL or DATABASE_URL is required');

const adminUrl = new URL(sourceUrl);
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol)) {
  throw new Error('The integration test administrator URL must be PostgreSQL');
}

const databaseName = `saraya_integration_${randomBytes(8).toString('hex')}`;
const quotedDatabaseName = `"${databaseName}"`;
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set('schema', 'public');

const { Client } = pg;
const administrator = new Client({ connectionString: adminUrl.toString() });
function run(program, args, environment) {
  const result = spawnSync(program, args, {
    cwd: process.cwd(),
    env: environment,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} exited with status ${result.status}`);
}

await administrator.connect();
try {
  await administrator.query(`CREATE DATABASE ${quotedDatabaseName}`);
  console.log(`Created isolated PostgreSQL integration database: ${databaseName}`);

  const testEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testUrl.toString(),
    RUN_DB_INTEGRATION_TESTS: 'true',
  };
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], testEnvironment);
  run(process.execPath, ['node_modules/jest/bin/jest.js', '--runInBand'], testEnvironment);
} finally {
  await administrator.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [databaseName],
  );
  await administrator.query(`DROP DATABASE IF EXISTS ${quotedDatabaseName}`);
  await administrator.end();
  console.log(`Removed isolated PostgreSQL integration database: ${databaseName}`);
}
