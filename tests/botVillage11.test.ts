// Chỉ thị 11 TỔNG § I: neighbours (BOT) have a village and pets, with the player's shared rules
// (village.ts upgradeHouse / settleBuildings, pets.ts giftKitten / obtainPet / feedPet / errands).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const DAY = 86_400_000;

test('40 BOT × 7 ngày: BOT đủ cấp có nhà được nâng, có thú cưng, thú cưng đi việc vặt', () => {
  const s = newGame(content, { level: 20 }, 7);
  simulateNeighbors(content, s, T0 + 7 * DAY);
  const bots = Object.values(s.neighbors);
  const v = content.village!;
  const builders = bots.filter((b) => b.level >= v.upgradeFromLevel + 2);
  assert.ok(builders.length >= 5, `${builders.length} BOT đủ cấp`);
  const raised = builders.filter((b) => Object.values(b.buildings ?? {}).some((h) => h.level > 1 || h.upgradeEndsAt !== null));
  assert.ok(raised.length >= builders.length * 0.3, `${raised.length}/${builders.length} BOT nâng nhà`);
  for (const b of bots) for (const h of Object.values(b.buildings ?? {})) assert.ok(h.level >= 1 && h.level <= 5);
  const withPets = bots.filter((b) => b.level >= content.pets!.unlockLevel);
  assert.ok(withPets.every((b) => (b.pets?.length ?? 0) > 0), 'BOT từ cấp 4 có Mèo');
  const errands = bots.reduce((a, b) => a + (b.errands?.list.filter((e) => e.done).length ?? 0), 0);
  assert.ok(errands > 0, 'có việc vặt đã nhận');
  // Pets never leave or lose bond.
  for (const b of bots) for (const p of b.pets ?? []) assert.ok(p.bond >= 0 && p.level >= 1);
});

test('BOT: chia khoảng thời gian thế nào thì kết quả làng và thú cưng cũng như nhau', () => {
  const once = newGame(content, { level: 20 }, 11);
  simulateNeighbors(content, once, T0 + 3 * DAY);
  const steps = newGame(content, { level: 20 }, 11);
  for (let h = 6; h <= 72; h += 6) simulateNeighbors(content, steps, T0 + h * 3_600_000);
  const view = (g: typeof once) => Object.fromEntries(Object.entries(g.neighbors).map(([id, b]) => [id, { buildings: b.buildings, pets: b.pets?.map((p) => [p.species, p.level, p.bond]), coins: b.coins }]));
  assert.deepEqual(view(steps), view(once));
});
