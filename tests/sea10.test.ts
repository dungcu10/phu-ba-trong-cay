// Chỉ thị 10 § 3.7: Biển Mây Bí Ẩn — map from seed, energy refills offline-exact, 2×2 chests, clear reward.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { chestBlock, ensureSeaMap, seaCells, settleEnergy } from '../src/systems/sea.ts';
import { localDay } from '../src/systems/missions.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const r = content.sea!;
const MIN = 60_000;
const N = r.cols * r.rows;

function player(entropy = 1) {
  const s = newGame(content, { level: 20 }, entropy);
  s.energy = { value: r.energy.max, at: T0, dailyDay: -1 };
  return s;
}
const blow = (s: ReturnType<typeof player>, cell: number, at = T0) => dispatch(content, s, { type: 'blowCloud', cell }, at);

test('bản đồ tất định theo seed; rương 2×2 không chồng nhau, số rương đúng khoảng', () => {
  for (let e = 1; e < 40; e++) {
    const a = player(e);
    const b = player(e);
    ensureSeaMap(content, a, T0);
    ensureSeaMap(content, b, T0);
    const cells = seaCells(content, a);
    assert.deepEqual(cells, seaCells(content, b));
    assert.equal(cells.length, N);
    const anchors = [...new Set(cells.filter((c) => c.kind === 'chest').map((c) => c.chest!))];
    assert.ok(anchors.length >= r.chests[0] && anchors.length <= r.chests[1], `${anchors.length}`);
    for (const at of anchors) for (const i of chestBlock(content, at)) assert.equal(cells[i]!.chest, at);
    assert.ok(anchors.every((at) => at % r.cols < r.cols - 1));
  }
});

test('mỗi lần thổi tốn 1 Năng Lượng Gió; ô có món thì vào túi', () => {
  const s = player(3);
  ensureSeaMap(content, s, T0);
  const cells = seaCells(content, s);
  const i = cells.findIndex((c) => c.kind === 'item');
  const c = cells[i]!;
  const have = s.inventory[c.itemId!] ?? 0;
  const res = blow(s, i);
  assert.ok(res.ok);
  assert.equal(s.energy.value, r.energy.max - 1 + r.energy.daily);
  assert.equal(s.inventory[c.itemId!], have + c.qty!);
  assert.deepEqual(blow(s, i), { ok: false, error: 'already_open' });
  assert.deepEqual(blow(s, N), { ok: false, error: 'bad_cell' });
  s.energy.value = 0;
  s.energy.at = T0;
  assert.deepEqual(blow(s, (i + 1) % N), { ok: false, error: 'no_energy' });
  const low = newGame(content, { level: r.unlockLevel - 1 });
  assert.deepEqual(dispatch(content, low, { type: 'blowCloud', cell: 0 }, T0), { ok: false, error: 'locked' });
});

test('Năng Lượng Gió hồi 1 điểm / regenMinutes khi tắt game, tính từng bước hay một lần đều như nhau; quà ngày +10 tới 40', () => {
  const a = player(5);
  a.energy = { value: 5, at: T0, dailyDay: localDay(content, T0) };
  const b = structuredClone(a);
  const step = r.energy.regenMinutes; // sea.json (CTO tunes it)
  settleEnergy(content, a, T0 + (10 * step + 1) * MIN);
  for (let t = 1; t <= 10 * step + 1; t++) settleEnergy(content, b, T0 + t * MIN);
  assert.equal(a.energy.value, 5 + 10);
  assert.deepEqual(a.energy, b.energy);
  settleEnergy(content, a, T0 + 100 * step * MIN);
  // Regen stops at the max; a new day's gift may sit on top of it up to the cap.
  assert.ok(a.energy.value >= r.energy.max && a.energy.value <= r.energy.cap, `${a.energy.value}`);
  // A new local day adds the gift, above the max up to the cap.
  const c = player(6);
  updateWorld(content, c, T0);
  assert.equal(c.energy.value, Math.min(r.energy.cap, r.energy.max + r.energy.daily));
  updateWorld(content, c, T0 + 5 * MIN);
  assert.equal(c.energy.value, Math.min(r.energy.cap, r.energy.max + r.energy.daily));
});

test('rương chỉ mở khi đủ 4 ô 2×2 đã tan', () => {
  const s = player(8);
  ensureSeaMap(content, s, T0);
  const cells = seaCells(content, s);
  const at = cells.find((c) => c.kind === 'chest')!.chest!;
  const block = chestBlock(content, at);
  for (const i of block.slice(0, 3)) {
    const res = blow(s, i);
    assert.ok(res.ok && res.events.every((e) => e.type !== 'cloudBlown' || e.chest === undefined));
  }
  s.energy.value = 10;
  const res = blow(s, block[3]!);
  const ev = res.ok ? res.events.find((e) => e.type === 'cloudBlown') : undefined;
  assert.ok(ev && ev.type === 'cloudBlown' && ev.chest === at && ev.finds.length > 0);
  assert.deepEqual(s.seaMap.chests, [at]);
});

test('dọn hết bản đồ: có thưởng lớn và bản đồ mới', () => {
  const s = player(9);
  ensureSeaMap(content, s, T0);
  const first = seaCells(content, s);
  const raw = s.inventory['base:mat.raw-jade'] ?? 0;
  let last;
  for (let i = 0; i < N; i++) {
    s.energy.value = 10;
    last = blow(s, i);
    assert.ok(last.ok, `cell ${i}`);
  }
  const ev = last!.ok ? last!.events.find((e) => e.type === 'cloudBlown') : undefined;
  assert.ok(ev && ev.type === 'cloudBlown' && ev.cleared);
  assert.ok((s.inventory['base:mat.raw-jade'] ?? 0) >= raw + (r.clear.items['base:mat.raw-jade'] ?? 0));
  assert.equal(s.seaMap.index, 1);
  assert.deepEqual(s.seaMap.open, []);
  assert.notDeepEqual(seaCells(content, s), first);
});

test('bọ hiếm tìm được ghi vào Sổ Sâu Bọ', () => {
  for (let e = 1; e < 200; e++) {
    const s = player(e);
    ensureSeaMap(content, s, T0);
    const i = seaCells(content, s).findIndex((c) => c.kind === 'item' && content.items.get(c.itemId!)?.kind === 'bug');
    if (i < 0) continue;
    const id = seaCells(content, s)[i]!.itemId!;
    assert.ok(blow(s, i).ok);
    assert.ok(s.collections.bugs[id]!.count >= 1);
    return;
  }
  assert.fail('không thấy bọ trên 200 bản đồ');
});
