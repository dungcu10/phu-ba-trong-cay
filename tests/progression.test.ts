// Nâng cấp v3, đợt 1: endless levels and floors, Rương Mây upgrades, Mưa Mây, pacing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, nextFloor } from '../src/core/game.ts';
import { cloudRainCost } from '../src/core/game.ts';
import { GEN_PREFIX } from '../src/core/floorgen.ts';
import { addXp, levelUpReward, storageCapacity, storageUpgradeCost, xpToNextLevel } from '../src/systems/economy.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { SaveManager } from '../src/persistence/saveManager.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { simulateProgression } from '../tools/progression.ts';
import { DAISY, HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();

test('không có cấp tối đa: XP mỗi cấp tăng dần, lên được cấp 200', () => {
  for (let lv = 1; lv < 300; lv++) assert.ok(xpToNextLevel(content, lv + 1) > xpToNextLevel(content, lv), `cấp ${lv}`);
  const s = newGame(content);
  let total = 0;
  for (let lv = 1; lv < 200; lv++) total += xpToNextLevel(content, lv);
  const gained = addXp(content, s, total);
  assert.equal(s.player.level, 200);
  assert.equal(gained.length, 199);
});

test('thưởng lên cấp tăng theo cấp, có ngọc mỗi 5 cấp và nguyên liệu mỗi 10 cấp', () => {
  const r4 = levelUpReward(content, 4);
  const r5 = levelUpReward(content, 5);
  const r10 = levelUpReward(content, 10);
  assert.ok(r5.coins > r4.coins);
  assert.equal(r4.gems, 0);
  assert.ok(r5.gems > 0);
  assert.ok(r10.gems > r5.gems && Object.keys(r10.items).length > 0);
  for (const id of Object.keys(r10.items)) assert.ok(content.items.has(id), id);
  const s = newGame(content);
  const before = { coins: s.player.coins, gems: s.player.gems };
  addXp(content, s, [1, 2, 3, 4].reduce((a, lv) => a + xpToNextLevel(content, lv), 0));
  assert.equal(s.player.level, 5);
  const paid = [2, 3, 4, 5].map((lv) => levelUpReward(content, lv));
  assert.equal(s.player.coins - before.coins, paid.reduce((a, r) => a + r.coins, 0));
  assert.equal(s.player.gems - before.gems, paid.reduce((a, r) => a + r.gems, 0));
});

test('tầng mây vô tận: sau tầng thiết kế sẵn là tầng sinh tự động, yêu cầu tăng dần', () => {
  const hand = content.floorList.length;
  let prev = content.floorList[hand - 1]!;
  for (let n = hand + 1; n <= hand + 40; n++) {
    const def = content.floors.get(`${GEN_PREFIX}${n}`)!;
    assert.ok(def, `tầng ${n}`);
    assert.equal(content.floors.get(def.id), def, 'cùng một đối tượng mỗi lần');
    assert.ok(def.unlockLevel > prev.unlockLevel, `tầng ${n}: cấp yêu cầu tăng`);
    assert.ok(def.unlockCost > prev.unlockCost, `tầng ${n}: giá tăng`);
    assert.ok(content.pots.has(def.startingPot));
    assert.equal(def.expandCosts.length, def.maxSlots - def.slotCount);
    for (const st of def.stars) {
      assert.ok(st.level > def.unlockLevel);
      for (const id of Object.keys(st.items)) assert.ok(content.items.has(id), `tầng ${n}: sao cần ${id}`);
    }
    assert.ok(def.name.vi.length > 0);
    prev = def;
  }
  assert.equal(content.floors.get(`${GEN_PREFIX}${hand}`), undefined, 'không sinh trùng tầng thiết kế sẵn');
  assert.equal(content.floors.has('base:floor.khong-co'), false);
});

test('mở tầng nối tiếp qua lệnh thật, lưu rồi tải lại vẫn giữ tầng sinh tự động', async () => {
  const s = newGame(content, { level: 120, coins: 1e12 });
  for (let i = 0; i < 7; i++) {
    const nf = nextFloor(content, s)!;
    assert.ok(dispatch(content, s, { type: 'unlockFloor', floorId: nf.id }, T0).ok, nf.id);
  }
  assert.equal(s.floors.length, 8);
  assert.equal(s.floors[7]!.floorId, `${GEN_PREFIX}8`);
  assert.ok(dispatch(content, s, { type: 'expandFloor', floor: 7 }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 7, slot: 0 }, T0).ok);
  const store = new MemoryStore();
  await new SaveManager(store, content).save(s, T0);
  const r = await new SaveManager(store, content).load();
  assert.equal(r.kind, 'loaded');
  if (r.kind !== 'loaded') return;
  assert.deepEqual(r.state.floors.map((f) => f.floorId), s.floors.map((f) => f.floorId));
  assert.equal(r.state.floors[7]!.slots.length, 7);
  assert.equal(nextFloor(content, r.state)!.id, `${GEN_PREFIX}9`);
  const later = T0 + 2 * MIN;
  assert.ok(dispatch(content, r.state, { type: 'harvest', floor: 7, slot: 0 }, later).ok);
});

test('Rương Mây nâng không giới hạn, mỗi bậc đắt hơn', () => {
  const s = newGame(content, { coins: 1e9 });
  const cap0 = storageCapacity(content, s);
  let last = 0;
  for (let i = 0; i < 25; i++) {
    const cost = storageUpgradeCost(content, s);
    assert.ok(cost > last);
    last = cost;
    const coins = s.player.coins;
    const r = dispatch(content, s, { type: 'upgradeStorage' }, T0);
    assert.ok(r.ok);
    assert.equal(coins - s.player.coins, cost);
  }
  assert.equal(storageCapacity(content, s), cap0 + 25 * content.config.storageUpgrade.perTier);
  const poor = newGame(content, { coins: 0 });
  const r = dispatch(content, poor, { type: 'upgradeStorage' }, T0);
  assert.equal(r.ok ? 'ok' : r.error, 'not_enough_coins');
});

test('Mưa Mây: tốn ngọc theo thời gian còn lại, làm chín cả tầng', () => {
  const s = newGame(content, { level: 10, coins: 5000, gems: 100 });
  const strawberry = content.cropList.find((c) => c.unlockLevel === 6)!.id;
  assert.equal(dispatch(content, s, { type: 'cloudRain', floor: 0 }, T0).ok ? 'ok' : 'nothing', 'nothing');
  for (let i = 0; i < 4; i++) assert.ok(dispatch(content, s, { type: 'plant', cropId: i < 2 ? strawberry : DAISY, floor: 0, slot: i }, T0).ok);
  const cost = cloudRainCost(content, s, 0, T0);
  assert.equal(cost.pots, 4);
  assert.ok(cost.gems >= 4);
  const gems = s.player.gems;
  const r = dispatch(content, s, { type: 'cloudRain', floor: 0 }, T0);
  assert.ok(r.ok);
  assert.equal(gems - s.player.gems, cost.gems);
  for (let i = 0; i < 4; i++) assert.ok(cropStatus(content, s, s.floors[0]!.slots[i]!, T0)!.ripe, `chậu ${i} chín`);
  const broke = newGame(content, { gems: 0 });
  dispatch(content, broke, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0);
  const f = dispatch(content, broke, { type: 'cloudRain', floor: 0 }, T0);
  assert.equal(f.ok ? 'ok' : f.error, 'not_enough_gems');
  void HOUR;
});

test('nhịp tiến trình: người chơi ghé 2 giờ/lần luôn có tầng mới để hướng tới, không lên cấp vọt', () => {
  const { days } = simulateProgression(content, 120, 21);
  const at = (d: number) => days[d - 1]!;
  // First week: new floors keep coming; the 4th floor (first generated) within the week.
  assert.ok(at(7).floors >= 4, `ngày 7 có ${at(7).floors} tầng`);
  assert.ok(at(7).level >= 20 && at(7).level <= 45, `ngày 7 cấp ${at(7).level}`);
  // Later weeks: still progressing, but slower (no level 100 in three weeks).
  assert.ok(at(21).level > at(14).level && at(14).level > at(7).level);
  assert.ok(at(21).level <= 70, `ngày 21 cấp ${at(21).level}`);
  assert.ok(at(21).floors > at(7).floors);
});
