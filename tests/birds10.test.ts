// Chỉ thị 10 · M4: bug-catching birds. Same catchBug as the player, time-ordered simulation that
// gives the same result offline as played continuously, hunger (sleep, never death), rent, levels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { cycleMs, foodAt, hungryAt } from '../src/systems/birds.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const SPARROW = 'base:bird.sky-sparrow';
const OWL = 'base:bird.night-owl';
const GERBERA = 'base:crop.golden-gerbera';
const MILLET = 'base:mat.cloud-millet';

function garden(entropy = 7): GameState {
  const s = newGame(content, { level: 20, coins: 99999, gems: 999 }, entropy);
  for (let i = 0; i < s.floors[0]!.slots.length; i++) {
    const r = dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 0, slot: i }, T0);
    assert.ok(r.ok, `trồng ô ${i}: ${JSON.stringify(r)}`);
  }
  const b = dispatch(content, s, { type: 'obtainBird', species: SPARROW, how: 'rent' }, T0);
  assert.ok(b.ok, JSON.stringify(b));
  return s;
}

/** What the birds change: bugs in the bag, each planting's caught bugs, the bird itself, the book. */
function birdView(s: GameState) {
  const bugs = Object.fromEntries(Object.entries(s.inventory).filter(([k]) => k.includes(':bug.')).sort());
  const caught = s.floors.flatMap((f) => f.slots.map((x) => x.planting?.caughtBugs ?? null));
  return { bugs, caught, birds: s.birds, book: s.collections.bugs, coins: s.player.coins };
}

test('thuê chim: trừ xu, đậu cành trống, đủ no', () => {
  const s = newGame(content, { level: 20, coins: 1000 }, 1);
  const r = dispatch(content, s, { type: 'obtainBird', species: SPARROW, how: 'rent' }, T0);
  assert.ok(r.ok);
  assert.equal(s.player.coins, 700);
  assert.equal(s.birds.length, 1);
  assert.equal(s.birds[0]!.floor, 0);
  assert.equal(s.birds[0]!.food, 100);
  const owl = dispatch(content, s, { type: 'obtainBird', species: OWL, how: 'rent' }, T0);
  assert.deepEqual(owl, { ok: false, error: 'cannot_rent' });
});

test('chim chưa đủ cấp thì không có', () => {
  const s = newGame(content, { level: 2, coins: 1000 }, 1);
  assert.deepEqual(dispatch(content, s, { type: 'obtainBird', species: SPARROW, how: 'rent' }, T0), { ok: false, error: 'level_too_low' });
});

test('chim bắt bọ bằng đúng lệnh bắt bọ của người chơi (Sổ Sâu Bọ, thống kê, bọ trong túi)', () => {
  const s = garden();
  dispatch(content, s, { type: 'tick' }, T0 + 2 * HOUR);
  const bird = s.birds[0]!;
  assert.ok(bird.caught > 0, 'chim chưa bắt con nào');
  assert.equal(s.stats.bugsCaught, bird.caught);
  // (The bag can also hold bugs that BOT neighbours gave as gifts, so count the plantings instead.)
  const onPlants = s.floors[0]!.slots.reduce((n, x) => n + Object.values(x.planting?.caughtBugs ?? {}).reduce((a, q) => a + q, 0), 0);
  assert.equal(onPlants, bird.caught);
  const book = Object.values(s.collections.bugs).reduce((n, b) => n + b.count, 0);
  assert.equal(book, bird.caught);
});

test('tắt game 8 giờ rồi mở lại: kết quả khớp với chơi liên tục', () => {
  const offline = garden(11);
  const online = garden(11);
  dispatch(content, offline, { type: 'tick' }, T0 + 8 * HOUR);
  for (let t = T0 + 37 * 1000; t <= T0 + 8 * HOUR; t += 37 * 1000) dispatch(content, online, { type: 'tick' }, t);
  dispatch(content, online, { type: 'tick' }, T0 + 8 * HOUR);
  assert.ok(offline.birds[0]!.caught > 0);
  assert.deepEqual(birdView(offline), birdView(online));
});

test('chim đói thì ngủ (không chết, không mất gì), cho ăn thì bắt tiếp, không bắt bù giờ ngủ', () => {
  const s = garden(3);
  const bird = s.birds[0]!;
  const hungry = hungryAt(content, bird);
  assert.equal(Math.round((hungry - T0) / HOUR), 8);
  // Fresh crops after it fell asleep, then a long wait: no catches while asleep.
  dispatch(content, s, { type: 'tick' }, hungry + MIN);
  for (let i = 0; i < s.floors[0]!.slots.length; i++) {
    dispatch(content, s, { type: 'harvest', floor: 0, slot: i }, hungry + MIN);
    dispatch(content, s, { type: 'plant', cropId: GERBERA, floor: 0, slot: i }, hungry + MIN);
  }
  const before = s.birds[0]!.caught;
  dispatch(content, s, { type: 'tick' }, hungry + 3 * HOUR);
  assert.equal(s.birds.length, 1, 'chim đói bị mất');
  assert.equal(s.birds[0]!.caught, before, 'chim ngủ vẫn bắt bọ');
  assert.equal(foodAt(content, s.birds[0]!, hungry + 3 * HOUR), 0);
  // Feed: works again from now on, only for time after the meal.
  assert.ok(dispatch(content, s, { type: 'buyMillet', qty: 1 }, hungry + 3 * HOUR).ok);
  const fed = dispatch(content, s, { type: 'feedBird', birdId: s.birds[0]!.id, itemId: MILLET }, hungry + 3 * HOUR);
  assert.ok(fed.ok, JSON.stringify(fed));
  dispatch(content, s, { type: 'tick' }, hungry + 3 * HOUR + cycleMs(content, s.birds[0]!.level) - 1);
  assert.equal(s.birds[0]!.caught, before, 'bắt bù thời gian ngủ');
});

test('chim thuê bay về khi hết hạn, bọ đã bắt vẫn giữ', () => {
  const s = garden(5);
  dispatch(content, s, { type: 'tick' }, T0 + 2 * HOUR);
  const caught = s.birds[0]!.caught;
  const r = dispatch(content, s, { type: 'tick' }, T0 + 3 * 24 * HOUR + MIN);
  assert.ok(r.ok && r.events.some((e) => e.type === 'birdLeft'));
  assert.equal(s.birds.length, 0);
  const inBag = Object.entries(s.inventory).filter(([k]) => k.includes(':bug.')).reduce((n, [, q]) => n + q, 0);
  assert.ok(inBag >= caught);
});

test('chim chỉ bắt bọ trên cây đúng họ của nó', () => {
  const s = newGame(content, { level: 20, coins: 99999 }, 9);
  // Sẻ Mây = hoa; trồng toàn cây thảo.
  for (let i = 0; i < s.floors[0]!.slots.length; i++) dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 0, slot: i }, T0);
  dispatch(content, s, { type: 'obtainBird', species: SPARROW, how: 'rent' }, T0);
  dispatch(content, s, { type: 'tick' }, T0 + 2 * HOUR);
  assert.equal(s.birds[0]!.caught, 0);
});
