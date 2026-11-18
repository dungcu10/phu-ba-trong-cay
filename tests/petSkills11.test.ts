// Chỉ thị 11 TỔNG § E1: kỹ năng 2–3 của thú cưng — Mèo Tự Bày Hàng / Khách Quý, Cáo Đánh Hơi / Lửa Ấm,
// Sẻ Gieo Lại Như Cũ / Thu Hoạch Hộ (dùng chung harvest, kho đầy thì dừng, EXP một nửa), Rồng Ban Lộc.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { newPet, sniffedChests } from '../src/systems/pets.ts';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { DAISY, HOUR, loadBase, MIN, newGame, T0, TOMATO } from './helpers.ts';

const content = await loadBase();
const KITTEN = 'pet.cloud-kitten';
const FOX = 'pet.fire-fox';
const SPARROW = 'pet.sprout-sparrow';
const DRAGON = 'pet.jade-dragon';

function withPet(species: string, level: number, at = T0, stars = 1): GameState {
  const s = newGame(content, { level: 20, coins: 1e6 });
  const p = newPet(species, at, true);
  p.level = level;
  p.stars = stars;
  s.pets.push(p);
  return s;
}

function plantAll(s: GameState, cropId: string, at: number): void {
  s.floors[0]!.slots.forEach((_, i) => assert.ok(dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId }, at).ok));
}

test('Sẻ Gieo Lại Như Cũ: chậu vừa thu hoạch xong tự gieo lại đúng giống; có công tắc; chưa mở ở cấp < 10', () => {
  const s = withPet(SPARROW, 10);
  plantAll(s, DAISY, T0);
  const r = dispatch(content, s, { type: 'harvest', floor: 0, slot: 0 }, T0 + 2 * MIN);
  assert.ok(r.ok && r.events.some((e) => e.type === 'petReplanted'));
  assert.equal(s.floors[0]!.slots[0]!.planting?.cropId, DAISY);
  assert.ok(dispatch(content, s, { type: 'toggleReplant', on: false }, T0 + 3 * MIN).ok);
  dispatch(content, s, { type: 'harvest', floor: 0, slot: 1 }, T0 + 3 * MIN);
  assert.equal(s.floors[0]!.slots[1]!.planting, null);
  const low = withPet(SPARROW, 9);
  plantAll(low, DAISY, T0);
  dispatch(content, low, { type: 'harvest', floor: 0, slot: 0 }, T0 + 2 * MIN);
  assert.equal(low.floors[0]!.slots[0]!.planting, null);
});

test('Sẻ Thu Hoạch Hộ: cứ (4 → 2) giờ thu cây chín trên tầng của Sẻ bằng harvest chung, EXP một nửa, cả khi tắt game', () => {
  const s = withPet(SPARROW, 20);
  plantAll(s, TOMATO, T0);
  const xp0 = s.player.xp;
  const lv0 = s.player.level;
  const r = dispatch(content, s, { type: 'toggleReplant', on: false }, T0 + 4 * HOUR + 5 * MIN);
  const got = r.ok ? r.events.filter((e) => e.type === 'harvested') : [];
  assert.ok(got.length > 0, 'đã thu hộ');
  assert.ok(got.every((e) => e.type === 'harvested' && e.helper));
  const full = got.reduce((a, e) => a + (e.type === 'harvested' ? Math.round(content.crops.get(TOMATO)!.xp) : 0), 0);
  if (s.player.level === lv0) assert.ok(s.player.xp - xp0 < full, 'EXP ít hơn tự thu');
});

test('Sẻ Thu Hoạch Hộ dừng khi kho đầy', () => {
  const s = withPet(SPARROW, 20);
  plantAll(s, TOMATO, T0);
  s.inventory[content.crops.get(DAISY)!.produce.id] = 1e6;
  const r = dispatch(content, s, { type: 'toggleReplant', on: false }, T0 + 4 * HOUR + 5 * MIN);
  assert.ok(r.ok && r.events.some((e) => e.type === 'petHarvested' && e.stopped));
  assert.ok(!r.events.some((e) => e.type === 'harvested'));
});

test('Rồng Ban Lộc: mỗi ngày 1 lần thu hoạch trên tầng của Rồng được nhân đôi', () => {
  const qty = (lvl: number) => {
    const s = withPet(DRAGON, lvl);
    plantAll(s, DAISY, T0);
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = dispatch(content, s, { type: 'harvest', floor: 0, slot: i }, T0 + 2 * MIN);
      const h = r.ok ? r.events.find((e) => e.type === 'harvested') : undefined;
      out.push(h?.type === 'harvested' ? h.qty : 0);
    }
    return out;
  };
  const off = qty(1);
  const on = qty(20);
  assert.equal(on[0], off[0]! * 2);
  assert.deepEqual(on.slice(1), off.slice(1));
});

test('Cáo Lửa Ấm: tưới trên tầng của Cáo rút ngắn nhiều hơn', () => {
  const saved = (lvl: number) => {
    const s = withPet(FOX, lvl);
    plantAll(s, TOMATO, T0);
    const r = dispatch(content, s, { type: 'water', floor: 0, slot: 0 }, T0 + MIN);
    const e = r.ok ? r.events.find((x) => x.type === 'watered') : undefined;
    return e?.type === 'watered' ? e.savedMs : 0;
  };
  assert.ok(saved(20) > saved(1) * 1.15);
});

test('Cáo Đánh Hơi: đánh dấu sẵn (1 → 2) rương mỗi bản đồ', () => {
  assert.deepEqual(sniffedChests(content, withPet(FOX, 9), [30, 4, 4, 12], T0), []);
  assert.deepEqual(sniffedChests(content, withPet(FOX, 10), [30, 4, 4, 12], T0), [4]);
  assert.equal(sniffedChests(content, withPet(FOX, 10, T0, 5), [30, 4, 12], T0).length, 2);
});

test('Mèo Tự Bày Hàng bày lại món bán hết từ kho (cùng giá); Khách Quý trả cao hơn 1 lần mỗi ngày', () => {
  const run = (lvl: number) => {
    const s = withPet(KITTEN, lvl, T0, 5);
    s.pets[0]!.fedAt = T0 + 20 * HOUR;
    const crop = content.cropList[0]!;
    s.inventory[crop.produce.id] = 200;
    const price = Math.max(1, Math.round(crop.sellPrice * 0.8));
    s.stall = [{ id: 1, itemId: crop.produce.id, qty: 2, price, qty0: 2 }];
    const ev = simulateNeighbors(content, s, T0 + 20 * HOUR);
    return { ev, s, price };
  };
  const off = run(1);
  assert.ok(!off.ev.some((e) => e.type === 'stallRestocked'));
  const on = run(20);
  const sold = on.ev.filter((e) => e.type === 'stallSold');
  assert.ok(sold.length > 0);
  assert.ok(on.ev.some((e) => e.type === 'stallRestocked'), 'bày lại');
  assert.ok(on.s.stall.every((l) => l.price === on.price));
  assert.equal(sold.filter((e) => e.type === 'stallSold' && e.vip).length, 1);
});
