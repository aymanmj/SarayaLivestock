import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.resolve(desktopDirectory, '../web/dist');
const targetDirectory = path.resolve(desktopDirectory, 'web-dist');

await stat(path.join(sourceDirectory, 'index.html'));
await rm(targetDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });
console.log(`Prepared immutable desktop web assets in ${targetDirectory}`);
