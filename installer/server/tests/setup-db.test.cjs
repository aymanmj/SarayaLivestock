const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/setup-db.js'), 'utf8');

function runScenario(fail) {
  const messages = [];
  let status;
  const exited = {};
  const child = {
    execFileSync() {}, execSync() {},
    spawnSync(program, args, options) {
      const sql = args[args.indexOf('-c') + 1] || '';
      if (fail(sql, args)) return { status: 2, stdout: '', stderr: 'password authentication failed' };
      return { status: 0, stdout: sql.startsWith('SELECT') ? '1\n' : '', stderr: '' };
    },
  };
  const processMock = {
    argv: ['node', 'setup-db.js', '--install-dir', 'fixture', '--data-dir', 'fixture-data', '--db-password', 'fixture-secret'],
    env: {}, on() {}, exit(code) { status = code; throw exited; },
  };
  try {
    vm.runInNewContext(source, {
      require(name) {
        if (name === 'child_process') return child;
        if (name === 'fs') return { mkdirSync() {}, appendFileSync(p, text) { messages.push(text); }, writeFileSync() {} };
        return require(name);
      }, process: processMock, console: { log() {}, error() {} },
    });
  } catch (error) { if (error !== exited) status = 1; }
  return { status, messages: messages.join('') };
}

test('authentication failure cannot be reported as successful database setup', () => {
  const result = runScenario(() => true);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.messages, /Database setup completed successfully/);
});
test('failure to update an existing role must stop setup', () => {
  assert.notEqual(runScenario(sql => sql.startsWith('ALTER USER')).status, 0);
});
test('successful existing database setup remains idempotent', () => {
  assert.equal(runScenario(() => false).status, 0);
});
