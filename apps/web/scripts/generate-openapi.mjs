import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const contractPath = resolve(process.cwd(), '../../openapi/saraya.openapi.json');
const outputPath = resolve(process.cwd(), 'src/api/generated/schema.ts');
const contract = JSON.parse(await readFile(contractPath, 'utf8'));

// Idempotency-Key remains required in the server contract. Saraya's transport
// owns it centrally so feature code cannot accidentally create non-durable keys.
for (const pathItem of Object.values(contract.paths ?? {})) {
  for (const operation of Object.values(pathItem ?? {})) {
    if (!operation || typeof operation !== 'object' || !Array.isArray(operation.parameters)) continue;
    operation.parameters = operation.parameters.filter(parameter =>
      !parameter || typeof parameter !== 'object' || parameter.name !== 'Idempotency-Key',
    );
  }
}

const ast = await openapiTS(contract, {
  alphabetize: true,
  defaultNonNullable: false,
  // openapi-fetch recursively maps response bodies; mutable declarations keep
  // Array methods intact instead of turning them into object-shaped members.
  immutable: false,
});
const output = astToString(ast);

if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== output) {
    throw new Error('Generated web API types are stale. Run npm run contracts:generate from the repository root.');
  }
  console.log(`Generated web API types are current: ${outputPath}`);
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, 'utf8');
  console.log(`Generated web API types: ${outputPath}`);
}
