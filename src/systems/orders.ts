// Hot-air balloon orders (owner decision 2026-11-16, part 2). Six slots; each order asks for a
// few kinds of produce and pays more than the shop. Orders are generated from the seed and a
// counter, so they are reproducible, and only from crops the player can already grow.

import type { ContentPack } from '../core/content.ts';
import type { GameState, Order } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';

export function generateOrder(content: ContentPack, state: GameState): Order {
  const cfg = content.orders;
  const id = ++state.orders.counter;
  const r = (...k: Array<string | number>) => randomFor(state.seed, 'order', id, ...k);
  const level = state.player.level;
  const crops = content.cropList.filter((c) => c.unlockLevel <= level);
  const lineCount = Math.min(crops.length, 1 + Math.floor(r('lines') * cfg.maxLines));
  const pool = [...crops];
  const items: Record<string, number> = {};
  let value = 0;
  for (let i = 0; i < lineCount; i++) {
    const crop = pool.splice(Math.floor(r('crop', i) * pool.length), 1)[0]!;
    const qty = Math.max(1, Math.round(crop.yield * (1 + r('qty', i) * 2) * (1 + level * 0.05)));
    items[crop.produce.id] = qty;
    value += qty * crop.sellPrice;
  }
  const rare = level >= 3 && r('rare') < cfg.rareChance;
  const [lo, hi] = cfg.rewardMultiplier;
  const mult = (lo + (hi - lo) * r('mult')) * (rare ? cfg.rareMultiplier : 1);
  const bots = [...content.bots.keys()];
  return {
    id,
    customer: bots[Math.floor(r('customer') * bots.length)] ?? '',
    items,
    coins: Math.max(1, Math.round(value * mult)),
    xp: Math.max(1, Math.round(value * cfg.xpPerCoin * (rare ? 1.5 : 1))),
    gems: rare ? cfg.rareGems : 0,
    rare,
  };
}

/** Fills every empty slot whose balloon has come back. Returns the slots that got an order. */
export function refillOrders(content: ContentPack, state: GameState, now: number): number[] {
  const filled: number[] = [];
  state.orders.slots.forEach((slot, i) => {
    if (!slot.order && slot.readyAt <= now) {
      slot.order = generateOrder(content, state);
      filled.push(i);
    }
  });
  return filled;
}

export function canDeliver(state: GameState, order: Order): boolean {
  return Object.entries(order.items).every(([id, qty]) => (state.inventory[id] ?? 0) >= qty);
}
