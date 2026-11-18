// REDESIGN_V2: floor expansion and stars, pot sets, daily missions, helping in neighbours' gardens,
// and the 6 -> 7 save migration.

import { helpsLeftToday } from '../src/systems/social.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { SAVE_VERSION } from '../src/core/state.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { expandCost, floorSets, potTier } from '../src/systems/floors.ts';
import { localDay, missionDef } from '../src/systems/missions.ts';
import { botGarden, helpsLeft } from '../src/systems/visit.ts';
import { migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { DAISY, HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const at = (floor: number, slot: number) => ({ floor, slot });
const DAY = 24 * HOUR;

test('mở rộng tầng: từng ô theo giá, chậu mới gieo được, dừng ở 10 ô', () => {
  const s = newGame(content, { coins: 100_000 });
  const def = content.floors.get(s.floors[0]!.floorId)!;
  assert.equal(s.floors[0]!.slots.length, 6);
  let paid = 0;
  for (let i = 0; i < def.expandCosts.length; i++) {
    const price = expandCost(def, s.floors[0]!, content, s.player.level)!; // expandCosts[i] + the A3 level part
    const r = dispatch(content, s, { type: 'expandFloor', floor: 0 }, T0);
    assert.ok(r.ok && r.events[0]!.type === 'floorExpanded');
    paid += price;
  }
  assert.equal(s.floors[0]!.slots.length, 10);
  assert.equal(s.player.coins, 100_000 - paid);
  assert.deepEqual(dispatch(content, s, { type: 'expandFloor', floor: 0 }, T0), { ok: false, error: 'max_slots' });
  assert.equal(new Set(s.floors[0]!.slots.map((x) => x.potInstanceId)).size, 10, 'mã chậu không trùng');
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 9) }, T0).ok);
});

test('mở rộng tầng: thiếu xu thì không đổi gì', () => {
  const s = newGame(content, { coins: 10 });
  assert.deepEqual(dispatch(content, s, { type: 'expandFloor', floor: 0 }, T0), { ok: false, error: 'not_enough_coins' });
  assert.equal(s.floors[0]!.slots.length, 6);
  assert.equal(s.player.coins, 10);
});

test('sao tầng: cần cấp, xu và nông sản; mỗi sao làm cây trên tầng lớn nhanh hơn', () => {
  const s = newGame(content, { coins: 10_000, level: 2 });
  const star = content.floors.get(s.floors[0]!.floorId)!.stars[0]!;
  assert.deepEqual(dispatch(content, s, { type: 'upgradeFloorStar', floor: 0 }, T0), { ok: false, error: 'locked' });
  s.player.level = star.level;
  assert.deepEqual(dispatch(content, s, { type: 'upgradeFloorStar', floor: 0 }, T0), { ok: false, error: 'not_enough_items' });
  for (const [id, q] of Object.entries(star.items)) s.inventory[id] = q;
  const slot = s.floors[0]!.slots[0]!;
  const crop = content.crops.get(DAISY)!;
  const before = slotBonus(content, s, slot, crop, 'speed');
  assert.ok(dispatch(content, s, { type: 'upgradeFloorStar', floor: 0 }, T0).ok);
  assert.equal(s.floors[0]!.stars, 1);
  assert.equal(s.player.coins, 10_000 - star.coins);
  for (const id of Object.keys(star.items)) assert.equal(s.inventory[id] ?? 0, 0);
  assert.ok(Math.abs(slotBonus(content, s, slot, crop, 'speed') - before - content.config.floorStarBonus!.speed!) < 1e-9);
});

test('bộ chậu: chậu khởi đầu không có thưởng bộ; đủ 4 rồi 6 chậu cùng bộ thì thưởng tăng theo bậc', () => {
  const s = newGame(content, { coins: 100_000, level: 10 });
  assert.equal(floorSets(content, s, s.floors[0]!).length, 0);
  const crop = content.crops.get(DAISY)!;
  const slot5 = s.floors[0]!.slots[5]!;
  const base = slotBonus(content, s, slot5, crop, 'xp');
  // Porcelain and jade lotus are both "Gốm Sứ Cung Đình".
  const place = (i: number, potId: string) => {
    assert.ok(dispatch(content, s, { type: 'buyPot', potId }, T0).ok);
    assert.ok(dispatch(content, s, { type: 'placePot', potInstanceId: s.potStock.at(-1)!, ...at(0, i) }, T0).ok);
  };
  for (let i = 0; i < 4; i++) place(i, 'base:pot.porcelain');
  const sets = floorSets(content, s, s.floors[0]!);
  assert.equal(sets[0]!.count, 4);
  assert.equal(sets[0]!.tier, 0);
  const tier0 = content.potSets.get('base:set.palace-ceramic')!.tiers[0]!.stats.xp!;
  // Slot 5 still holds a terracotta pot but gets the floor-wide set bonus.
  assert.ok(Math.abs(slotBonus(content, s, slot5, crop, 'xp') - base - tier0) < 1e-9);
  place(4, 'base:pot.porcelain');
  place(5, 'base:pot.porcelain');
  assert.equal(floorSets(content, s, s.floors[0]!)[0]!.tier, 1);
});

test('bậc ngoại hình chậu theo cấp', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((l) => potTier(l, 5)), [0, 0, 1, 2, 2]);
  assert.equal(potTier(1, 1), 0);
});

test('nhiệm vụ ngày: 3 nhiệm vụ, đếm từ sự kiện, nhận thưởng một lần, đổi khi sang ngày mới', () => {
  const s = newGame(content, { coins: 1000 });
  assert.ok(dispatch(content, s, { type: 'tick' }, T0).ok);
  assert.equal(s.missions.list.length, content.missions.perDay);
  assert.equal(s.missions.day, localDay(content, T0));
  const plantIdx = s.missions.list.findIndex((m) => missionDef(content, m.id)!.kind === 'plant');
  // Force a known mission so the test does not depend on the roll.
  if (plantIdx < 0) s.missions.list[0] = { id: 'plant', progress: 0, claimed: false };
  const i = s.missions.list.findIndex((m) => m.id === 'plant');
  const def = missionDef(content, 'plant')!;
  assert.deepEqual(dispatch(content, s, { type: 'claimMission', index: i }, T0), { ok: false, error: 'not_complete' });
  let done = false;
  for (let k = 0; k < def.target; k++) {
    const slot = k % 6;
    if (s.floors[0]!.slots[slot]!.planting) assert.ok(dispatch(content, s, { type: 'harvest', ...at(0, slot) }, T0 + (k + 1) * 2 * MIN).ok);
    const r = dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, slot) }, T0 + (k + 1) * 2 * MIN);
    assert.ok(r.ok);
    if (r.events.some((e) => e.type === 'missionDone')) done = true;
  }
  assert.ok(done, 'có sự kiện hoàn thành');
  assert.equal(s.missions.list[i]!.progress, def.target);
  const r = dispatch(content, s, { type: 'claimMission', index: i }, T0 + HOUR);
  assert.ok(r.ok);
  assert.deepEqual(r.events[0], { type: 'missionClaimed', index: i, ...def.reward });
  assert.deepEqual(dispatch(content, s, { type: 'claimMission', index: i }, T0 + HOUR), { ok: false, error: 'already_claimed' });
  dispatch(content, s, { type: 'tick' }, T0 + DAY);
  assert.equal(s.missions.day, localDay(content, T0 + DAY));
  assert.ok(s.missions.list.every((m) => !m.claimed && m.progress === 0));
});

test('nhiệm vụ ngày: thưởng thêm chỉ khi nhận hết cả 3', () => {
  const s = newGame(content);
  dispatch(content, s, { type: 'tick' }, T0);
  assert.deepEqual(dispatch(content, s, { type: 'claimMissionBonus' }, T0), { ok: false, error: 'not_complete' });
  for (const m of s.missions.list) m.progress = missionDef(content, m.id)!.target;
  for (let i = 0; i < s.missions.list.length; i++) assert.ok(dispatch(content, s, { type: 'claimMission', index: i }, T0).ok);
  const gems = s.player.gems;
  assert.ok(dispatch(content, s, { type: 'claimMissionBonus' }, T0).ok);
  assert.equal(s.player.gems, gems + content.missions.allDone.gems);
  assert.deepEqual(dispatch(content, s, { type: 'claimMissionBonus' }, T0), { ok: false, error: 'already_claimed' });
});

test('thăm vườn hàng xóm: vườn ổn định khi đang xem, giúp đúng chậu cần giúp, giới hạn lượt giúp mỗi ngày (chỉ thị 12 B5: chung mọi vườn)', () => {
  const s = newGame(content);
  const botId = [...content.bots.keys()].sort((a, b) => s.neighbors[b]!.level - s.neighbors[a]!.level)[0]!;
  const g1 = botGarden(content, s, botId, T0);
  const g2 = botGarden(content, s, botId, T0);
  assert.deepEqual(JSON.stringify(g1), JSON.stringify(g2));
  assert.ok(g1.length >= 1 && g1[0]!.pots.length >= 6);
  // Find pots needing help across a few hours of the day.
  let t = T0;
  let needs: Array<{ floor: number; slot: number; kind: 'water' | 'bug' }> = [];
  for (; t < T0 + 12 * HOUR; t += 30 * MIN) {
    needs = botGarden(content, s, botId, t).flatMap((f, fi) => f.pots.flatMap((p, i) => (p.need ? [{ floor: fi, slot: i, kind: p.need }] : [])));
    if (needs.length >= 4) break;
  }
  assert.ok(needs.length >= 4, 'có đủ chậu cần giúp để kiểm tra');
  const healthy = botGarden(content, s, botId, t).flatMap((f, fi) => f.pots.flatMap((p, i) => (p.need ? [] : [{ floor: fi, slot: i }])))[0]!;
  assert.deepEqual(dispatch(content, s, { type: 'helpNeighbor', botId, ...healthy, kind: 'water' }, t), { ok: false, error: 'no_help_needed' });
  const coins = s.player.coins;
  for (let k = 0; k < 3; k++) {
    const n = needs[k]!;
    const r = dispatch(content, s, { type: 'helpNeighbor', botId, floor: n.floor, slot: n.slot, kind: n.kind }, t);
    assert.ok(r.ok, `giúp lần ${k + 1}: ${JSON.stringify(r)} ${JSON.stringify(n)}`);
    // The same pot no longer needs help.
    assert.equal(botGarden(content, s, botId, t)[n.floor]!.pots[n.slot]!.need, null);
  }
  assert.ok(s.player.coins > coins);
  // Chỉ thị 12 B5: the allowance is per day over all gardens.
  assert.equal(helpsLeftToday(content, s, t), content.neighbors.help.perDay! - 3);
  s.social.help.used = content.neighbors.help.perDay!;
  const n = needs[3]!;
  assert.deepEqual(dispatch(content, s, { type: 'helpNeighbor', botId, floor: n.floor, slot: n.slot, kind: n.kind }, t), { ok: false, error: 'help_limit' });
  assert.equal(helpsLeftToday(content, s, t + DAY), content.neighbors.help.perDay);
});

test('save bản 6 lên bản 7: giữ nguyên 10 ô cũ, sao = 0, nhiệm vụ và lượt giúp trống', () => {
  const s = newGame(content);
  // Shape of a version-6 save: 10 slots, no stars/missions/help.
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>;
  raw.saveVersion = 6;
  delete raw.missions;
  for (const f of raw.floors) delete f.stars;
  for (const b of Object.values(raw.neighbors) as any[]) delete b.help;
  for (let i = 6; i < 10; i++) {
    raw.pots[`pot-${i + 1}`] = { potId: 'base:pot.terracotta', level: 1 };
    raw.floors[0].slots.push({ potInstanceId: `pot-${i + 1}`, planting: null });
  }
  const migrated = migrate(raw, 6) as any;
  assert.equal(migrated.saveVersion, SAVE_VERSION);
  const { state } = reconcile(migrated, content, 'local');
  assert.equal(state.floors[0]!.slots.length, 10);
  assert.equal(state.floors[0]!.stars, 0);
  assert.deepEqual(state.missions, { day: -1, list: [], bonusClaimed: false });
  assert.ok(Object.values(state.neighbors).every((b) => b.help.day === -1 && b.help.pots.length === 0));
  assert.deepEqual(dispatch(content, state, { type: 'expandFloor', floor: 0 }, T0), { ok: false, error: 'max_slots' });
  assert.ok(dispatch(content, state, { type: 'plant', cropId: DAISY, ...at(0, 9) }, T0).ok);
  assert.ok(cropStatus(content, state, state.floors[0]!.slots[9]!, T0));
});
