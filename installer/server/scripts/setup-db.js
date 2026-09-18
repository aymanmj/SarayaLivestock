const { execFileSync, execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

const tmpErrorLog = path.join(os.tmpdir(), 'database-setup-error.log');

process.on('uncaughtException', (err) => {
  const msg = err && err.message ? err.message : String(err);
  console.error('FATAL:', msg);
  try {
    fs.writeFileSync(tmpErrorLog, msg, 'utf8');
  } catch (e) {}
  try {
    if (setupLogPath) fs.appendFileSync(setupLogPath, `FATAL: ${msg}\n`, 'utf8');
  } catch (e) {}
  process.exit(1);
});

if (!installDir || !dataDir || !dbPassword) {
  throw new Error('Missing required arguments: --install-dir, --data-dir, --db-password');
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
  const fullArgs = [
    '-X', '--no-password', '-v', 'ON_ERROR_STOP=1',
    '-h', '127.0.0.1',
    '-p', DB_PORT,
    '-U', 'postgres',
    '-d', 'postgres',
    ...sqlArgs
  ];
  const result = spawnSync(psqlPath, fullArgs, {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PGPASSWORD: dbPassword, PGCLIENTENCODING: 'UTF8' },
  });
  if (result.stdout) log('psql stdout: ' + result.stdout.trim());
  if (result.stderr) log('psql stderr: ' + result.stderr.trim());
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const errText = (result.stderr || result.stdout || '').trim();
    throw new Error(`psql failed (exit ${result.status}): ${errText}`);
  }
  return result.stdout || '';
}

log('Waiting for PostgreSQL on port ' + DB_PORT + '...');
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    execFileSync(pgIsreadyPath, ['-h', '127.0.0.1', '-p', DB_PORT, '-U', 'postgres'], { stdio: 'pipe' });
    ready = true;
    break;
  } catch (e) {
    execSync('ping 127.0.0.1 -n 2 > nul', { stdio: 'pipe' });
  }
}

if (!ready) {
  throw new Error('PostgreSQL did not become ready in time on port ' + DB_PORT);
}
log('PostgreSQL is ready on port ' + DB_PORT);

// Authenticate first. An authentication error is not evidence that a role exists.
runPsql(['-c', 'SELECT 1;']);
const quotedUser = '"' + dbUser.replace(/"/g, '""') + '"';
const quotedDatabase = '"' + dbName.replace(/"/g, '""') + '"';
const userLiteral = dbUser.replace(/'/g, "''");
const databaseLiteral = dbName.replace(/'/g, "''");
// Synchronize postgres superuser password
log('Synchronizing postgres superuser password...');
runPsql(['-c', `ALTER USER postgres WITH PASSWORD '${dbPassword.replace(/'/g, "''")}';`]);

// Check / Create Application User
log('Ensuring application user exists...');
const roleExists = runPsql(['-t', '-A', '-c', `SELECT 1 FROM pg_roles WHERE rolname = '${userLiteral}';`]).trim() === '1';
runPsql(['-c', `${roleExists ? 'ALTER' : 'CREATE'} USER ${quotedUser} WITH PASSWORD '${dbPassword.replace(/'/g, "''")}';`]);
log(`User ${dbUser} credentials configured successfully.`);

// Check / Create Application Database
log('Checking if database exists...');
const dbExists = runPsql(['-t', '-A', '-c', `SELECT 1 FROM pg_database WHERE datname = '${databaseLiteral}';`]).trim() === '1';

if (!dbExists) {
  log(`Creating database ${dbName}...`);
  runPsql(['-c', `CREATE DATABASE ${quotedDatabase} OWNER ${quotedUser};`]);
  log(`Database ${dbName} created successfully.`);
} else {
  log(`Database ${dbName} already exists, skipping creation.`);
}

// Lock down pg_hba.conf to require SCRAM authentication for all users
log('Securing pg_hba.conf to require SCRAM authentication...');
const pgData = path.join(dataDir, 'data', 'postgresql');
const hbaConfPath = path.join(pgData, 'pg_hba.conf');
const finalHba = `# =============================================================================
# PostgreSQL Client Authentication Configuration
# Saraya Livestock Server - Local connections only (SCRAM-SHA-256 enforced)
# =============================================================================
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
`;
try {
  fs.writeFileSync(hbaConfPath, finalHba, 'utf8');
  runPsql(['-c', 'SELECT pg_reload_conf();']);
  log('pg_hba.conf secured and PostgreSQL reloaded successfully.');
} catch (hbaErr) {
  log('FATAL: Failed to secure pg_hba.conf: ' + hbaErr.message);
  process.exit(1);
}

log('Database setup completed successfully.');
process.exit(0);
