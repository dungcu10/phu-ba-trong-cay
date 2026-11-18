// Chỉ thị 10 § 3.10: floor decorations. Each floor has a few decor slots; a lantern or crystal set in
// one adds a little to harvests on that floor (lantern: EXP; crystal: yield), at most decor.floorCap
// per stat per floor, and always under the overall bonus caps. Bought at the Lò Gốm with coins; taking
// one down puts it back in the Túi Nguyên Liệu.

import type { ContentPack, PotStatName } from '../core/content.ts';
import type { FloorState, GameState } from '../core/state.ts';
import { addItem, removeItem } from './economy.ts';

export type DecorError = 'locked' | 'unknown_item' | 'not_enough_coins' | 'not_enough_items' | 'bad_slot' | 'unknown_floor';

export function decorBonus(content: ContentPack, floor: FloorState, stat: PotStatName): number {
  const d = content.decor;
  if (!d) return 0;
  let b = 0;
  for (const id of floor.decor ?? []) {
    const it = id ? d.items[id] : undefined;
    if (it && it.stat === stat) b += it.bonus;
  }
  return Math.min(d.floorCap, b);
}

export function buyDecor(content: ContentPack, state: GameState, itemId: string): DecorError | { coins: number } {
  const it = content.decor?.items[itemId];
  if (!it) return 'unknown_item';
  if (state.player.level < it.unlockLevel) return 'locked';
  if (state.player.coins < it.price) return 'not_enough_coins';
  state.player.coins -= it.price;
  addItem(state, itemId, 1);
  return { coins: it.price };
}

/** Sets a decoration from the bag into a floor's slot (null takes it down); the old one goes back. */
export function placeDecor(content: ContentPack, state: GameState, floorIndex: number, slot: number, itemId: string | null): DecorError | { removed: string | null } {
  const d = content.decor;
  if (!d) return 'locked';
  const floor = state.floors[floorIndex];
  if (!floor) return 'unknown_floor';
  if (!Number.isInteger(slot) || slot < 0 || slot >= d.slots) return 'bad_slot';
  if (itemId !== null) {
    if (!d.items[itemId]) return 'unknown_item';
    if ((state.inventory[itemId] ?? 0) < 1) return 'not_enough_items';
  }
  const decor = Array.from({ length: d.slots }, (_, i) => floor.decor?.[i] ?? null);
  const removed = decor[slot] ?? null;
  if (removed) addItem(state, removed, 1);
  if (itemId) removeItem(state, itemId, 1);
  decor[slot] = itemId;
  floor.decor = decor;
  return { removed };
}
