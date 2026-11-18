// Chỉ thị 12 A4 (đơn: cây mới nặng hơn, Cúc giảm dần, khách quen) và A5 (lịch sự kiện xoay vòng).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrder } from '../src/systems/orders.ts';
import { activeEvents, eventPointsFor } from '../src/systems/events.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();

test('sự kiện xoay vòng: nối liền sau sự kiện cố định, mỗi cái 7–10 ngày, không lặp liền nhau, luôn có đúng 1 sự kiện', () => {
  const rot = content.events.filter((e) => e.id.startsWith('base:event.rot-'));
  assert.ok(rot.length >= 50);
  const fixedEnd = Math.max(...content.events.filter((e) => !e.id.startsWith('base:event.rot-')).map((e) => e.end));
  assert.equal(rot[0]!.start, fixedEnd);
  for (let i = 0; i < rot.length; i++) {
    const days = (rot[i]!.end - rot[i]!.start) / 86_400_000;
    assert.ok(days >= 7 && days <= 10, `${rot[i]!.id}: ${days} ngày`);
    if (i > 0) {
      assert.equal(rot[i]!.start, rot[i - 1]!.end);
      assert.notEqual(rot[i]!.id.split('-').slice(2).join('-'), rot[i - 1]!.id.split('-').slice(2).join('-'));
    }
  }
  for (let t = fixedEnd; t < rot.at(-1)!.end; t += 86_400_000 / 3) assert.equal(activeEvents(content, t).length, 1);
});

test('điểm sự kiện mới: bắt bọ (tay, chim, Cáo), câu cá, bán Sạp, Lộc Phiên…', () => {
  const bug = content.events.find((e) => e.id.includes('bug-season'))!;
  const pts = eventPointsFor(bug, [{ type: 'bugCaught' } as never, { type: 'birdCaught' } as never, { type: 'petCaught' } as never]);
  assert.equal(pts, 3 * (bug.points.catchBug ?? 0));
  const tet = content.events.find((e) => e.id.includes('tet-phu-ba'))!;
  assert.equal(eventPointsFor(tet, [{ type: 'luckClaimed' } as never]), tet.points.luck);
});

test('đơn: núm trung tính giữ nguyên đơn cũ; bật lên thì cây mới nặng hơn, Cúc giảm dần, có khách quen', () => {
  const cfg = content.orders;
  const saved = { ...cfg };
  const orders = (seed: number) => {
    const s = newGame(content, { level: 30 }, seed);
    for (const id of Object.keys(s.neighbors).slice(0, 5)) s.neighbors[id]!.friendship = 5;
    return Array.from({ length: 200 }, () => generateOrder(content, s));
  };
  const daisy = content.cropList[0]!.produce.id;
  const count = (list: ReturnType<typeof orders>) => list.filter((o) => o.items[daisy]).length;
  const base = orders(7);
  assert.equal(base.filter((o) => o.regular).length, 0);
  Object.assign(cfg, { recentWeight: 3, daisyFadeFrom: 10, regularChance: 0.5, regularFriendship: 3, regularBonus: 0.2 });
  const tuned = orders(7);
  Object.assign(cfg, saved);
  assert.ok(count(tuned) < count(base), `Cúc: ${count(tuned)} < ${count(base)}`);
  const reg = tuned.filter((o) => o.regular);
  assert.ok(reg.length > 50 && reg.length < 150);
  const friends = new Set(Object.keys(newGame(content, { level: 30 }, 7).neighbors).slice(0, 5));
  for (const o of reg) assert.ok(friends.has(o.customer));
  void T0;
});
