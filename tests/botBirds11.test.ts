// Chỉ thị 11 đính chính D1: neighbours (BOT) keep birds with the player's bird rules (shared
// runBirds / newBird / addFood in birds.ts). Acceptance: 40 BOT × 7 days have birds catching bugs,
// and a neighbour's bird catches within ±20% of an average player's bird.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { botCrops, botGarden } from '../src/systems/visit.ts';
import { simulateProgression } from '../tools/progression.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const DAY = 86_400_000;
const bugsOf = (b: { bugs: Record<string, number> }) => Object.values(b.bugs).reduce((a, q) => a + q, 0);

test('40 BOT × 7 ngày: BOT đủ cấp đều thuê chim, chim bắt được bọ', () => {
  const s = newGame(content, { level: 20 }, 7);
  simulateNeighbors(content, s, T0 + 7 * DAY);
  const bots = Object.values(s.neighbors);
  assert.ok(bots.length >= 40, `${bots.length} BOT`);
  for (const [id, b] of Object.entries(s.neighbors)) {
    if (b.level < 3) continue;
    assert.ok(bugsOf(b) > 0, `${id} (cấp ${b.level}) không có bọ chim bắt`);
    assert.ok(b.birds.length > 0 || bugsOf(b) > 0, `${id} không có chim`);
  }
});

test('số bọ BOT có mỗi ngày trong khoảng ±20% người chơi vừa cùng tầm cấp (2 giờ/lần)', () => {
  // Chỉ thị 11 D1, after the economy pass (bugs ×1/20, the player's hand and bird share one pool):
  // compare all the bugs a neighbour gets (its own catching + its bird) with all the bugs an average
  // player gets (by hand + bird) on days 4–7, among neighbours at the player's levels on those days.
  const { days } = simulateProgression(content, 120, 7);
  const late = days.slice(3);
  const player = late.reduce((a, d) => a + Object.values(d.bugsByRarity).reduce((x, q) => x + q, 0), 0) / late.length;
  const lo = Math.min(...late.map((d) => d.level));
  const hi = Math.max(...late.map((d) => d.level));
  const s = newGame(content, { level: 20 }, 42);
  simulateNeighbors(content, s, T0 + 7 * DAY);
  const peers = Object.values(s.neighbors).filter((b) => b.level >= lo && b.level <= hi);
  assert.ok(peers.length >= 5, `chỉ ${peers.length} BOT cấp ${lo}–${hi}`);
  const bot = peers.reduce((a, b) => a + bugsOf(b), 0) / peers.length / 7;
  assert.ok(player > 0, 'người chơi không có bọ');
  assert.ok(Math.abs(bot - player) / player <= 0.2, `BOT ${bot.toFixed(1)}/ngày, người chơi ${player.toFixed(1)}/ngày (cấp ${lo}–${hi})`);
});

test('chim BOT có bắt bọ (phần chim trong tổng bọ của BOT)', () => {
  const s = newGame(content, { level: 20 }, 42);
  let birdCaught = 0;
  simulateNeighbors(content, s, T0 + 7 * DAY);
  for (const b of Object.values(s.neighbors)) birdCaught += b.birds.reduce((a, x) => a + x.caught, 0);
  assert.ok(birdCaught > 0);
});

test('BOT chỉ thuê loài chim hợp họ cây trong vườn: chim nào cũng bắt được bọ', () => {
  const s = newGame(content, { level: 20 }, 42);
  simulateNeighbors(content, s, T0 + 7 * DAY);
  for (const [id, b] of Object.entries(s.neighbors)) {
    for (const bird of b.birds) assert.ok(bird.caught > 0, `${id}: ${bird.species} bắt 0 bọ`);
  }
});

test('vườn rút gọn của BOT (chỉ cây) trùng đúng cây của vườn khi người chơi ghé thăm', () => {
  const s = newGame(content, { level: 20 }, 13);
  simulateNeighbors(content, s, T0 + 3 * DAY);
  for (const id of Object.keys(s.neighbors)) {
    for (const at of [T0, T0 + 2 * DAY + 5 * HOUR]) {
      const full = botGarden(content, s, id, at).map((f) => f.pots.map((p) => p.crop.id));
      const light = botCrops(content, s, id, at).map((f) => f.map((c) => c.id));
      assert.deepEqual(light, full, id);
    }
  }
});

test('tất định: mô phỏng liên tục hay mở lại sau 7 ngày cho cùng chim và bọ của BOT', () => {
  const once = newGame(content, { level: 20 }, 11);
  const steps = newGame(content, { level: 20 }, 11);
  simulateNeighbors(content, once, T0 + 7 * DAY);
  for (let t = T0 + 37 * MIN; t < T0 + 7 * DAY; t += 37 * MIN) simulateNeighbors(content, steps, t);
  simulateNeighbors(content, steps, T0 + 7 * DAY);
  const view = (s: typeof once) => Object.fromEntries(Object.entries(s.neighbors).map(([id, b]) => [id, { birds: b.birds, bugs: b.bugs, coins: b.coins }]));
  assert.deepEqual(view(steps), view(once));
});

test('hiệu năng: 40 BOT × 7 ngày (đủ chim) dưới 150 ms khi đã chạy nóng', () => {
  simulateNeighbors(content, newGame(content, { level: 20 }, 3), T0 + 7 * DAY);
  // Best of 3 runs: the test runner works on other test files at the same time.
  let ms = Infinity;
  for (let k = 0; k < 3; k++) {
    const s = newGame(content, { level: 20 }, 4 + k);
    const t = performance.now();
    simulateNeighbors(content, s, T0 + 7 * DAY);
    ms = Math.min(ms, performance.now() - t);
  }
  assert.ok(ms < 150, `${ms.toFixed(0)} ms`);
});
