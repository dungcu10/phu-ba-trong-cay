// Floor expansion, floor stars and pot sets (REDESIGN_V2 2.1–2.2).

import type { ContentPack, FloorDef, PotSetDef, PotStatName } from '../core/content.ts';
import type { FloorState, GameState } from '../core/state.ts';

/** Coins to open the next pot slot on this floor, or null when it is fully expanded. */
export function expandCost(def: FloorDef, floor: FloorState): number | null {
  const i = floor.slots.length - def.slotCount;
  if (floor.slots.length >= def.maxSlots || i < 0) return null;
  return def.expandCosts[i] ?? null;
}

/** Requirements of the next star, or null at max stars. */
export function nextStar(def: FloorDef, floor: FloorState) {
  return def.stars[floor.stars] ?? null;
}

/** How many pots of each set stand on a floor. */
export function setCounts(content: ContentPack, state: GameState, floor: FloorState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of floor.slots) {
    const pot = state.pots[slot.potInstanceId];
    const set = pot ? content.pots.get(pot.potId)?.set : null;
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  return counts;
}

export interface ActiveSet {
  set: PotSetDef;
  count: number;
  /** Highest tier reached (index into set.tiers), -1 = none yet. */
  tier: number;
}

export function floorSets(content: ContentPack, state: GameState, floor: FloorState): ActiveSet[] {
  const out: ActiveSet[] = [];
  for (const [id, count] of setCounts(content, state, floor)) {
    const set = content.potSets.get(id);
    if (!set) continue;
    let tier = -1;
    set.tiers.forEach((t, i) => {
      if (count >= t.count) tier = i;
    });
    out.push({ set, count, tier });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Bonus every pot on the floor gets from stars and completed sets. */
export function floorBonus(content: ContentPack, state: GameState, floor: FloorState, stat: PotStatName): number {
  let bonus = (content.config.floorStarBonus?.[stat] ?? 0) * floor.stars;
  for (const a of floorSets(content, state, floor)) if (a.tier >= 0) bonus += a.set.tiers[a.tier]!.stats[stat] ?? 0;
  return bonus;
}

/** Appearance tier of a pot level: 0 Mộc, 1 Tinh (40% of max), 2 Thần (75% of max). */
export function potTier(level: number, maxLevel: number): 0 | 1 | 2 {
  if (maxLevel <= 1) return 0;
  const k = (level - 1) / (maxLevel - 1);
  return k >= 0.75 ? 2 : k >= 0.4 ? 1 : 0;
}

export const POT_TIER_NAMES = ['Mộc', 'Tinh', 'Thần'] as const;
