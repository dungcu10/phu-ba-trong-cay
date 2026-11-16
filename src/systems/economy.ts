// Levels, XP, storage and prices.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';

const DAY_MS = 86_400_000;

export function xpToNextLevel(content: ContentPack, level: number): number {
  const { xpBase, xpExponent } = content.config.levels;
  return Math.round(xpBase * Math.pow(level, xpExponent));
}

/** Adds XP and applies every level-up it causes. Returns the levels gained. */
export function addXp(content: ContentPack, state: GameState, amount: number): number[] {
  const gained: number[] = [];
  const { maxLevel, levelUpCoins } = content.config.levels;
  state.player.xp += amount;
  while (state.player.level < maxLevel && state.player.xp >= xpToNextLevel(content, state.player.level)) {
    state.player.xp -= xpToNextLevel(content, state.player.level);
    state.player.level += 1;
    state.player.coins += levelUpCoins;
    gained.push(state.player.level);
  }
  return gained;
}

export function storageUsed(content: ContentPack, state: GameState): number {
  let used = 0;
  for (const [id, qty] of Object.entries(state.inventory)) {
    if (content.items.get(id)?.countsTowardStorage) used += qty;
  }
  return used;
}

export function storageFree(content: ContentPack, state: GameState): number {
  return content.config.storageCapacity - storageUsed(content, state);
}

/** Day number used for daily price variation (UTC days). */
export function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** Today's unit price: base price with a small deterministic daily variation. */
export function sellPrice(content: ContentPack, state: GameState, itemId: string, now: number): number | null {
  const item = content.items.get(itemId);
  if (!item || item.sellPrice === null) return null;
  const amp = content.config.market.dailyPriceVariation;
  const factor = 1 + amp * (randomFor(state.seed, 'price', itemId, dayIndex(now)) * 2 - 1);
  return Math.max(1, Math.round(item.sellPrice * factor));
}

export function addItem(state: GameState, itemId: string, qty: number): void {
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + qty;
}

export function removeItem(state: GameState, itemId: string, qty: number): void {
  const left = (state.inventory[itemId] ?? 0) - qty;
  if (left < 0) throw new Error(`Không đủ ${itemId}`);
  if (left === 0) delete state.inventory[itemId];
  else state.inventory[itemId] = left;
}
