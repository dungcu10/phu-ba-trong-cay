// Chỉ thị 12 B3: Phú Bà động (khoảng 60 người, 8 người có tên tuổi không chuyển nhà, người mới sinh
// ngẫu nhiên, cấp theo người chơi) và Giải Phú Bà theo tuần (nhóm 30, 5 lên 5 xuống, 5 hạng).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { MIGRATIONS, migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { isGenerated, isTycoon, levelBand, townBots } from '../src/systems/town.ts';
import { leagueTable, playerPoints, weekOf, weekStart } from '../src/systems/league.ts';
import { HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const DAY = 24 * HOUR;
const T = content.neighbors.town!;
const L = content.neighbors.league!;

function town(level = 20, seed = 3): GameState {
  const s = newGame(content, { level }, seed);
  dispatch(content, s, { type: 'tick' }, T0);
  return s;
}

test('làng có khoảng 60 Phú Bà: 8 người có tên tuổi, người mới có tên ghép và hình đại diện', () => {
  const s = town();
  assert.equal(Object.keys(s.neighbors).length, T.target);
  for (const id of T.famous) assert.ok(s.neighbors[id], id);
  const gen = townBots(content, s).filter((b) => isGenerated(b.id));
  assert.ok(gen.length >= 15);
  for (const b of gen) {
    assert.equal(b.name.vi.split(' ').length >= 3, true, b.name.vi);
    assert.ok(T.forms.some((f) => b.name.vi.startsWith(f)));
  }
  assert.equal(new Set(gen.map((b) => b.name.vi)).size >= gen.length - 3, true, 'tên ít trùng');
});

test('cấp Phú Bà theo người chơi: −4…+6, 3 đại gia +8…+12 (sau vài ngày)', () => {
  const s = town(30);
  for (let d = 1; d <= 12; d++) dispatch(content, s, { type: 'tick' }, T0 + d * DAY);
  let tycoons = 0;
  for (const b of townBots(content, s)) {
    const lv = s.neighbors[b.id]!.level;
    const [lo, hi] = levelBand(content, s, b.id);
    if (isTycoon(content, s, b.id)) tycoons += 1;
    assert.ok(lv >= lo, `${b.name.vi} cấp ${lv} < ${lo}`);
    assert.ok(lv <= hi + 2, `${b.name.vi} cấp ${lv} > ${hi}`);
  }
  assert.equal(tycoons, T.tycoons);
});

test('chuyển nhà: người không giao lưu dọn đi, người mới dọn đến; người có tên tuổi và bạn thân ở lại', () => {
  const s = town(20, 9);
  const friend = Object.keys(s.neighbors).find((id) => !T.famous.includes(id))!;
  s.neighbors[friend]!.friendship = 3;
  const before = new Set(Object.keys(s.neighbors));
  for (let d = 1; d <= 40; d++) dispatch(content, s, { type: 'tick' }, T0 + d * DAY);
  const after = Object.keys(s.neighbors);
  assert.equal(after.length, T.target);
  assert.ok(after.some((id) => !before.has(id)), 'có người mới');
  for (const id of T.famous) assert.ok(s.neighbors[id]);
  assert.ok(s.neighbors[friend], 'bạn thân không dọn đi');
});

test('lưu rồi mở lại: Phú Bà mới giữ nguyên tên, thứ tự và trạng thái', () => {
  const s = town(20, 5);
  for (let d = 1; d <= 20; d++) dispatch(content, s, { type: 'tick' }, T0 + d * DAY);
  const raw = JSON.parse(JSON.stringify(s));
  const back = reconcile(raw, content, 'local').state;
  assert.deepEqual(townBots(content, back).map((b) => [b.id, b.name.vi]), townBots(content, s).map((b) => [b.id, b.name.vi]));
  assert.deepEqual(back.neighbors, s.neighbors);
  assert.deepEqual(back.town, s.town);
});

test('giải tuần: nhóm 30, tuần bắt đầu thứ Hai; điểm cao lên hạng, điểm thấp xuống hạng; thưởng theo hạng', () => {
  const s = town(20, 4);
  const w = weekOf(content, T0);
  assert.equal(s.league.week, w);
  assert.equal(s.league.group.length, L.groupSize - 1);
  assert.equal(new Date(weekStart(content, w) + content.missions.utcOffsetHours * HOUR).getUTCDay(), 1);
  // A very strong week: top of the table → up one tier, top reward.
  s.league.helps = 10_000;
  assert.equal(leagueTable(content, s, T0).find((r) => r.id === '')!.rank, 1);
  const gems = s.player.gems;
  const r = dispatch(content, s, { type: 'tick' }, weekStart(content, w + 1) + HOUR);
  const e = r.ok ? r.events.find((x) => x.type === 'leagueSettled') : undefined;
  assert.ok(e && e.type === 'leagueSettled' && e.rank === 1 && e.newTier === 1);
  assert.equal(s.player.gems, gems + (L.tiers[0]!.top.gems ?? 0));
  assert.equal(s.league.tier, 1);
  assert.ok(playerPoints(content, s) < 50, 'tuần mới gần như bắt đầu từ 0');
  // A week with nothing done: last → down one tier.
  dispatch(content, s, { type: 'tick' }, weekStart(content, w + 2) + HOUR);
  assert.equal(s.league.tier, 0);
});

test('migration 14 → 15: giữ nguyên Phú Bà và thân thiết; reconcile làm sạch giải tuần', () => {
  const s = newGame(content, { level: 9 });
  const id = Object.keys(s.neighbors)[2]!;
  s.neighbors[id]!.friendship = 7;
  const raw = structuredClone(s) as unknown as Record<string, unknown>;
  delete raw.town;
  delete raw.league;
  raw.saveVersion = 14;
  const out = migrate(raw, 14, MIGRATIONS, 15) as Record<string, any>;
  assert.equal(out.league.tier, 0);
  const fixed = reconcile(out as unknown as GameState, content, 'local').state;
  assert.equal(fixed.neighbors[id]!.friendship, 7);
  (fixed.league as any).tier = 99;
  (fixed.league as any).group = ['nope', id];
  const again = reconcile(fixed, content, 'local').state;
  assert.equal(again.league.tier, L.tiers.length - 1);
  assert.deepEqual(again.league.group, [id]);
});
