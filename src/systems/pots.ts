// Pot stats and upgrades.

import type { ContentPack, PotLevelDef, PotStatName } from '../core/content.ts';
import type { GameState, PotInstance } from '../core/state.ts';

export function potLevelDef(content: ContentPack, pot: PotInstance): PotLevelDef {
  const def = content.pots.get(pot.potId);
  if (!def) throw new Error(`Không có chậu ${pot.potId}`);
  const lv = def.levels[pot.level - 1];
  if (!lv) throw new Error(`Chậu ${pot.potId} không có cấp ${pot.level}`);
  return lv;
}

export function potStat(content: ContentPack, pot: PotInstance, stat: PotStatName): number {
  return potLevelDef(content, pot).stats[stat] ?? 0;
}

export function maxPotLevel(content: ContentPack, potId: string): number {
  return content.pots.get(potId)?.levels.length ?? 0;
}

/** Cost to reach the next level, or null when the pot is already at max level. */
export function nextUpgradeCost(content: ContentPack, pot: PotInstance) {
  const def = content.pots.get(pot.potId);
  const next = def?.levels[pot.level];
  return next?.upgradeCost ?? null;
}

export function canAfford(state: GameState, cost: { coins: number; items: Record<string, number> }): boolean {
  if (state.player.coins < cost.coins) return false;
  return Object.entries(cost.items).every(([id, qty]) => (state.inventory[id] ?? 0) >= qty);
}
