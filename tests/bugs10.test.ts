// Chỉ thị 10 · M3: 8 kinds of bug. Count rule unchanged, kind picked by weight, deterministic;
// Đom Đóm Sao only at night; plantings from before the update only attract Bọ Rùa Mây; Sổ Sâu Bọ.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { arrivals, bugsInCycle, isNight } from '../src/systems/growth.ts';
import { loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const HOUR = 60 * MIN;
const FIREFLY = 'base:bug.star-firefly';
const LADYBIRD = 'base:bug.ladybird';

function kindsFor(level: number, start: number, cropId: string, seeds: number) {
  const seen = new Map<string, number>();
  for (let e = 0; e < seeds; e++) {
    const s = newGame(content, { level, coins: 99999 }, e);
    assert.ok(dispatch(content, s, { type: 'plant', cropId, floor: 0, slot: 0 }, start).ok);
    const p = s.floors[0]!.slots[0]!.planting!;
    for (const b of arrivals(content, s, content.crops.get(cropId)!, p, 1, 0)) seen.set(b.id, (seen.get(b.id) ?? 0) + 1);
  }
  return seen;
}

test('số bọ mỗi vụ giữ nguyên quy tắc cũ (Bọ Rùa), chỉ thêm loại', () => {
  const s = newGame(content, { level: 20, coins: 99999 }, 3);
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 0, slot: 0 }, T0);
  const p = s.floors[0]!.slots[0]!.planting!;
  const crop = content.crops.get('base:crop.sky-carrot')!;
  assert.equal(arrivals(content, s, crop, p, 1, 0).length, bugsInCycle(s, content.bugList[0]!, crop, p));
});

test('chọn loại bọ tất định: cùng save, cùng vụ thì cùng kết quả', () => {
  const a = kindsFor(20, T0, 'base:crop.golden-gerbera', 30);
  const b = kindsFor(20, T0, 'base:crop.golden-gerbera', 30);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.ok(a.size >= 3, `chỉ thấy ${a.size} loại bọ`);
});

test('Đom Đóm Sao không xuất hiện ban ngày, có xuất hiện ban đêm', () => {
  // Pick a planting start so the whole cycle is in the day, and one in the night (local UTC+7).
  let day = T0;
  while (!(!isNight(content, day) && !isNight(content, day + 3 * HOUR))) day += HOUR;
  let night = T0;
  while (!(isNight(content, night) && isNight(content, night + 3 * HOUR))) night += HOUR;
  const d = kindsFor(20, day, 'base:crop.sky-carrot', 60);
  const n = kindsFor(20, night, 'base:crop.sky-carrot', 60);
  assert.equal(d.get(FIREFLY) ?? 0, 0, 'ban ngày có Đom Đóm Sao');
  assert.ok((n.get(FIREFLY) ?? 0) > 0, 'ban đêm không có Đom Đóm Sao');
});

test('bọ chưa tới cấp mở thì không xuất hiện', () => {
  const low = kindsFor(1, T0, 'base:crop.cotton-daisy', 60);
  for (const id of low.keys()) assert.ok(content.bugs.get(id)!.unlockLevel <= 1, `${id} xuất hiện ở cấp 1`);
});

test('cây trồng từ save cũ (không có bugLevel) chỉ ra Bọ Rùa', () => {
  const s = newGame(content, { level: 20, coins: 99999 }, 5);
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.golden-gerbera', floor: 0, slot: 0 }, T0);
  const p = s.floors[0]!.slots[0]!.planting!;
  delete p.bugLevel;
  for (const b of arrivals(content, s, content.crops.get('base:crop.golden-gerbera')!, p, 1, 0)) assert.equal(b.id, LADYBIRD);
});

test('Sổ Sâu Bọ: lần đầu bắt một loại có sự kiện "Bọ mới!", lần sau không', () => {
  const s = newGame(content, { level: 20, coins: 99999 }, 7);
  const at = { floor: 0, slot: 0 };
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.golden-gerbera', ...at }, T0);
  const seen = new Set<string>();
  for (let t = T0; t < T0 + 3 * HOUR; t += MIN) {
    const r = dispatch(content, s, { type: 'catchBug', ...at }, t);
    if (!r.ok) continue;
    const ev = r.events.find((e) => e.type === 'bugCaught') as { itemId: string };
    const isNew = r.events.some((e) => e.type === 'newBug');
    assert.equal(isNew, !seen.has(ev.itemId));
    seen.add(ev.itemId);
  }
  assert.ok(seen.size >= 1);
  for (const id of seen) assert.ok(s.collections.bugs[id]!.count >= 1);
});
