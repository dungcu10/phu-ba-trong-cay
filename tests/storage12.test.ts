// Chỉ thị 12 TỔNG A2: Kho Nông Sản (produce + goods, limited) and Túi Nguyên Liệu (all else, no limit);
// Bán nhanh sells what the open orders do not need.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { storageUsed } from '../src/systems/economy.ts';
import { orderNeeds, quickSellPlan, storeOf } from '../src/systems/storage.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();

test('mỗi món thuộc đúng 1 kho: nông sản và hàng chế biến ở Kho Nông Sản, còn lại ở Túi', () => {
  for (const item of content.items.values()) {
    const want = item.kind === 'produce' || item.kind === 'good' ? 'farm' : 'bag';
    assert.equal(storeOf(content, item.id), want, item.id);
  }
});

test('Túi không chiếm chỗ kho: 339 Bọ Rùa + khoáng không làm kho đầy', () => {
  const s = newGame(content, { level: 10 });
  s.inventory = { 'base:bug.ladybird': 339, 'base:mat.cloud-stone': 50, 'base:mat.sky-dew': 12 };
  assert.equal(storageUsed(content, s), 0);
  const crop = content.cropList[0]!;
  s.inventory[crop.produce.id] = 7;
  assert.equal(storageUsed(content, s), 7);
});

test('Bán nhanh: giữ đủ cho đơn đang mở, bán phần thừa, túi không đụng tới', () => {
  const s = newGame(content, { level: 12 });
  updateWorld(content, s, T0 + 6 * 3_600_000);
  const order = s.orders.slots.find((x) => x.order)?.order;
  assert.ok(order, 'cần một đơn đang mở');
  const need = orderNeeds(s);
  for (const [id, q] of Object.entries(need)) s.inventory[id] = q + 3;
  const extra = content.cropList[0]!.produce.id;
  s.inventory[extra] = (s.inventory[extra] ?? 0) + 5;
  s.inventory['base:bug.ladybird'] = 20;
  const before = structuredClone(s.inventory);
  const plan = quickSellPlan(content, s, T0 + 6 * 3_600_000);
  const gain = plan.reduce((a, p) => a + p.coins, 0);
  const r = dispatch(content, s, { type: 'quickSell' }, T0 + 6 * 3_600_000);
  assert.ok(r.ok);
  const ev = r.events.find((e) => e.type === 'quickSold');
  assert.ok(ev && ev.type === 'quickSold' && ev.coins === gain && gain > 0);
  for (const [id, q] of Object.entries(need)) assert.equal(s.inventory[id], q, id);
  assert.equal(s.inventory['base:bug.ladybird'], 20);
  for (const p of plan) assert.equal((s.inventory[p.itemId] ?? 0), before[p.itemId]! - p.qty);
  assert.deepEqual(dispatch(content, s, { type: 'quickSell' }, T0 + 6 * 3_600_000), { ok: false, error: 'nothing_to_sell' });
});
