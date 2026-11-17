// Directive 04 step 3: the 50 signature pots replace the 50 catalog pots in the shop.
// Old ids stay (retired: hidden from the shop, still loadable); the new ones copy their shop fields.
// Directive 05: their growth and skills are balanced separately (tests/signature-balance.test.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSoldInShop, type PotDef } from '../src/core/content.ts';
import { dispatch } from '../src/core/game.ts';
import { SaveManager } from '../src/persistence/saveManager.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { DAISY, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const ROOT = join(import.meta.dirname, '..');
const atlas = JSON.parse(await readFile(join(ROOT, 'assets/art/pots_signature.json'), 'utf8')) as {
  meta: { image: string; size: { w: number; h: number } };
  frames: Record<string, { anchor?: { x: number; y: number }; soil?: number }>;
};
const line = JSON.parse(await readFile(join(ROOT, 'tools/potgen/lines/signature_all.json'), 'utf8')) as { groups: string[]; pots: Array<{ id: number; group: string; name: string }> };
const sig = content.potList.filter((d) => d.id.startsWith('base:pot.sig-'));
const old = content.potList.filter((d) => d.sprite.startsWith('pots/catalog/'));
const nn = (d: PotDef) => Number(/\/(\d+)$/.exec(d.sprite)![1]);
const ECONOMY = ['rarity', 'price', 'unlockLevel', 'favoredFamily', 'set', 'group'] as const;

test('atlas pots_signature: WebP, 50 khung cấp 50 có anchor và soil, trang ≤ 4096', () => {
  assert.equal(atlas.meta.image, 'pots_signature.webp');
  assert.ok(atlas.meta.size.w <= 4096 && atlas.meta.size.h <= 4096);
  const names = Object.keys(atlas.frames);
  assert.equal(names.length, 50);
  for (let i = 1; i <= 50; i++) {
    const f = atlas.frames[`pots/sig/${String(i).padStart(2, '0')}/50`];
    assert.ok(f, `thiếu khung chậu ${i}`);
    assert.ok(f.anchor && typeof f.soil === 'number' && f.soil > 0, `chậu ${i} thiếu anchor/soil`);
  }
});

test('50 chậu đặc trưng: id, tên, nhóm theo bảng; sprite có khung trong atlas', () => {
  assert.equal(sig.length, 50);
  for (const d of sig) {
    const n = nn(d);
    const src = line.pots.find((p) => p.id === n)!;
    assert.match(d.id, new RegExp(`^base:pot\\.sig-${String(n).padStart(2, '0')}-[a-z0-9-]+$`));
    assert.equal(d.sprite, `pots/sig/${String(n).padStart(2, '0')}`);
    assert.equal(d.name.vi, src.name);
    assert.equal(d.theme, src.group);
    assert.ok(atlas.frames[`${d.sprite}/50`], `${d.id}: không có khung ${d.sprite}/50`);
    assert.ok(!d.retired);
  }
  assert.deepEqual([...new Set(sig.map((d) => d.theme))], line.groups);
});

test('chậu mới số N giữ độ hiếm, giá, cấp mở, họ cây ưa, bộ và nguồn của chậu cũ số N (chỉ thị 05: cấp và kỹ năng cân bằng riêng)', () => {
  assert.equal(old.length, 50);
  for (const d of sig) {
    const o = old.find((x) => nn(x) === nn(d))!;
    for (const k of ECONOMY) assert.deepEqual(d[k], o[k], `${d.id}.${k}`);
    assert.equal(d.levels.length, 50, `${d.id}: 50 cấp`);
  }
});

test('50 chậu cũ: giữ id, đánh dấu retired, không bán, không có trong cửa hàng', () => {
  for (const o of old) {
    assert.equal(o.retired, true, o.id);
    assert.match(o.id, /^base:pot\.\d\d-/);
    assert.equal(isSoldInShop(o), false);
  }
  const shop = content.potList.filter(isSoldInShop);
  assert.ok(shop.every((d) => !d.retired));
  assert.equal(shop.filter((d) => d.id.startsWith('base:pot.sig-')).length, 50);
  const s = newGame(content, { level: 60, coins: 10_000_000 });
  const r = dispatch(content, s, { type: 'buyPot', potId: old[0]!.id }, T0);
  assert.equal(r.ok, false);
  assert.ok(dispatch(content, s, { type: 'buyPot', potId: sig[0]!.id }, T0).ok);
});

test('save cũ có chậu base:pot.NN-… vẫn tải được, chậu vẫn trồng và thu hoạch', async () => {
  const s = newGame(content, { level: 30 });
  const slot = s.floors[0]!.slots[0]!;
  const oldId = old[6]!.id;
  s.pots[slot.potInstanceId] = { potId: oldId, level: 50, history: [{ level: 50, at: T0 }], source: 'old-save' };
  s.potBook[oldId] = { firstAt: T0, bestLevel: 50 };
  const store = new MemoryStore();
  await new SaveManager(store, content).save(s, T0);
  const r = await new SaveManager(store, content).load();
  assert.equal(r.kind, 'loaded');
  if (r.kind !== 'loaded') return;
  const st = r.state;
  const pot = st.pots[st.floors[0]!.slots[0]!.potInstanceId]!;
  assert.equal(pot.potId, oldId);
  assert.equal(pot.level, 50);
  assert.ok(dispatch(content, st, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0).ok);
  const ripe = T0 + 600 * MIN;
  assert.ok(dispatch(content, st, { type: 'harvest', floor: 0, slot: 0 }, ripe).ok);
});
