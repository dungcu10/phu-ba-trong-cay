// Chỉ thị 12 TỔNG A3: coin sinks that grow with the player's level. Each price keeps its old base and
// adds factor × U(player level) coins, the factor read from market.json levelPricing (0 = old price).
// The CTO tunes the factors by simulation so held coins stay at 1–5 × U.

import type { ContentPack, FloorDef, LevelPricing } from '../core/content.ts';
import { tidy } from '../core/income.ts';

type Key = Exclude<keyof LevelPricing, 'castingU' | 'decorU'> | 'decorU';

/** Extra coins for one sink at this player level. */
export function levelCoins(content: ContentPack, key: Key | { casting: string }, level: number): number {
  const lp = content.market?.levelPricing;
  if (!lp) return 0;
  const f = typeof key === 'string' ? (lp[key] ?? 0) : (lp.castingU?.[key.casting] ?? 0);
  return f > 0 ? tidy(f * content.income.unit(level)) : 0;
}

/** Coins to open this floor for a player of this level. */
export function floorUnlockCost(content: ContentPack, def: FloorDef, level: number): number {
  return def.unlockCost + levelCoins(content, 'floorUnlockU', level);
}
