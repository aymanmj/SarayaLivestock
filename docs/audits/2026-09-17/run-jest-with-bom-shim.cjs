// Diagnostic only: compensate for package.json BOM in memory, without editing it.
const fs = require('node:fs');
const path = require('node:path');
const originalRead = fs.readFileSync;
const api = path.resolve(__dirname, '../../../apps/api');
const packagePath = path.join(api, 'package.json').toLowerCase();
fs.readFileSync = function(file, ...args) {
  const result = originalRead.call(this, file, ...args);
  if (typeof file === 'string' && path.resolve(file).toLowerCase() === packagePath) {
    if (typeof result === 'string') return result.replace(/^\uFEFF/, '');
    if (Buffer.isBuffer(result) && result.subarray(0, 3).equals(Buffer.from([239,187,191]))) return result.subarray(3);
  }
  return result;
};
process.chdir(api);
const reviewUrl = process.env.SARAYA_REVIEW_DB_URL;
if (reviewUrl && !/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/review_release$/.test(reviewUrl)) throw new Error('Only the disposable review database is allowed');
process.env.RUN_DB_INTEGRATION_TESTS = reviewUrl ? 'true' : 'false';
process.env.DATABASE_URL = reviewUrl || 'postgresql://review:review@127.0.0.1:1/review_disposable';
process.argv = [process.execPath, path.join(api, 'node_modules/jest/bin/jest.js'), '--runInBand'];
require(process.argv[1]);
