// Bổ sung A6.4–A6.6 (chỉ thị 12 TỔNG, mục A6 mới): Hoa Trăng Non grows twice as fast at night,
// Thông Thạo stars from the harvest count with their bonus, the daily hot crop, and every crop has at
// least 3 uses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { cropStatus, isNight } from '../src/systems/growth.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { sellPrice } from '../src/systems/economy.ts';
import { flightFor } from '../src/systems/orders.ts';
import { hotCrop, masteryStars } from '../src/systems/cropExtras.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const base = await loadBase();
// The features are tested with the proposed numbers (crop-extras.json keeps them neutral until the
// CTO tunes the economy with them; GAME_SYSTEMS § 2).
const proposed = (base.cropExtras as unknown as { _proposed: { nightGrowth: Record<string, number>; masteryValues: number[]; hot: { sellBonus: number; orderBonus: number } } })._proposed;
const content = {
  ...base,
  cropExtras: {
    nightGrowth: proposed.nightGrowth,
    mastery: base.cropExtras!.mastery.map((m, i) => ({ ...m, value: proposed.masteryValues[i]! })),
    hot: proposed.hot,
  },
} as typeof base;
const MOON = 'base:crop.crescent-flower';
const DAY = 24 * HOUR;

test('Hoa Trăng Non: trồng ban đêm chín sau nửa thời gian (cả đêm lớn nhanh gấp đôi)', () => {
  let start = T0;
  while (!(isNight(content, start) && isNight(content, start + 4 * HOUR))) start += 10 * MIN;
  const s = newGame(content, { level: 20, coins: 1e6 }, 4);
  assert.ok(dispatch(content, s, { type: 'plant', cropId: MOON, floor: 0, slot: 0 }, start).ok);
  const st = cropStatus(content, s, s.floors[0]!.slots[0]!, start)!;
  assert.ok(Math.abs(st.remainingMs - st.cycleMs / 2) <= 1, `${st.remainingMs} vs ${st.cycleMs / 2}`);
});

test('Thông Thạo: sao theo số lần thu hoạch, ★1 cộng sản lượng', () => {
  const s = newGame(content, { level: 20 }, 2);
  const crop = content.crops.get('base:crop.cherry-tomato')!;
  const slot = s.floors[0]!.slots[0]!;
  const before = slotBonus(content, s, slot, crop, 'yield');
  assert.equal(masteryStars(content, s, crop.id), 0);
  s.journal[crop.id] = { harvests: 10, mutations: {}, claimed: 0 };
  assert.equal(masteryStars(content, s, crop.id), 1);
  assert.ok(Math.abs(slotBonus(content, s, slot, crop, 'yield') - before - content.cropExtras!.mastery[0]!.value) < 1e-9);
  s.journal[crop.id]!.harvests = 3000;
  assert.equal(masteryStars(content, s, crop.id), 5);
});

test('Cây Hot: một cây mỗi ngày, tất định, đổi theo ngày; giá bán +30%, đơn có cây Hot +20% xu', () => {
  const s = newGame(content, { level: 20 }, 7);
  const a = hotCrop(content, s, 20, T0)!;
  assert.equal(hotCrop(content, s, 20, T0 + HOUR)!.id, a.id);
  const days = new Set(Array.from({ length: 10 }, (_, d) => hotCrop(content, s, 20, T0 + d * DAY)!.id));
  assert.ok(days.size > 1, 'Cây Hot không đổi theo ngày');
  const other = content.cropList.find((c) => c.unlockLevel <= 20 && c.id !== a.id)!;
  const base = (id: string) => content.items.get(id)!.sellPrice!;
  const ratio = sellPrice(content, s, a.produce.id, T0)! / base(a.produce.id);
  const ratioOther = sellPrice(content, s, other.produce.id, T0)! / base(other.produce.id);
  assert.ok(ratio > ratioOther * 1.15, `Hot ${ratio}, thường ${ratioOther}`);
  const order = { id: 1, customer: '', items: { [a.produce.id]: 2 }, coins: 1000, xp: 10, gems: 0, rare: false };
  assert.equal(flightFor(content, s, order, null, T0).coins, Math.round(1000 * (1 + content.cropExtras!.hot.orderBonus)));
});

test('mỗi cây có ít nhất 3 công dụng (bán/đơn, bọ, chim, Xưởng)', () => {
  for (const crop of content.cropList) {
    const uses = [
      crop.sellPrice > 0, // Chợ, đơn khinh khí cầu
      crop.bugs.length > 0, // bọ đậu (nguyên liệu nâng chậu)
      [...(content.birds?.values() ?? [])].some((b) => b.families.length === 0 || b.families.includes(crop.family)), // thức ăn chim
      [...(content.recipes?.values() ?? [])].some(({ recipe }) => crop.produce.id in recipe.inputs), // Xưởng
    ].filter(Boolean).length;
    assert.ok(uses >= 3, `${crop.id}: ${uses} công dụng`);
  }
});
