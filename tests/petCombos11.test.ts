// Chỉ thị 11 TỔNG § E4: kết hợp thú cưng (cấp 14) và túi quà mỗi ngày của Sẻ (§ E1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { activeCombos, comboValue, jadeRainCooldownMs, newPet, sparrowDailyGift } from '../src/systems/pets.ts';
import { HOUR, loadBase, MIN, newGame, T0, TOMATO } from './helpers.ts';

const content = await loadBase();
const KITTEN = 'pet.cloud-kitten';
const FOX = 'pet.fire-fox';
const SPARROW = 'pet.sprout-sparrow';
const DRAGON = 'pet.jade-dragon';

function game(level: number, pets: string[], floor = 0): GameState {
  const s = newGame(content, { level, coins: 1e6 });
  for (const id of pets) {
    const p = newPet(id, T0, true);
    p.floor = floor;
    s.pets.push(p);
  }
  return s;
}

test('kết hợp chỉ mở từ cấp 14 và cần cả hai bé được dắt, còn no, ở nhà', () => {
  assert.equal(activeCombos(content, game(13, [KITTEN, FOX]), T0).length, 0);
  const s = game(14, [KITTEN, FOX]);
  assert.deepEqual(activeCombos(content, s, T0).map((c) => c.def.id), ['caravan']);
  s.pets[1]!.active = false;
  assert.equal(activeCombos(content, s, T0).length, 0);
  s.pets[1]!.active = true;
  s.pets[1]!.awayUntil = T0 + HOUR;
  assert.equal(activeCombos(content, s, T0).length, 0);
  assert.equal(activeCombos(content, s, T0 + 30 * HOUR).length, 0, 'đói thì không');
});

test('Mùa Màng: Sẻ và Rồng cùng trông một tầng thì cây trên tầng đó lớn nhanh hơn 8%', () => {
  const ready = (pets: string[], sparrowFloor = 0) => {
    const s = game(20, pets);
    const sp = s.pets.find((p) => p.species === SPARROW);
    if (sp) sp.floor = sparrowFloor;
    assert.ok(dispatch(content, s, { type: 'plant', floor: 0, slot: 0, cropId: TOMATO }, T0 + MIN).ok);
    return s.floors[0]!.slots[0]!.planting!.bonusMs;
  };
  assert.equal(ready([SPARROW]), 0);
  assert.ok(ready([SPARROW, DRAGON]) > 0);
  assert.equal(comboValue(content, game(20, [SPARROW, DRAGON]), 'growth', T0, 1), 0, 'tầng khác không có');
});

test('Lửa và Nước: Mưa Ngọc hồi nhanh hơn 20%', () => {
  const alone = game(20, [DRAGON]);
  const pair = game(20, [DRAGON, FOX]);
  const a = jadeRainCooldownMs(content, alone.pets[0]!, alone, T0);
  const b = jadeRainCooldownMs(content, pair.pets[0]!, pair, T0);
  assert.equal(Math.round(b), Math.round(a * 0.8));
});

test('Sẻ mang về 1 túi quà mỗi ngày; Vườn Nhà thành 2 túi', () => {
  const one = game(20, [SPARROW]);
  const g1 = sparrowDailyGift(content, one, T0)!;
  assert.equal(g1.bags, 1);
  assert.equal(sparrowDailyGift(content, one, T0 + HOUR), null, 'mỗi ngày một lần');
  assert.ok(sparrowDailyGift(content, one, T0 + 24 * HOUR));
  const two = game(20, [SPARROW, KITTEN]);
  const g2 = sparrowDailyGift(content, two, T0)!;
  assert.equal(g2.bags, 2);
  assert.equal(g2.coins, g1.coins * 2);
});

test('Thương Đoàn cộng vào Khách Quý', () => {
  assert.equal(comboValue(content, game(14, [KITTEN, FOX]), 'vipBonus', T0), 0.1);
  assert.equal(comboValue(content, game(14, [KITTEN]), 'vipBonus', T0), 0);
});
