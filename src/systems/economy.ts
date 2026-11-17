// Levels, XP, storage and prices.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { tidy } from '../core/income.ts';
import { hotSellFactor } from './cropExtras.ts';

const DAY_MS = 86_400_000;

export function xpToNextLevel(content: ContentPack, level: number): number {
  // Plan A2: compounding up to xpGrowthUntil, then a linear extra factor (finite, exact).
  const { xpBase, xpExponent, xpGrowth, xpGrowthUntil, xpLinearAfter } = content.config.levels;
  const compound = Math.pow(xpGrowth, Math.min(level - 1, xpGrowthUntil));
  const linear = 1 + xpLinearAfter * Math.max(0, level - 1 - xpGrowthUntil);
  return Math.round(xpBase * Math.pow(level, xpExponent) * compound * linear);
}

/** What reaching `level` pays (owner decision 2026-11-17: grows with the level, no cap). */
export function levelUpReward(content: ContentPack, level: number): { coins: number; gems: number; items: Record<string, number> } {
  const cfg = content.config.levels.levelUp;
  const items: Record<string, number> = {};
  let gems = 0;
  for (const m of cfg.milestones) {
    if (level % m.every !== 0) continue;
    gems += m.gems ?? 0;
    for (const [id, q] of Object.entries(m.items ?? {})) items[id] = (items[id] ?? 0) + q;
  }
  return { coins: tidyCoins(cfg.coinsHours * content.income.unit(level)), gems, items };
}

/** Adds XP and applies every level-up it causes, paying each level's reward. Returns the levels gained. */
export function addXp(content: ContentPack, state: GameState, amount: number): number[] {
  const gained: number[] = [];
  state.player.xp += amount;
  while (state.player.xp >= xpToNextLevel(content, state.player.level)) {
    state.player.xp -= xpToNextLevel(content, state.player.level);
    state.player.level += 1;
    const r = levelUpReward(content, state.player.level);
    state.player.coins += r.coins;
    state.player.gems += r.gems;
    for (const [id, q] of Object.entries(r.items)) addItem(state, id, q);
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

/** Rương Mây capacity with the bought upgrade tiers. */
export function storageCapacity(content: ContentPack, state: GameState): number {
  return content.config.storageCapacity + content.config.storageUpgrade.perTier * (state.upgrades?.storage ?? 0);
}

/** Coins for the next Rương Mây tier (there is always a next one). */
export function storageUpgradeCost(content: ContentPack, state: GameState): number {
  // Polynomial in the tier (plan A3/A5: finite and exact even at tier 10 000).
  const u = content.config.storageUpgrade;
  return tidyCoins(u.firstCost * Math.pow((state.upgrades?.storage ?? 0) + 1, u.costExponent));
}

const tidyCoins = tidy;

export function storageFree(content: ContentPack, state: GameState): number {
  return storageCapacity(content, state) - storageUsed(content, state);
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
  // Bổ sung A6.5: today's hot crop sells for more.
  return Math.max(1, Math.round(item.sellPrice * factor * hotSellFactor(content, state, itemId, now)));
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
