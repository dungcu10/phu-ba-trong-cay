// Every item must have a picture, or the game stops at start with "Thiếu hình cho nội dung"
// (render/assets.ts missingFor). This mirrors that check against the atlas files, so a new item kind
// without art fails here instead of on the iPad.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBase } from './helpers.ts';

const content = await loadBase();
const ART = join(import.meta.dirname, '..', 'assets', 'art');
const frames = new Set<string>();
for (const f of readdirSync(ART).filter((n) => n.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(ART, f), 'utf8')) as { frames?: Record<string, unknown> };
  for (const k of Object.keys(data.frames ?? {})) frames.add(k);
}

function frameFor(id: string): string | null {
  const item = content.items.get(id)!;
  if (item.potId) return null; // shards are drawn from their pot's picture
  const mat = content.materials.get(id);
  if (mat) return mat.icon.startsWith('art:') ? mat.icon.slice(4) : null; // svg:/tmp: icons need no atlas frame
  const fish = content.fish.get(id);
  if (fish) return fish.icon.startsWith('art:') ? fish.icon.slice(4) : fish.icon;
  const good = content.goods?.get(id);
  if (good) return good.icon.startsWith('art:') ? good.icon.slice(4) : good.icon;
  const base = item.baseItem ?? id;
  const bug = content.bugs.get(base);
  if (bug?.art && bug.sprite === bug.art) return bug.art;
  const crop = content.cropList.find((c) => c.produce.id === base);
  const sprite = crop?.sprite ?? bug?.sprite ?? base;
  return `items/${sprite.slice(sprite.lastIndexOf('/') + 1)}`;
}

test('mọi món đều có hình trong atlas (không thì game không mở được)', () => {
  const missing = [...content.items.keys()].map((id) => [id, frameFor(id)] as const).filter(([, f]) => f !== null && !frames.has(f));
  assert.deepEqual(missing, []);
});
