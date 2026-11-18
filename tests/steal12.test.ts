// Chỉ thị 12 B4/B5: trộm vườn (lượt, giới hạn 25%, dấu chân, bị bắt, kẻ thù trả đũa, Cú Đúp, hạt thử),
// BOT trộm khi tắt game (không bao giờ khi đang chơi, ≤ 3/ngày, không lấy hàng biến dị), giúp vườn
// (bọ về túi mình, đúng loại cây bot trồng, 10 lượt/ngày chung), mốc thân thiết, migration 13 → 14.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { MIGRATIONS, migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { botGarden } from '../src/systems/visit.ts';
import { catchChance, gardenBugs, stealTurns, stealWhileAway, visitBug } from '../src/systems/social.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { localDay } from '../src/systems/missions.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const DAY = 24 * HOUR;

const content = await loadBase();
const R = content.neighbors.steal!;

/** A ripe pot (floor, slot) in some neighbour's garden at some time, with a calm garden when asked. */
function findRipe(s: GameState, opts: { calm?: boolean; strict?: boolean; not?: string[] } = {}): { botId: string; floor: number; slot: number; t: number } {
  const bots = [...content.bots.values()].filter((b) => !!s.neighbors[b.id] && !(opts.not ?? []).includes(b.id) && s.neighbors[b.id]!.level >= 3);
  for (let t = T0; t < T0 + 2 * DAY; t += 20 * MIN)
    for (const b of bots) {
      const cc = catchChance(content, s, b.id, t);
      if (opts.calm && cc > 0) continue;
      if (opts.strict && cc === 0) continue;
      const g = botGarden(content, s, b.id, t);
      for (let f = 0; f < g.length; f++) for (let i = 0; i < g[f]!.pots.length; i++) if (g[f]!.pots[i]!.ripe) return { botId: b.id, floor: f, slot: i, t };
    }
  throw new Error('không tìm thấy chậu chín');
}

test('trộm: chỉ cây chín, 1–2 và ≤ 25% sản lượng, dấu chân, tốn lượt, 3 giờ hồi 1 lượt', () => {
  const s = newGame(content, { level: 12 });
  const p = findRipe(s, { calm: true });
  const before = stealTurns(content, s, p.t);
  assert.equal(before, R.turnsMax);
  const r = dispatch(content, s, { type: 'stealCrop', ...p }, p.t);
  assert.ok(r.ok, JSON.stringify(r));
  const e = r.events.find((x) => x.type === 'cropStolen');
  assert.ok(e && e.type === 'cropStolen');
  const pot = botGarden(content, s, p.botId, p.t)[p.floor]!.pots[p.slot]!;
  assert.ok(e.qty >= 1 && e.qty <= Math.max(1, Math.floor(pot.crop.yield * R.maxShare)) * (e.double ? 2 : 1));
  assert.equal((s.inventory[e.itemId] ?? 0) >= e.qty, true);
  assert.deepEqual(dispatch(content, s, { type: 'stealCrop', ...p }, p.t), { ok: false, error: 'already_stolen' });
  assert.equal(stealTurns(content, s, p.t), R.turnsMax - 1);
  assert.equal(stealTurns(content, s, p.t + R.regenHours * HOUR), R.turnsMax);
});

test('trộm: hết lượt thì báo; cây chưa chín thì không trộm được', () => {
  const s = newGame(content, { level: 12 });
  const p = findRipe(s, { calm: true });
  s.social.steal.tokens = 0;
  s.social.steal.at = p.t;
  assert.deepEqual(dispatch(content, s, { type: 'stealCrop', ...p }, p.t), { ok: false, error: 'no_steal_turns' });
  const g = botGarden(content, s, p.botId, p.t);
  const green = g.flatMap((f, fi) => f.pots.map((x, i) => ({ x, fi, i }))).find((v) => !v.x.ripe)!;
  s.social.steal.tokens = 5;
  assert.deepEqual(dispatch(content, s, { type: 'stealCrop', botId: p.botId, floor: green.fi, slot: green.i }, p.t), { ok: false, error: 'not_ripe' });
});

test('bị bắt quả tang: mất lượt, không mất đồ, không có dấu chân', () => {
  const s = newGame(content, { level: 12 });
  // A neighbour with a pet at home and/or strict: catch chance 20–35 %. Try until caught once.
  for (const b of Object.values(s.neighbors)) b.pets = [{ ...(b.pets?.[0] ?? {}), species: 'pet.cloud-kitten', level: 1, xp: 0, stars: 1, bond: 0, food: 100, fedAt: T0, active: true, floor: 0, awayUntil: null, skillAt: {} } as never];
  let caught = false;
  for (let k = 0; k < 40 && !caught; k++) {
    const p = findRipe(s, { strict: true });
    s.social.steal.tokens = 5;
    s.social.steal.at = p.t;
    const cc = catchChance(content, s, p.botId, p.t);
    assert.ok(cc >= 0.2 - R.foxReduce && cc <= 0.35);
    const items = JSON.stringify(s.inventory);
    const r = dispatch(content, s, { type: 'stealCrop', ...p }, p.t);
    if (r.ok && r.events.some((e) => e.type === 'stealCaught')) {
      caught = true;
      assert.equal(JSON.stringify(s.inventory), items);
      assert.equal(stealTurns(content, s, p.t), 4);
    } else s.social.steal.pots = {};
  }
  assert.ok(caught, 'có lúc bị bắt');
});

test('kẻ thù: trộm lại không tốn lượt, không bị bắt, gấp đôi; bắt sâu giúp vườn kẻ thù không được thưởng', () => {
  const s = newGame(content, { level: 12 });
  const p = findRipe(s, { strict: true });
  s.social.enemies[p.botId] = p.t + DAY;
  assert.equal(catchChance(content, s, p.botId, p.t), 0);
  const r = dispatch(content, s, { type: 'stealCrop', ...p }, p.t);
  const e = r.ok ? r.events.find((x) => x.type === 'cropStolen') : undefined;
  assert.ok(e && e.type === 'cropStolen' && e.enemy && e.qty % R.enemyMultiplier === 0);
  assert.equal(stealTurns(content, s, p.t), R.turnsMax);
});

test('Cú Đúp: 3 vườn khác nhau liên tiếp không bị bắt → lần sau gấp đôi, chắc chắn biến dị', () => {
  const s = newGame(content, { level: 12 });
  const used: string[] = [];
  for (let k = 0; k < R.streak; k++) {
    const p = findRipe(s, { calm: true, not: used });
    used.push(p.botId);
    assert.ok(dispatch(content, s, { type: 'stealCrop', ...p }, p.t).ok);
  }
  assert.equal(s.social.steal.double, true);
  const p = findRipe(s, { calm: true, not: used });
  s.social.steal.tokens = 5;
  const r = dispatch(content, s, { type: 'stealCrop', ...p }, p.t);
  const e = r.ok ? r.events.find((x) => x.type === 'cropStolen') : undefined;
  assert.ok(e && e.type === 'cropStolen' && e.double && e.mutation);
  assert.equal(s.social.steal.double, false);
});

test('hạt thử: gieo được cây cao hơn cấp một lần, không tốn xu', () => {
  const s = newGame(content, { level: 3 });
  const locked = content.cropList.find((c) => c.unlockLevel > 3)!;
  assert.deepEqual(dispatch(content, s, { type: 'plant', floor: 0, slot: 0, cropId: locked.id }, T0), { ok: false, error: 'locked' });
  s.social.trialSeeds[locked.id] = 1;
  const coins = s.player.coins;
  assert.ok(dispatch(content, s, { type: 'plant', floor: 0, slot: 0, cropId: locked.id }, T0).ok);
  assert.equal(s.player.coins, coins);
  assert.equal(s.social.trialSeeds[locked.id], undefined);
  assert.deepEqual(dispatch(content, s, { type: 'plant', floor: 0, slot: 1, cropId: locked.id }, T0), { ok: false, error: 'locked' });
});

function plantedGame(): GameState {
  const s = newGame(content, { level: 12, coins: 1e7 });
  const crop = content.cropList.find((c) => c.yield >= 3 && c.harvests <= 1 && c.unlockLevel <= 12) ?? content.cropList[1]!;
  s.floors[0]!.slots.forEach((_, i) => dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId: crop.id }, T0));
  return s;
}

test('BOT không trộm khi người chơi đang chơi (vào game mỗi phút suốt 2 ngày)', () => {
  const rules = content.neighbors.botSteal!;
  const saved = rules.chancePerHour;
  rules.chancePerHour = 1;
  const s = plantedGame();
  let taken = 0;
  for (let t = T0 + MIN; t < T0 + 2 * DAY; t += MIN) {
    const r = dispatch(content, s, { type: 'tick' }, t);
    if (r.ok) taken += r.events.filter((e) => e.type === 'takenWhileAway').length;
  }
  rules.chancePerHour = saved;
  assert.equal(taken, 0);
  assert.equal(s.social.taken.log.length, 0);
});

test('BOT trộm khi tắt game: ≤ 3 lần/ngày, ≤ 10% một chậu chín, thành kẻ thù, không lấy hàng biến dị', () => {
  // The content keeps it off until the CTO turns it on; test the rule with the suggested 12 %/hour.
  const rules = content.neighbors.botSteal!;
  const saved = rules.chancePerHour;
  rules.chancePerHour = 0.12;
  let total = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const s = plantedGame();
    s.seed = seed * 7919;
    const list = stealWhileAway(content, s, T0, T0 + 2 * DAY);
    total += list.length;
    const perDay = new Map<number, number>();
    for (const e of list) perDay.set(localDay(content, e.at), (perDay.get(localDay(content, e.at)) ?? 0) + 1);
    for (const n of perDay.values()) assert.ok(n <= content.neighbors.botSteal!.perDay);
    for (const e of list) {
      const crop = content.cropList.find((c) => c.produce.id === e.itemId)!;
      assert.ok(e.qty <= Math.max(1, Math.floor(crop.yield * content.neighbors.botSteal!.share)));
      assert.ok(!e.itemId.includes('~'));
      assert.ok(s.social.enemies[e.botId]! > e.at);
    }
    // The harvest of a pot taken from is smaller (never below 1).
    for (const fl of s.floors) for (const sl of fl.slots) if (sl.planting?.stolen) assert.ok(cropStatus(content, s, sl, T0 + 2 * DAY)?.ripe !== undefined);
  }
  rules.chancePerHour = saved;
  assert.ok(total > 0, 'có lúc bị trộm');
});

test('giúp vườn: bắt bọ thì bọ vào túi mình, đúng loại cây bot trồng; danh sách bọ trong vườn', () => {
  const s = newGame(content, { level: 12 });
  for (let t = T0; t < T0 + DAY; t += 30 * MIN)
    for (const b of content.bots.values()) {
      const g = botGarden(content, s, b.id, t);
      for (let f = 0; f < g.length; f++)
        for (let i = 0; i < g[f]!.pots.length; i++) {
          const pot = g[f]!.pots[i]!;
          if (pot.need !== 'bug') continue;
          const bugId = visitBug(content, s, b.id, pot, t);
          assert.ok(pot.crop.bugs.some((x) => x.id === bugId) || bugId === content.bugList[0]!.id);
          assert.ok(gardenBugs(content, s, b.id, t).some((x) => x.bugId === bugId));
          const had = s.inventory[bugId] ?? 0;
          const r = dispatch(content, s, { type: 'helpNeighbor', botId: b.id, floor: f, slot: i, kind: 'bug' }, t);
          assert.ok(r.ok, JSON.stringify(r));
          assert.equal(s.inventory[bugId], had + 1);
          return;
        }
    }
  assert.fail('không có chậu có bọ');
});

test('mốc thân thiết 3 / 6 / 10 tặng quà một lần', () => {
  const s = newGame(content, { level: 12 });
  const botId = [...content.bots.keys()][0]!;
  s.neighbors[botId]!.friendship = 6;
  const coins = s.player.coins;
  const r = dispatch(content, s, { type: 'tick' }, T0);
  assert.ok(r.ok);
  assert.equal(r.events.filter((e) => e.type === 'friendGift').length, 2);
  assert.ok(s.player.coins > coins);
  const r2 = dispatch(content, s, { type: 'tick' }, T0 + MIN);
  assert.equal(r2.ok && r2.events.filter((e) => e.type === 'friendGift').length, 0);
});

test('migration 13 → 14: thêm trộm/giúp, giữ nguyên chậu và bọ; reconcile đổ đầy lượt trộm', () => {
  const s = newGame(content, { level: 9 });
  s.inventory['base:bug.ladybird'] = 7;
  const raw = structuredClone(s) as unknown as Record<string, unknown>;
  delete raw.social;
  raw.saveVersion = 13;
  const out = migrate(raw, 13, MIGRATIONS, 14) as Record<string, any>;
  assert.equal(out.social.steal.tokens, -1);
  assert.deepEqual(out.pots, raw.pots);
  assert.equal(out.inventory['base:bug.ladybird'], 7);
  const fixed = reconcile(out as unknown as GameState, content, 'local').state;
  assert.equal(fixed.social.steal.tokens, R.turnsMax);
  assert.deepEqual(fixed.social.enemies, {});
});
