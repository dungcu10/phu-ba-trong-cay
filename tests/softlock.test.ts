// R1 (CTO review 01): the player can never get stuck. After any sequence of valid commands there
// is always at least one plant, harvest or sell that works, either now or after waiting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentPack, ContentError } from '../src/core/content.ts';
import { dispatch, type Command } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { randomFor } from '../src/core/rng.ts';
import { BUG, DAISY, HOUR, loadBase, MIN, newGame, readRaw, T0 } from './helpers.ts';

const content = await loadBase();

/** True if some plant/harvest/sell succeeds on a copy of the state, now or after waiting a day. */
function canProgress(state: GameState, now: number): boolean {
  const tryOn = (cmd: Command, at: number) => dispatch(content, structuredClone(state), cmd, at).ok;
  for (const [fi, floor] of state.floors.entries()) {
    for (const [si] of floor.slots.entries()) {
      const at = { floor: fi, slot: si };
      for (const crop of content.cropList) if (tryOn({ type: 'plant', cropId: crop.id, ...at }, now)) return true;
      if (tryOn({ type: 'harvest', ...at }, now + 24 * HOUR)) return true;
    }
  }
  for (const [itemId, qty] of Object.entries(state.inventory)) {
    if (qty > 0 && tryOn({ type: 'sell', itemId, qty: 1 }, now)) return true;
  }
  return false;
}

function randomCommand(state: GameState, seed: number, step: number): Command {
  const r = (k: string) => randomFor(seed, 'cmd', step, k);
  const slot = Math.floor(r('slot') * state.floors[0]!.slots.length);
  const at = { floor: 0, slot };
  // Weighted toward spending (plant, upgrade) so low-coin situations are reached often.
  const roll = r('kind');
  const kind = roll < 0.3 ? 0 : roll < 0.4 ? 1 : roll < 0.5 ? 2 : roll < 0.65 ? 3 : roll < 0.7 ? 4 : 5;
  switch (kind) {
    case 0:
      return { type: 'plant', cropId: content.cropList[Math.floor(r('crop') * content.cropList.length)]!.id, ...at };
    case 1:
      return { type: 'water', ...at };
    case 2:
      return { type: 'catchBug', ...at };
    case 3:
      return { type: 'harvest', ...at };
    case 4: {
      const items = Object.keys(state.inventory);
      const itemId = items[Math.floor(r('item') * items.length)] ?? DAISY;
      return { type: 'sell', itemId, qty: 1 + Math.floor(r('qty') * (state.inventory[itemId] ?? 1)) };
    }
    default:
      return { type: 'upgradePot', potInstanceId: state.floors[0]!.slots[slot]!.potInstanceId };
  }
}

test('10.000 lệnh hợp lệ ngẫu nhiên trên nhiều hạt giống: luôn còn đường chơi tiếp', () => {
  const seeds = [1, 7, 42, 1234, 99991];
  const perSeed = 2000;
  let checked = 0;
  // Starting coins include 0 (state right after an upgrade spent everything, as in R1) and 40
  // with 2 bugs (exactly one upgrade affordable).
  const startCoins = [0, 40, 40, 1, 30];
  for (const [i, seed] of seeds.entries()) {
    const s = newGame(content, { coins: startCoins[i]! }, seed);
    s.inventory[BUG] = 2;
    assert.ok(canProgress(s, T0), `kẹt ngay từ đầu (hạt giống ${seed}, ${startCoins[i]} xu)`);
    let now = T0;
    let valid = 0;
    for (let step = 0; valid < perSeed && step < perSeed * 40; step++) {
      now += Math.floor(randomFor(seed, 'wait', step) * 3 * MIN);
      // Bias toward spending: the risky situations are low coins after upgrades.
      if (randomFor(seed, 'bugs', step) < 0.05) s.inventory[BUG] = (s.inventory[BUG] ?? 0) + 3;
      const r = dispatch(content, s, randomCommand(s, seed, step), now);
      if (!r.ok) continue;
      valid += 1;
      checked += 1;
      assert.ok(canProgress(s, now), `kẹt sau lệnh hợp lệ thứ ${valid} (hạt giống ${seed}): ${JSON.stringify(s.player)}`);
    }
    assert.equal(valid, perSeed, `hạt giống ${seed} chỉ tạo được ${valid} lệnh hợp lệ`);
  }
  assert.equal(checked, 10_000);
});

test('tái hiện R1: nâng chậu hết sạch xu vẫn gieo được cây miễn phí', () => {
  const cost = content.pots.get('base:pot.terracotta')!.levels[1]!.upgradeCost!;
  const s = newGame(content, { coins: cost.coins });
  for (const [id, q] of Object.entries(cost.items)) s.inventory[id] = q;
  assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: 'pot-1' }, T0).ok);
  assert.equal(s.player.coins, 0);
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0).ok);
});

test('gói nội dung không có cây miễn phí mở từ cấp khởi đầu bị từ chối', async () => {
  const raw = await readRaw();
  for (const c of raw.crops as Array<Record<string, unknown>>) if (c.seedPrice === 0) c.seedPrice = 1;
  assert.throws(() => buildContentPack(raw), (e: unknown) => e instanceof ContentError && e.problems.some((p) => p.includes('miễn phí')));
});
