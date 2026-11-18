// Chỉ thị 11 TỔNG § D + § I: houses (upgrade with other systems' materials, offline timer, usable while
// upgrading, build slots), house effects, Cấp Làng, Huy Chương Độ Cao, 7-day check-in, migration 12 → 13.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { SAVE_VERSION } from '../src/core/state.ts';
import { migrate, MIGRATIONS } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { houseBonus, houseLevel, nextHouseCost, villageLevel, villagePerk } from '../src/systems/village.ts';
import { energyMax } from '../src/systems/sea.ts';
import { HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const v = content.village!;
const MIN = 60_000;

function rich(level = 20) {
  const s = newGame(content, { level, coins: 1e7, gems: 1000 });
  for (const h of v.houses) for (const c of h.costs) for (const [id, q] of Object.entries(c.items)) s.inventory[id] = (s.inventory[id] ?? 0) + q * 3;
  return s;
}

test('nguyên liệu nâng nhà lấy từ hệ khác (§ D2): không nhà nào chỉ tốn xu', () => {
  const kind = (id: string) => content.items.get(id)!.kind;
  for (const h of v.houses) {
    for (const c of h.costs) assert.ok(Object.keys(c.items).length > 0, h.id);
    const kinds = new Set(h.costs.flatMap((c) => Object.keys(c.items).map(kind)));
    if (h.id === 'birds' || h.id === 'workshop') assert.ok(kinds.has('bug'), `${h.id} cần sâu bọ`);
    if (h.id === 'gate') assert.ok(kinds.has('fish'), 'Cổng cần cá');
    if (h.id === 'balloon' || h.id === 'market') assert.ok(kinds.has('good'), `${h.id} cần hàng chế biến`);
  }
});

test('nâng nhà: tốn đúng giá, chạy khi tắt game, nhà vẫn dùng được, 1 ô nâng cấp', () => {
  const s = rich();
  const cost = nextHouseCost(content, s, 'balloon')!;
  const coins = s.player.coins;
  const r = dispatch(content, s, { type: 'upgradeHouse', house: 'balloon' }, T0);
  assert.ok(r.ok);
  assert.equal(coins - s.player.coins, cost.coins);
  assert.equal(houseLevel(s, 'balloon'), 1);
  assert.deepEqual(dispatch(content, s, { type: 'upgradeHouse', house: 'balloon' }, T0), { ok: false, error: 'busy' });
  assert.deepEqual(dispatch(content, s, { type: 'upgradeHouse', house: 'kiln' }, T0), { ok: false, error: 'no_build_slot' });
  // the house still works while upgrading: orders keep coming
  assert.ok(updateWorld(content, s, T0 + 2 * MIN) !== undefined && s.orders.slots.length > 0);
  const ev = updateWorld(content, s, T0 + cost.ms + MIN);
  assert.ok(ev.some((e) => e.type === 'houseUpgraded' && e.house === 'balloon' && e.level === 2));
  assert.equal(houseLevel(s, 'balloon'), 2);
  assert.ok(dispatch(content, s, { type: 'upgradeHouse', house: 'kiln' }, T0 + cost.ms + MIN).ok);
  assert.deepEqual(dispatch(content, newGame(content, { level: v.upgradeFromLevel - 1, coins: 1e7 }), { type: 'upgradeHouse', house: 'hall' }, T0), { ok: false, error: 'locked' });
});

test('hiệu ứng nhà: ô đơn, sức gió, ô hàng chờ, giảm giá chậu', () => {
  const s = rich();
  const e0 = energyMax(content, s);
  s.buildings.gate = { level: 3, upgradeEndsAt: null };
  s.buildings.balloon = { level: 4, upgradeEndsAt: null };
  assert.equal(energyMax(content, s), e0 + 2 * (v.houses.find((h) => h.id === 'gate')!.effects.energyMax ?? 0));
  assert.equal(houseBonus(content, s, 'balloon', 'orderSlots'), 3);
  updateWorld(content, s, T0 + 6 * HOUR);
  assert.ok(s.orders.slots.length >= 3);
  const n = newGame(content, { level: 1 });
  n.buildings.gate = { level: 5, upgradeEndsAt: null };
  assert.equal(houseBonus(content, n, 'gate', 'energyMax'), 0, 'nhà chưa mở thì không có hiệu ứng');
});

test('Cấp Làng = tổng cấp nhà; mốc 10 rút thời gian, 15 mở ô thứ 2', () => {
  const s = rich(30);
  assert.equal(villageLevel(content, s), v.houses.length);
  const one = rich(30);
  one.buildings.hall = { level: 2, upgradeEndsAt: null };
  const plain = nextHouseCost(content, one, 'hall')!.ms;
  for (const h of v.houses) s.buildings[h.id] = { level: 2, upgradeEndsAt: null };
  assert.equal(villageLevel(content, s), 16);
  assert.equal(nextHouseCost(content, s, 'hall')!.ms, Math.round(plain * (1 + villagePerk(content, s, 'upgradeTime'))));
  assert.ok(villagePerk(content, s, 'upgradeTime') < 0);
  assert.ok(dispatch(content, s, { type: 'upgradeHouse', house: 'hall' }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'upgradeHouse', house: 'kiln' }, T0).ok, 'Cấp Làng 15: ô nâng thứ 2');
});

test('Huy Chương Độ Cao: mở tầng 5 lần đầu thì có huy chương và thưởng, không nhận 2 lần', () => {
  const s = rich(40);
  while (s.floors.length < 5) s.floors.push(structuredClone(s.floors[0]!));
  const gems = s.player.gems;
  const ev = updateWorld(content, s, T0);
  assert.ok(ev.some((e) => e.type === 'medalAwarded' && e.floor === 5));
  assert.equal(s.player.gems, gems + v.medals[0]!.gems!);
  assert.equal(updateWorld(content, s, T0 + MIN).filter((e) => e.type === 'medalAwarded').length, 0);
});

test('điểm danh 7 ngày: mỗi ngày 1 lần, nghỉ một ngày không mất chuỗi', () => {
  const s = newGame(content, { level: 1 });
  const r1 = dispatch(content, s, { type: 'claimCheckIn' }, T0);
  assert.ok(r1.ok && r1.events.some((e) => e.type === 'checkedIn' && e.day === 1));
  assert.deepEqual(dispatch(content, s, { type: 'claimCheckIn' }, T0 + 10 * MIN), { ok: false, error: 'already_claimed' });
  const r2 = dispatch(content, s, { type: 'claimCheckIn' }, T0 + 3 * 24 * HOUR);
  assert.ok(r2.ok && r2.events.some((e) => e.type === 'checkedIn' && e.day === 2));
});

test('migration 12 → 13: thêm làng, giữ nguyên phần còn lại; reconcile làm sạch', () => {
  const s = newGame(content, { level: 9 });
  const raw = structuredClone(s) as unknown as Record<string, unknown>;
  delete raw.buildings;
  delete raw.village;
  raw.saveVersion = 12;
  const out = migrate(raw, 12, MIGRATIONS, 13) as Record<string, unknown>;
  assert.ok(SAVE_VERSION >= 13);
  assert.deepEqual(out.buildings, {});
  assert.deepEqual(out.village, { seenZones: [], medals: [], checkIn: { day: -1, count: 0 } });
  const dirty = structuredClone(s);
  (dirty.buildings as Record<string, unknown>) = { hall: { level: 9, upgradeEndsAt: 'x' }, nope: { level: 2, upgradeEndsAt: null } };
  (dirty.village as unknown) = { seenZones: [1, 1, -2], medals: 'x' };
  const fixed = reconcile(dirty, content, 'local').state;
  assert.deepEqual(fixed.buildings, { hall: { level: 5, upgradeEndsAt: null } });
  assert.deepEqual(fixed.village, { seenZones: [1], medals: [], checkIn: { day: -1, count: 0 } });
});
