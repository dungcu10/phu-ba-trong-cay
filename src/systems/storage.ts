// Chỉ thị 12 TỔNG A2: two stores. Kho Nông Sản (the Rương Mây) holds produce and workshop goods and
// has a capacity bought with coins; Túi Nguyên Liệu holds everything else — bugs, minerals, Sợi Mây,
// Giọt Sương, Hạt Kê, bait, badges, pot materials, decor — with no limit. The save keeps one item map;
// which store an item lives in follows from its kind, so no item can ever be lost or end up in the
// wrong store, and new item kinds land in the bag unless they are produce or goods.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { stillNeeded } from './orders.ts';
import { sellPrice } from './economy.ts';

export type Store = 'farm' | 'bag';

export function storeOf(content: ContentPack, itemId: string): Store {
  return content.items.get(itemId)?.countsTowardStorage ? 'farm' : 'bag';
}

/** Items of one store the player holds, in inventory order. */
export function storeEntries(content: ContentPack, state: GameState, store: Store): Array<[string, number]> {
  return Object.entries(state.inventory).filter(([id, q]) => q > 0 && storeOf(content, id) === store);
}

/** How many of each item the open orders (not yet sent) still ask for. */
export function orderNeeds(state: GameState): Record<string, number> {
  const need: Record<string, number> = {};
  for (const s of state.orders.slots) {
    if (!s.order) continue;
    for (const [id, q] of Object.entries(stillNeeded(s.order))) need[id] = (need[id] ?? 0) + q;
  }
  return need;
}

/** "Bán nhanh": every sellable item in the Kho Nông Sản beyond what the open orders still need. */
export function quickSellPlan(content: ContentPack, state: GameState, now: number): Array<{ itemId: string; qty: number; coins: number }> {
  const need = orderNeeds(state);
  const plan: Array<{ itemId: string; qty: number; coins: number }> = [];
  for (const [id, have] of storeEntries(content, state, 'farm')) {
    const qty = have - (need[id] ?? 0);
    const price = sellPrice(content, state, id, now);
    if (qty > 0 && price !== null) plan.push({ itemId: id, qty, coins: price * qty });
  }
  return plan;
}
