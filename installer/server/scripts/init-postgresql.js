const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
let installDir = '', dataDir = '', dbPassword = '', templateDir = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--install-dir') installDir = args[++i];
  if (args[i] === '--data-dir') dataDir = args[++i];
  if (args[i] === '--db-password') dbPassword = args[++i];
  if (args[i] === '--template-dir') templateDir = args[++i];
}

if (!installDir || !dataDir || !dbPassword || !templateDir) {
  console.error('Missing required arguments: --install-dir, --data-dir, --db-password, --template-dir');
  process.exit(1);
}

const pgBinDir = path.join(installDir, 'postgresql', 'bin');
const pgData = path.join(dataDir, 'data', 'postgresql');
const pgConfPath = path.join(pgData, 'postgresql.conf');

function repairWindowsIoConcurrency(configPath) {
  if (process.platform !== 'win32' || !fs.existsSync(configPath)) return;

  const current = fs.readFileSync(configPath, 'utf8');
  const updated = current.replace(
    /^(\s*effective_io_concurrency\s*=\s*)(\d+)(\s*(?:#.*)?)$/m,
    (line, prefix, value, suffix) => (value === '0' ? line : `${prefix}0${suffix}`),
  );

  if (updated !== current) {
    fs.writeFileSync(configPath, updated);
    console.log('Repaired effective_io_concurrency for PostgreSQL on Windows.');
  }
}

// Check for existing cluster
const versionFile = path.join(pgData, 'PG_VERSION');
if (fs.existsSync(versionFile)) {
  repairWindowsIoConcurrency(pgConfPath);
  console.log('PostgreSQL data directory already exists; preserving it for upgrade.');
  process.exit(0);
}

// Clean incomplete data directory
if (fs.existsSync(pgData)) {
  try {
    const existingFiles = fs.readdirSync(pgData);
    if (existingFiles.length > 0 && !existingFiles.includes('PG_VERSION')) {
      console.log('PostgreSQL data directory contains incomplete files from previous attempt; resetting it.');
      fs.rmSync(pgData, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Notice while inspecting dataDir:', e.message);
  }
}

fs.mkdirSync(pgData, { recursive: true });

// Write password file
const passwordFile = path.join(dataDir, `.pg-password-${process.pid}.tmp`);
fs.writeFileSync(passwordFile, `${dbPassword}\n`, { mode: 0o600 });

try {
  execFileSync(path.join(pgBinDir, 'initdb.exe'), [
    '-D', pgData,
    '-U', 'postgres',
    '--encoding=UTF8',
    '--no-locale',
    '--auth-host=scram-sha-256',
    '--auth-local=scram-sha-256',
    `--pwfile=${passwordFile}`,
  ], {
    stdio: 'inherit',
    env: { ...process.env, PGDATA: pgData },
  });
} finally {
  fs.rmSync(passwordFile, { force: true });
}

// Install the reviewed, local-only configuration templates.
const hbaConfPath = path.join(pgData, 'pg_hba.conf');
const logDir = path.join(dataDir, 'logs', 'postgresql').replace(/\\/g, '/').replace(/'/g, "''");
const pgTemplate = fs.readFileSync(path.join(templateDir, 'postgresql.conf.template'), 'utf8');
const hbaTemplate = fs.readFileSync(path.join(templateDir, 'pg_hba.conf.template'), 'utf8');
fs.writeFileSync(pgConfPath, pgTemplate.replaceAll('{{LOG_DIR}}', logDir));
fs.writeFileSync(hbaConfPath, hbaTemplate);

console.log('PostgreSQL cluster initialized on port 5435 with SCRAM authentication.');
