import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const sourceRoot = resolve(process.cwd(), 'src');
const transportFile = resolve(sourceRoot, 'api/client.ts');
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!['.ts', '.tsx'].includes(extname(path)) || path === transportFile) continue;
    const source = await readFile(path, 'utf8');
    if (/\bapiFetch\s*\(|\bfetch\s*\(/.test(source)) {
      violations.push(relative(process.cwd(), path));
    }
  }
}

await visit(sourceRoot);
if (violations.length > 0) {
  throw new Error(`Direct HTTP calls must use generatedApiClient. Violations: ${violations.join(', ')}`);
}
console.log('API boundary check passed: feature code uses the generated client.');
