// Chỉ thị 12 TỔNG B7.2: pot shards, combining, stars.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { shardId } from '../src/core/content.ts';
import { obtainPot } from '../src/systems/potStars.ts';
import { grantPot, potStat } from '../src/systems/pots.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const ps = content.potStars!;
const def = content.potList.find((p) => p.rarity === 'epic')!;

test('mỗi chậu có món Mảnh trong Túi Nguyên Liệu', () => {
  for (const p of content.potList) {
    const it = content.items.get(shardId(p.id));
    assert.ok(it && it.kind === 'shard' && !it.countsTowardStorage && it.potId === p.id, p.id);
  }
});

test('chậu trùng từ nguồn may mắn đổi thành mảnh; mua ở Lò, đúc, đổi vẫn ra chậu', () => {
  const s = newGame(content, { level: 30 });
  const first = obtainPot(content, s, def.id, 'bazaar', T0);
  assert.ok('potInstanceId' in first);
  const again = obtainPot(content, s, def.id, 'sea', T0);
  assert.deepEqual(again, { shards: { itemId: shardId(def.id), qty: ps.duplicateShards } });
  assert.equal(s.inventory[shardId(def.id)], ps.duplicateShards);
  const n = Object.keys(s.pots).length;
  assert.ok('potInstanceId' in obtainPot(content, s, def.id, 'cast', T0));
  assert.equal(Object.keys(s.pots).length, n + 1);
});

test('nâng sao bằng mảnh: ★0 → ★5, mỗi sao tăng chỉ số; hết sao thì báo', () => {
  const s = newGame(content, { level: 30 });
  const id = grantPot(s, def.id, 'shop', T0);
  const stat = (Object.keys(def.levels[0]!.stats)[0] ?? 'speed') as Parameters<typeof potStat>[2];
  const base = potStat(content, s.pots[id]!, stat);
  assert.deepEqual(dispatch(content, s, { type: 'starUpPot', potInstanceId: id }, T0), { ok: false, error: 'not_enough_items' });
  s.inventory[shardId(def.id)] = ps.starShards.reduce((a, b) => a + b, 0);
  for (let k = 1; k <= ps.maxStars; k++) {
    const r = dispatch(content, s, { type: 'starUpPot', potInstanceId: id }, T0);
    assert.ok(r.ok);
    assert.equal(s.pots[id]!.stars, k);
  }
  assert.equal(s.inventory[shardId(def.id)] ?? 0, 0);
  if (base > 0) assert.ok(potStat(content, s.pots[id]!, stat) > base);
  assert.deepEqual(dispatch(content, s, { type: 'starUpPot', potInstanceId: id }, T0), { ok: false, error: 'pot_max_stars' });
});

test('gom đủ mảnh thì ghép thành chậu nguyên', () => {
  const s = newGame(content, { level: 30 });
  s.inventory[shardId(def.id)] = ps.combineShards - 1;
  assert.deepEqual(dispatch(content, s, { type: 'combineShards', potId: def.id }, T0), { ok: false, error: 'not_enough_items' });
  s.inventory[shardId(def.id)] = ps.combineShards;
  const r = dispatch(content, s, { type: 'combineShards', potId: def.id }, T0);
  const ev = r.ok ? r.events.find((e) => e.type === 'potCombined') : undefined;
  assert.ok(ev && ev.type === 'potCombined');
  assert.equal(s.pots[ev.potInstanceId]!.potId, def.id);
  assert.equal(s.inventory[shardId(def.id)] ?? 0, 0);
});
