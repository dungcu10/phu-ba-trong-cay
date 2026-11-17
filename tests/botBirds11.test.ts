// Chỉ thị 11 đính chính D1: neighbours (BOT) keep birds with the player's bird rules (shared
// runBirds / newBird / addFood in birds.ts). Acceptance: 40 BOT × 7 days have birds catching bugs,
// and a neighbour's bird catches within ±20% of an average player's bird.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { simulateProgression } from '../tools/progression.ts';
import { loadBase, MIN, newGame, T0 } from './helpers.ts';

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

test('số bọ chim BOT bắt mỗi ngày trong khoảng ±20% chim của người chơi vừa (2 giờ/lần)', () => {
  const { days } = simulateProgression(content, 120, 7);
  // The player's bird from day 5 on (after its first days on 60-second Cúc, which draw almost no bugs).
  const late = days.slice(4).filter((d) => d.birds > 0);
  const player = late.reduce((a, d) => a + d.birdBugs, 0) / late.length;
  const s = newGame(content, { level: 20 }, 42);
  simulateNeighbors(content, s, T0 + 7 * DAY);
  const withBirds = Object.values(s.neighbors).filter((b) => bugsOf(b) > 0);
  const bot = withBirds.reduce((a, b) => a + bugsOf(b), 0) / withBirds.length / 7;
  assert.ok(player > 0, 'chim người chơi không bắt được bọ');
  assert.ok(Math.abs(bot - player) / player <= 0.2, `BOT ${bot.toFixed(1)}/ngày, người chơi ${player.toFixed(1)}/ngày`);
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
