const { execFileSync, execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_PORT = '5435';

// Parse arguments
const args = process.argv.slice(2);
let installDir = '', dataDir = '', dbName = 'saraya_livestock_prod', dbUser = 'saraya', dbPassword = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--install-dir') installDir = args[++i];
  if (args[i] === '--data-dir') dataDir = args[++i];
  if (args[i] === '--db-name') dbName = args[++i];
  if (args[i] === '--db-user') dbUser = args[++i];
  if (args[i] === '--db-password') dbPassword = args[++i];
}

if (!installDir || !dataDir || !dbPassword) {
  console.error('Missing required arguments');
  process.exit(1);
}

const logDir = path.join(dataDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const setupLogPath = path.join(logDir, 'database-setup.log');
fs.appendFileSync(setupLogPath, `\n===== ${new Date().toISOString()} =====\n`, 'utf8');

function log(msg) {
  const line = `${new Date().toISOString()} - ${msg}\n`;
  fs.appendFileSync(setupLogPath, line, 'utf8');
  console.log(msg);
}

const psqlPath = path.join(installDir, 'postgresql', 'bin', 'psql.exe');
const pgIsreadyPath = path.join(installDir, 'postgresql', 'bin', 'pg_isready.exe');

function runPsql(sqlArgs) {
  const result = spawnSync(psqlPath, sqlArgs, {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: dbPassword, PGCLIENTENCODING: 'UTF8' },
  });
  if (result.stdout) log('psql stdout: ' + result.stdout.trim());
  if (result.stderr) log('psql stderr: ' + result.stderr.trim());
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql failed with exit code ${result.status}`);
  }
  return result.stdout || '';
}

log('Waiting for PostgreSQL on port ' + DB_PORT + '...');
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    execFileSync(pgIsreadyPath, ['-h', 'localhost', '-p', DB_PORT, '-U', 'postgres'], { stdio: 'pipe' });
    ready = true;
    break;
  } catch (e) {
    execSync('ping 127.0.0.1 -n 2 > nul', { stdio: 'pipe' });
  }
}

if (!ready) {
  log('ERROR: PostgreSQL did not become ready in time on port ' + DB_PORT);
  process.exit(1);
}
log('PostgreSQL is ready on port ' + DB_PORT);

// Create database if not exists
log('Checking if database exists...');
const dbExists = runPsql(['-h', 'localhost', '-p', DB_PORT, '-U', 'postgres', '-t', '-A', '-c',
  `SELECT 1 FROM pg_database WHERE datname = '${dbName}';`]).trim() === '1';

if (!dbExists) {
  log('Creating application user and database...');
  try {
    runPsql(['-h', 'localhost', '-p', DB_PORT, '-U', 'postgres', '-c',
      `CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';`]);
  } catch(e) {
    log('User might already exist, updating password...');
    runPsql(['-h', 'localhost', '-p', DB_PORT, '-U', 'postgres', '-c',
      `ALTER USER ${dbUser} WITH PASSWORD '${dbPassword}';`]);
  }
  runPsql(['-h', 'localhost', '-p', DB_PORT, '-U', 'postgres', '-c',
    `CREATE DATABASE ${dbName} OWNER ${dbUser};`]);
  log('Database created successfully.');
} else {
  log('Database already exists, skipping creation.');
}

log('Database setup completed successfully.');
