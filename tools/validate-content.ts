// Validates the content pack and prints every problem found. Run: npm run validate-content

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContentError, loadContentPack } from '../src/core/content.ts';

const dir = join(import.meta.dirname, '..', 'content', 'base');
try {
  const pack = await loadContentPack(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')));
  process.stdout.write(
    `Gói nội dung hợp lệ (v${pack.contentVersion}): ${pack.floors.size} tầng, ${pack.pots.size} loại chậu, ${pack.crops.size} giống cây, ${pack.bugs.size} loại bọ.\n`,
  );
} catch (e) {
  if (e instanceof ContentError) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
