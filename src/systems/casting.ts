// Chỉ thị 10 § 3.8 (M7): casting pots at the Lò Gốm. Minerals (Biển Mây), Ngọc Mây (Máy Mài Ngọc)
// and coins make one chosen pot of the "crafted" group — rarer minerals for rarer pots (one recipe
// tier per rarity in casting.json). 10% of casts come out "Hoàn Mỹ": a pot with one star (every stat a
// little higher). Deterministic: the roll is keyed on the save's seed and its id counter.

import type { ContentPack, PotDef } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { grantPot } from './pots.ts';
import { removeItem } from './economy.ts';

export type CastError = 'level_not_open' | 'unknown_pot' | 'not_castable' | 'locked' | 'not_enough_coins' | 'not_enough_items';

/** The recipe tier for a pot (null when it cannot be cast). */
export function castRecipe(content: ContentPack, def: PotDef): { coins: number; items: Record<string, number> } | null {
  if (!content.casting || def.group !== 'crafted') return null;
  const t = content.casting.tiers.find((x) => x.rarity === def.rarity);
  return t ? { coins: t.coins, items: t.items } : null;
}

/** Pots the player can cast now (crafted group, unlocked by level). */
export function castablePots(content: ContentPack, level: number): PotDef[] {
  return content.potList.filter((p) => p.group === 'crafted' && p.unlockLevel <= level && castRecipe(content, p));
}

export function castPot(content: ContentPack, state: GameState, potId: string, now: number): CastError | { potInstanceId: string; perfect: boolean } {
  const rules = content.casting;
  if (!rules || state.player.level < rules.unlockLevel) return 'level_not_open';
  const def = content.pots.get(potId);
  if (!def) return 'unknown_pot';
  const recipe = castRecipe(content, def);
  if (!recipe) return 'not_castable';
  if (def.unlockLevel > state.player.level) return 'locked';
  if (state.player.coins < recipe.coins) return 'not_enough_coins';
  for (const [id, q] of Object.entries(recipe.items)) if ((state.inventory[id] ?? 0) < q) return 'not_enough_items';
  state.player.coins -= recipe.coins;
  for (const [id, q] of Object.entries(recipe.items)) removeItem(state, id, q);
  const perfect = randomFor(state.seed, 'cast', state.nextId) < rules.perfectChance;
  const potInstanceId = grantPot(state, potId, 'cast', now);
  if (perfect) state.pots[potInstanceId]!.stars = rules.perfectStars;
  return { potInstanceId, perfect };
}
