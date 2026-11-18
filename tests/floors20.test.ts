// Chỉ thị 11 TỔNG § C2: 20 tầng — tầng 5–20 sinh từ floorGen với 16 tên theo vùng trời (không trùng
// tầng 1–4), cấp mở 16, 19, 22 … 64; vùng trời theo tầng.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorAtIndex } from '../src/core/floorgen.ts';
import { zoneOf, FLOORS_PER_ZONE } from '../src/render/zones.ts';
import { loadBase } from './helpers.ts';

const content = await loadBase();

test('20 tầng: tên tầng 5–20 khác nhau, không trùng tầng 1–4; cấp mở theo bước 3 tới tầng 20 ở cấp 64', () => {
  const list = Array.from({ length: 20 }, (_, i) => floorAtIndex(content.floors, content.floorList, i));
  const names = list.map((f) => f.name.vi);
  assert.equal(new Set(names).size, 20);
  assert.equal(list[3]!.unlockLevel, 16);
  for (let i = 4; i < 20; i++) assert.equal(list[i]!.unlockLevel, 19 + 3 * (i - 4));
  assert.equal(list[19]!.unlockLevel, 64);
});

test('vùng trời: tầng 1–5 trời thấp, 6–10 vàng, 11–15 hoàng hôn, 16 trở lên đêm', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 19, 30].map(zoneOf), [0, 0, 1, 1, 2, 2, 3, 3, 3]);
  assert.equal(FLOORS_PER_ZONE, 5);
});
