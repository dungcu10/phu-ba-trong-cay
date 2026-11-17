// Chỉ thị 10 § 3.1 (M5): Vườn Trăng Lơ Lửng grows 25% faster at night (device time), exactly and
// offline; Đom Đóm Sao twice as often there; floors ask Sợi Mây Kết and Giọt Sương Trời; old saves keep
// their generated floor 4 as Vườn Trăng with every pot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { cropStatus, isNight, nightMs } from '../src/systems/growth.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { giveFloorItems, HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const MOON = 'base:floor.moon-garden';
const GERBERA = 'base:crop.golden-gerbera';

function moonGarden(entropy = 3) {
  const s = newGame(content, { level: 20, coins: 1e9 }, entropy);
  for (const f of content.floorList.slice(1)) {
    giveFloorItems(content, s, f.id);
    assert.ok(dispatch(content, s, { type: 'unlockFloor', floorId: f.id }, T0).ok, f.id);
  }
  assert.equal(s.floors[3]!.floorId, MOON);
  return s;
}

test('nightMs: đúng số giờ đêm trong một ngày (19h → 6h giờ địa phương)', () => {
  const day = 24 * HOUR;
  assert.equal(nightMs(content, T0, T0 + day), 11 * HOUR);
  assert.equal(nightMs(content, T0, T0 + 7 * day), 77 * HOUR);
});

test('Vườn Trăng: cây trồng ban đêm chín sớm hơn 25% so với cùng cây ở tầng 1, giờ chín tính chính xác', () => {
  let start = T0;
  while (!(isNight(content, start) && isNight(content, start + 2 * HOUR))) start += 10 * MIN;
  const s = moonGarden();
  assert.ok(dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 0, slot: 0 }, start).ok);
  assert.ok(dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 3, slot: 0 }, start).ok);
  const ground = cropStatus(content, s, s.floors[0]!.slots[0]!, start)!;
  const moon = cropStatus(content, s, s.floors[3]!.slots[0]!, start)!;
  assert.equal(ground.cycleMs, moon.cycleMs, 'cùng chậu đất nung, cùng chu kỳ');
  // All night: 1.25× growth, so ready at cycle / 1.25.
  assert.ok(Math.abs(moon.remainingMs - ground.remainingMs / 1.25) <= 1, `${moon.remainingMs} vs ${ground.remainingMs / 1.25}`);
  const ready = moon.readyAt;
  assert.equal(cropStatus(content, s, s.floors[3]!.slots[0]!, ready - 1)!.ripe, false);
  assert.equal(cropStatus(content, s, s.floors[3]!.slots[0]!, ready)!.ripe, true);
});

test('Vườn Trăng ban ngày: lớn như tầng thường', () => {
  let start = T0;
  while (isNight(content, start) || isNight(content, start + 3 * HOUR)) start += 10 * MIN;
  const s = moonGarden(4);
  dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 0, slot: 0 }, start);
  dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 3, slot: 0 }, start);
  assert.equal(cropStatus(content, s, s.floors[3]!.slots[0]!, start)!.remainingMs, cropStatus(content, s, s.floors[0]!.slots[0]!, start)!.remainingMs);
});

test('Vườn Trăng: Đom Đóm Sao nhiều hơn tầng 1 (×2 trọng số)', () => {
  let night = T0;
  while (!(isNight(content, night) && isNight(content, night + 3 * HOUR))) night += 10 * MIN;
  let moon = 0;
  let ground = 0;
  for (let e = 0; e < 40; e++) {
    const s = moonGarden(100 + e);
    for (let i = 0; i < 6; i++) {
      dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 0, slot: i }, night);
      dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 3, slot: i }, night);
    }
    const at = night + 2 * HOUR;
    for (let i = 0; i < 6; i++) {
      if (cropStatus(content, s, s.floors[0]!.slots[i]!, at)?.bug?.bug.id === 'base:bug.star-firefly') ground++;
      if (cropStatus(content, s, s.floors[3]!.slots[i]!, at)?.bug?.bug.id === 'base:bug.star-firefly') moon++;
    }
  }
  assert.ok(moon > ground, `Vườn Trăng ${moon}, tầng 1 ${ground}`);
});

test('mở tầng 2–4 cần Sợi Mây Kết + Giọt Sương Trời, trừ đúng số', () => {
  const s = newGame(content, { level: 20, coins: 1e9 });
  const tea = content.floorList[1]!;
  assert.deepEqual(dispatch(content, s, { type: 'unlockFloor', floorId: tea.id }, T0), { ok: false, error: 'not_enough_items' });
  s.inventory['base:mat.cloud-thread'] = 5;
  s.inventory['base:mat.sky-dew'] = 2;
  assert.ok(dispatch(content, s, { type: 'unlockFloor', floorId: tea.id }, T0).ok);
  assert.equal(s.inventory['base:mat.cloud-thread'], 2);
  assert.equal(s.inventory['base:mat.sky-dew'] ?? 0, 0);
});

test('save cũ đã mở "tầng 4 sinh tự động": thành Vườn Trăng, giữ nguyên chậu và cây, giữ số ô đã mở rộng', () => {
  const s = moonGarden(9);
  // Make it look like a save from before: floor 4 was base:floor.gen-4 with 10 slots and a plant.
  const f4 = s.floors[3]!;
  f4.floorId = 'base:floor.gen-4';
  while (f4.slots.length < 10) {
    const id = `pot-f4-${f4.slots.length + 1}`;
    s.pots[id] = { potId: 'base:pot.terracotta', level: 1 };
    f4.slots.push({ potInstanceId: id, planting: null });
  }
  dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 3, slot: 9 }, T0);
  const pots = f4.slots.map((x) => x.potInstanceId);
  const r = reconcile(JSON.parse(JSON.stringify(s)), content, 'local');
  const g = r.state.floors[3]!;
  assert.equal(g.floorId, MOON);
  assert.deepEqual(g.slots.map((x) => x.potInstanceId), pots);
  assert.equal(g.slots[9]!.planting?.cropId, GERBERA);
});
