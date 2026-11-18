// Chỉ thị 10 M8: Xu Xu's hourly gift, missions for the new systems, newer wares at Chợ Mây,
// fishing castsPerDay, decor price by level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dispatch } from '../src/core/game.ts';
import { loadContentPack } from '../src/core/content.ts';
import { recordMissions } from '../src/systems/missions.ts';
import { nextFeature } from '../src/systems/xuxu.ts';
import { decorPrice } from '../src/systems/decor.ts';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { tidy } from '../src/core/income.ts';
import { CONTENT_DIR, HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const patched = (file: string, patch: (raw: any) => void) =>
  loadContentPack(async (f) => {
    const raw = JSON.parse(await readFile(join(CONTENT_DIR, f), 'utf8'));
    if (f === file) patch(raw);
    return raw;
  });

test('Xu Xu: chạm thì nói; quà nhỏ tối đa 1 lần mỗi rewardMinutes', () => {
  const s = newGame(content, { level: 3 });
  const item = Object.keys(content.xuxu!.reward.items ?? {})[0]!;
  const have = s.inventory[item] ?? 0;
  const r1 = dispatch(content, s, { type: 'tapXuxu' }, T0);
  const e1 = r1.ok ? r1.events.find((e) => e.type === 'xuxuTapped') : undefined;
  assert.ok(e1 && e1.type === 'xuxuTapped' && e1.gift && e1.line.length > 0);
  assert.equal(s.inventory[item], have + 1);
  const r2 = dispatch(content, s, { type: 'tapXuxu' }, T0 + 10 * 60_000);
  const e2 = r2.ok ? r2.events.find((e) => e.type === 'xuxuTapped') : undefined;
  assert.ok(e2 && e2.type === 'xuxuTapped' && e2.gift === null);
  const r3 = dispatch(content, s, { type: 'tapXuxu' }, T0 + content.xuxu!.rewardMinutes * 60_000);
  assert.ok(r3.ok && r3.events.some((e) => e.type === 'xuxuTapped' && e.gift !== null));
  assert.equal(nextFeature(content, newGame(content, { level: 1 }))?.level, 2);
});

test('nhiệm vụ ngày đếm các hệ mới', () => {
  const s = newGame(content, { level: 20 });
  s.missions.list = ['feed-bird', 'blow-cloud', 'catch-fish'].map((id) => ({ id, progress: 0, claimed: false }));
  recordMissions(content, s, [
    { type: 'birdFed', birdId: 'b', food: 1 },
    { type: 'cloudBlown', cell: 0, finds: [] },
    { type: 'fishReeled', fishId: 'base:fish.pink', landed: false, first: false },
    { type: 'fishReeled', fishId: 'base:fish.pink', landed: true, first: true },
  ]);
  assert.deepEqual(s.missions.list.map((m) => m.progress), [1, 1, 1]);
});

test('Chợ Mây: Phú Bà cấp cao bày hàng mới (hàng chế biến, khoáng…), không bày bọ Rất hiếm', () => {
  const s = newGame(content, { level: 20 }, 9);
  simulateNeighbors(content, s, T0 + 5 * 24 * HOUR);
  const listed = Object.values(s.neighbors).flatMap((b) => b.stall.map((l) => l.itemId));
  const wares = content.neighbors.market.wares!;
  assert.ok(listed.some((id) => wares.minLevel[id] !== undefined || content.goods?.has(id)), 'có món mới');
  assert.ok(!listed.some((id) => content.bugs.get(id)?.rarity === 'epic'));
});

test('castsPerDay giới hạn lượt thả câu mỗi ngày (0 = không giới hạn)', async () => {
  const c = await patched('fishing.json', (raw) => (raw.castsPerDay = 2));
  const bait = c.fishing!.baits[0]!.item;
  const s = newGame(c, { level: 20 });
  s.inventory[bait] = 10;
  for (let i = 0; i < 2; i++) {
    assert.ok(dispatch(c, s, { type: 'castLine', bait }, T0).ok);
    dispatch(c, s, { type: 'reelFish', success: false }, T0);
  }
  assert.deepEqual(dispatch(c, s, { type: 'castLine', bait }, T0), { ok: false, error: 'casts_used' });
  assert.ok(dispatch(c, s, { type: 'castLine', bait }, T0 + 24 * HOUR).ok);
});

test('giá trang trí cộng decorU × U(cấp); 0 thì giữ giá cũ', async () => {
  const id = Object.keys(content.decor!.items)[0]!;
  const s = newGame(content, { level: 20 });
  const flat = await patched('market.json', (raw) => (raw.levelPricing.decorU = 0)); // base carries the CTO's number
  assert.equal(decorPrice(flat, s, id), flat.decor!.items[id]!.price);
  const c = await patched('market.json', (raw) => (raw.levelPricing.decorU = 0.5));
  assert.equal(decorPrice(c, s, id), c.decor!.items[id]!.price + tidy(0.5 * c.income.unit(20)));
});
