import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../../src/manifest.base.json', import.meta.url), 'utf8'));
await writeFile(new URL('../_data/extension.json', import.meta.url), JSON.stringify({ version: manifest.version }, null, 2) + '\n');
