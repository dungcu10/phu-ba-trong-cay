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
import { floorAtIndex } from '../src/core/floorgen.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
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

// Plan A5: long runs through the real command processor, three play styles.
const STYLES = [
  { minutes: 15, days: 90, label: 'ghé 15 phút/lần' },
  { minutes: 120, days: 365, label: 'ghé 2 giờ/lần' },
  { minutes: 480, days: 365, label: 'ghé 8 giờ/lần' },
];
for (const st of STYLES) {
  test(`mô phỏng ${st.days} ngày, ${st.label}: tiến đều, không quá 10 ngày thiếu mốc, không ôm xu/ngọc`, () => {
    const { days } = simulateProgression(content, st.minutes, st.days);
    let gap = 0;
    for (const [i, d] of days.entries()) {
      if (i > 0) {
        assert.ok(d.level >= days[i - 1]!.level && d.floors >= days[i - 1]!.floors, `ngày ${d.day}: không lùi`);
      }
      gap = d.milestones > 0 ? 0 : gap + 1;
      assert.ok(gap <= 10, `ngày ${d.day}: ${gap} ngày liền không có mốc mới`);
      // Coins: at most 72 hours of income, or 1.5× the next floor the player is saving for.
      const next = floorAtIndex(content.floors, content.floorList, d.floors);
      assert.ok(d.coins <= Math.max(72 * d.unit, 1.5 * next.unlockCost), `ngày ${d.day}: ôm ${d.coins} xu`);
    }
    const late = days.slice(-30);
    const gemsPerDay = late.reduce((a, d) => a + d.gemsEarned, 0) / late.length;
    assert.ok(gemsPerDay <= content.surprises.giftGemsPerDay + 6, `ngọc mỗi ngày ${gemsPerDay}`);
    assert.ok(days.at(-1)!.level > days.at(-31)!.level, '30 ngày cuối vẫn lên cấp');
    if (st.minutes === 120) {
      const at = (n: number) => days[n - 1]!;
      assert.ok(at(7).level >= 20 && at(7).level <= 45, `ngày 7 cấp ${at(7).level}`);
      assert.ok(at(30).level >= 40 && at(30).level <= 70, `ngày 30 cấp ${at(30).level}`);
      assert.ok(at(7).floors >= 4, `ngày 7 có ${at(7).floors} tầng`);
    }
  });
}

test('số học: cấp 1→10 000, tầng 1→1 000, Rương Mây 10 000 bậc đều hữu hạn, nguyên, tăng dần', () => {
  let last = 0;
  for (let lv = 1; lv <= 10_000; lv++) {
    const xp = xpToNextLevel(content, lv);
    assert.ok(Number.isSafeInteger(xp) && xp > last, `XP cấp ${lv}: ${xp}`);
    last = xp;
  }
  let u = 0;
  for (let lv = 1; lv <= 10_000; lv += 7) {
    const v = content.income.unit(lv);
    assert.ok(Number.isFinite(v) && v >= u, `U(${lv}) = ${v}`);
    u = v;
    const r = levelUpReward(content, lv);
    assert.ok(Number.isSafeInteger(r.coins) && r.coins >= 0);
  }
  let prev = content.floorList.at(-1)!;
  for (let n = content.floorList.length + 1; n <= 1000; n++) {
    const f = content.floors.get(`${GEN_PREFIX}${n}`)!;
    assert.ok(Number.isSafeInteger(f.unlockCost) && f.unlockCost > prev.unlockCost, `tầng ${n}: ${f.unlockCost}`);
    assert.ok(Number.isSafeInteger(f.unlockLevel) && f.unlockLevel > prev.unlockLevel, `tầng ${n}: cấp ${f.unlockLevel}`);
    for (const c of [...f.expandCosts, ...f.stars.map((x) => x.coins)]) assert.ok(Number.isSafeInteger(c));
    prev = f;
  }
  const s = newGame(content);
  let cost = 0;
  for (const tier of [0, 10, 100, 1000, 10_000]) {
    s.upgrades.storage = tier;
    const c = storageUpgradeCost(content, s);
    assert.ok(Number.isSafeInteger(c) && c > cost, `Rương bậc ${tier}: ${c}`);
    cost = c;
  }
});

test('trần chỉ số: cộng mọi nguồn cũng không vượt config.bonusCaps', () => {
  const pumped = structuredClone(content.config);
  pumped.floorStarBonus = { speed: 5, yield: 5, xp: 5, luck: 5, attract: 5, care: 5 };
  const c2 = { ...content, config: pumped };
  const s = newGame(c2, { level: 50 });
  s.floors[0]!.stars = 3;
  const slot = s.floors[0]!.slots[0]!;
  const crop = content.crops.get(DAISY)!;
  for (const stat of ['speed', 'yield', 'xp', 'luck', 'attract', 'care'] as const) {
    assert.equal(slotBonus(c2, s, slot, crop, stat), content.config.bonusCaps![stat], stat);
  }
});
