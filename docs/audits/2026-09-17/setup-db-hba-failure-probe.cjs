// Isolated audit probe: evaluates setup-db.js with mocked filesystem and processes.
// Does not start PostgreSQL, execute child processes, or write production files.
// Run from repository root: node docs/audits/2026-09-17/setup-db-hba-failure-probe.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const sourcePath = path.resolve(__dirname, '../../../installer/server/scripts/setup-db.js');
const source = fs.readFileSync(sourcePath, 'utf8');
let exitCode;
let hbaWriteAttempted = false;
const messages = [];
const stopped = {};

try {
  vm.runInNewContext(source, {
    require(name) {
      if (name === 'child_process') return {
        execFileSync() {},
        execSync() {},
        spawnSync() { return { status: 0, stdout: '1', stderr: '' }; },
      };
      if (name === 'fs') return {
        mkdirSync() {},
        appendFileSync() {},
        writeFileSync(filename) {
          assert.equal(path.basename(filename), 'pg_hba.conf');
          hbaWriteAttempted = true;
          throw new Error('Synthetic ACL denial when replacing pg_hba.conf');
        },
      };
      return require(name);
    },
    process: {
      argv: ['node', 'setup-db.js', '--install-dir', 'fixture', '--data-dir', 'fixture', '--db-password', 'synthetic-password'],
      env: {},
      on() {},
      exit(code) { exitCode = code; throw stopped; },
    },
    console: { log(message) { messages.push(message); }, error() {} },
  });
} catch (error) {
  if (error !== stopped) throw error;
}

assert.equal(hbaWriteAttempted, true, 'Probe must reach the HBA hardening operation');
const result = {
  scenario: 'pg_hba.conf hardening write denied after successful database setup',
  isolation: 'Mocked filesystem and child_process; no PostgreSQL or production changes',
  hbaWriteAttempted,
  exitCode,
  reportedSuccessfulSetup: messages.includes('Database setup completed successfully.'),
  securityGatePassedDespiteFailure: exitCode === 0,
};
console.log(JSON.stringify(result, null, 2));
