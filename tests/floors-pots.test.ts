// Multi-floor garden and pots with bonuses (owner decision 2026-11-16, part 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandPotLevels } from '../src/core/content.ts';
import { dispatch, nextFloor } from '../src/core/game.ts';
import { SAVE_VERSION } from '../src/core/state.ts';
import { bugsInCycle, cropStatus } from '../src/systems/growth.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { DAISY, loadBase, MIN, MINT, newGame, T0, TOMATO } from './helpers.ts';

const content = await loadBase();
const TEA = 'base:floor.tea-mist';
const GOLDEN = 'base:floor.golden-terrace';
const PORCELAIN = 'base:pot.porcelain';
const at = (floor: number, slot: number) => ({ floor, slot });

test('mở tầng: đúng thứ tự, cần đủ cấp và xu, tạo 10 vị trí có chậu, không mở hai lần', () => {
  const s = newGame(content, { level: 4, coins: 100_000 });
  assert.equal(nextFloor(content, s)?.id, TEA);
  assert.deepEqual(dispatch(content, s, { type: 'unlockFloor', floorId: GOLDEN }, T0), { ok: false, error: 'not_next_floor' });
  assert.deepEqual(dispatch(content, s, { type: 'unlockFloor', floorId: TEA }, T0), { ok: false, error: 'locked' });
  s.player.level = 5;
  s.player.coins = 1999;
  assert.deepEqual(dispatch(content, s, { type: 'unlockFloor', floorId: TEA }, T0), { ok: false, error: 'not_enough_coins' });
  s.player.coins = 2000;
  const r = dispatch(content, s, { type: 'unlockFloor', floorId: TEA }, T0);
  assert.ok(r.ok && r.events[0]!.type === 'floorUnlocked');
  assert.equal(s.player.coins, 0);
  assert.equal(s.floors.length, 2);
  assert.equal(s.floors[1]!.slots.length, 10);
  for (const sl of s.floors[1]!.slots) assert.ok(s.pots[sl.potInstanceId]);
  assert.equal(new Set(s.floors.flatMap((f) => f.slots.map((x) => x.potInstanceId))).size, 20, 'mã chậu không trùng');
  assert.deepEqual(dispatch(content, s, { type: 'unlockFloor', floorId: TEA }, T0), { ok: false, error: 'not_next_floor' });
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(1, 9) }, T0).ok);
});

test('mua chậu: theo giá và cấp; đặt chậu: chậu cũ về kho, chậu đang có cây thì không đổi', () => {
  const s = newGame(content, { level: 3, coins: 1000 });
  assert.deepEqual(dispatch(content, s, { type: 'buyPot', potId: PORCELAIN }, T0), { ok: false, error: 'locked' });
  s.player.level = 4;
  const r = dispatch(content, s, { type: 'buyPot', potId: PORCELAIN }, T0);
  assert.ok(r.ok);
  assert.equal(s.player.coins, 1000 - content.pots.get(PORCELAIN)!.price!);
  const id = s.potStock[0]!;
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 0) }, T0).ok);
  assert.deepEqual(dispatch(content, s, { type: 'placePot', potInstanceId: id, ...at(0, 0) }, T0), { ok: false, error: 'slot_busy' });
  const old = s.floors[0]!.slots[1]!.potInstanceId;
  assert.ok(dispatch(content, s, { type: 'placePot', potInstanceId: id, ...at(0, 1) }, T0).ok);
  assert.equal(s.floors[0]!.slots[1]!.potInstanceId, id);
  assert.deepEqual(s.potStock, [old]);
  assert.deepEqual(dispatch(content, s, { type: 'placePot', potInstanceId: id, ...at(0, 2) }, T0), { ok: false, error: 'not_in_stock' });
});

test('hệ ưa thích: Chậu Sứ (ưa Hoa) giúp Cúc lớn nhanh hơn Cà Chua cùng chậu', () => {
  const s = newGame(content, { level: 4, coins: 1000 });
  dispatch(content, s, { type: 'buyPot', potId: PORCELAIN }, T0);
  dispatch(content, s, { type: 'placePot', potInstanceId: s.potStock[0]!, ...at(0, 0) }, T0);
  const slot = s.floors[0]!.slots[0]!;
  const daisy = slotBonus(content, s, slot, content.crops.get(DAISY)!, 'speed');
  const tomato = slotBonus(content, s, slot, content.crops.get(TOMATO)!, 'speed');
  assert.ok(Math.abs(daisy - tomato * (1 + content.config.potAffinityBonus)) < 1e-9);
  assert.ok(daisy > tomato);
});

test('đặc tính tầng: Vườn Trà làm Bạc Hà (Rau Thảo) lớn nhanh hơn 10%, không ảnh hưởng Cúc', () => {
  const s = newGame(content, { level: 5, coins: 5000 });
  dispatch(content, s, { type: 'unlockFloor', floorId: TEA }, T0);
  dispatch(content, s, { type: 'plant', cropId: MINT, ...at(0, 0) }, T0);
  dispatch(content, s, { type: 'plant', cropId: MINT, ...at(1, 0) }, T0);
  const ground = cropStatus(content, s, s.floors[0]!.slots[0]!, T0)!.cycleMs;
  const tea = cropStatus(content, s, s.floors[1]!.slots[0]!, T0)!.cycleMs;
  assert.ok(tea < ground);
  assert.equal(slotBonus(content, s, s.floors[1]!.slots[0]!, content.crops.get(DAISY)!, 'speed'), slotBonus(content, s, s.floors[0]!.slots[0]!, content.crops.get(DAISY)!, 'speed'));
});

test('chậu tăng XP và thu hút bọ có tác dụng thật khi thu hoạch', () => {
  const s = newGame(content, { level: 4, coins: 1000 });
  dispatch(content, s, { type: 'buyPot', potId: PORCELAIN }, T0);
  s.pots[s.potStock[0]!]!.level = 8;
  dispatch(content, s, { type: 'placePot', potInstanceId: s.potStock[0]!, ...at(0, 0) }, T0);
  let xpBonus = 0;
  let xpPlain = 0;
  for (let k = 0; k < 40; k++) {
    const t = T0 + k * 2 * MIN;
    for (const i of [0, 1]) dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, i) }, t);
    const t2 = t + 2 * MIN - 1;
    for (const i of [0, 1]) {
      const r = dispatch(content, s, { type: 'harvest', ...at(0, i) }, t2);
      const e = r.ok ? r.events.find((x) => x.type === 'harvested') : undefined;
      if (e && e.type === 'harvested') (i === 0 ? (xpBonus += e.xp) : (xpPlain += e.xp));
    }
  }
  assert.ok(xpBonus > xpPlain * 1.1, `XP chậu sứ ${xpBonus} so với thường ${xpPlain}`);
  const bug = content.bugList[0]!;
  const crop = content.crops.get('base:crop.cloud-mint')!; // 0,5 bọ/vụ: chưa chạm trần maxPerCycle
  const planting = { id: 1, cropId: crop.id, seedCost: 0, cycleStartedAt: T0, harvestsDone: 0, bonusMs: 0, wateredStages: [], caughtBugs: {} };
  let plain = 0;
  let attracted = 0;
  for (let seed = 1; seed <= 300; seed++) {
    plain += bugsInCycle({ ...s, seed }, bug, crop, planting, 0);
    attracted += bugsInCycle({ ...s, seed }, bug, crop, planting, 0.5);
  }
  assert.ok(attracted > plain * 1.2, `bọ có thu hút ${attracted} so với ${plain}`);
});

test('quy tắc cấp chậu: đúng số cấp, chỉ số tăng 8% giá trị gốc mỗi cấp, giá nâng cấp tăng dần', () => {
  const levels = expandPotLevels({ maxLevel: 8, base: { speed: 0.06 }, perLevel: 0.08, coins: { base: 120, growth: 1.55 }, items: { x: { base: 3, growth: 1.35 } } });
  assert.equal(levels.length, 8);
  assert.equal(levels[0]!.upgradeCost, null);
  assert.ok(Math.abs(levels[7]!.stats.speed! - 0.06 * 1.56) < 1e-3);
  for (let i = 2; i < 8; i++) assert.ok(levels[i]!.upgradeCost!.coins > levels[i - 1]!.upgradeCost!.coins);
});

test('save cũ (bản 4) lên bản 5 có kho chậu; tầng được thêm vị trí khi nội dung tăng số chậu', () => {
  const s = newGame(content);
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>;
  delete raw.potStock;
  raw.floors[0].slots = raw.floors[0].slots.slice(0, 4);
  const migrated = migrate(raw, 4) as Record<string, any>;
  assert.equal(migrated.saveVersion, SAVE_VERSION);
  assert.deepEqual(migrated.potStock, []);
  const { state, warnings } = reconcile(migrated as any, content, 'local');
  assert.equal(state.floors[0]!.slots.length, 10);
  assert.equal(new Set(state.floors[0]!.slots.map((x) => x.potInstanceId)).size, 10);
  assert.ok(warnings.some((w) => w.includes('vị trí chậu mới')));
});
