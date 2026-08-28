import { NestFactory } from '@nestjs/core';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../openapi';

async function main() {
  // Contract generation is metadata-only and must not depend on PostgreSQL,
  // Vault, license files, or any other runtime integration being reachable.
  const app = await NestFactory.create(AppModule, { logger: false, preview: true });
  const outputPath = resolve(process.cwd(), '../../openapi/saraya.openapi.json');

  try {
    app.setGlobalPrefix('api/v1');
    const document = createOpenApiDocument(app);
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (process.argv.includes('--check')) {
      const existing = await readFile(outputPath, 'utf8').catch(() => '');
      if (existing !== serialized) {
        throw new Error('OpenAPI contract is stale. Run npm run contracts:generate from the repository root.');
      }
      console.log(`OpenAPI contract is current: ${outputPath}`);
      return;
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, 'utf8');
    console.log(`OpenAPI contract generated: ${outputPath}`);
  } finally {
    await app.close();
  }
}

main().catch(error => {
  console.error(`OpenAPI generation failed: ${error.message}`);
  process.exitCode = 1;
});
