// Chỉ thị 12 TỔNG B7.2: pot shards and pot stars. A pot of a kind the player already owns, when it
// comes from a luck source (Chợ, Biển Mây, events, quests — potStars.convertSources), turns into that
// kind's shards instead, so a repeat is never junk. Shards raise a pot's stars (★0 → ★5, each star
// adds casting.starStatBonus to its main stats) or, enough of them, are put together into a new pot.
// Pots bought at the Lò Gốm, cast or exchanged are the player's own choice and always come whole.

import { shardId, type ContentPack } from '../core/content.ts';
import type { GameState, PotInstance } from '../core/state.ts';
import { addItem, removeItem } from './economy.ts';
import { grantPot } from './pots.ts';

export type PotStarError = 'unknown_pot' | 'pot_max_stars' | 'not_enough_items' | 'locked';

export function ownsPotKind(state: GameState, potId: string): boolean {
  return Object.values(state.pots).some((p) => p.potId === potId);
}

/** Gives a pot from a source; a repeat from a luck source becomes shards. */
export function obtainPot(content: ContentPack, state: GameState, potId: string, source: NonNullable<PotInstance['source']>, now: number): { potInstanceId: string } | { shards: { itemId: string; qty: number } } {
  const ps = content.potStars;
  if (ps && ps.convertSources.includes(source) && ownsPotKind(state, potId)) {
    const shards = { itemId: shardId(potId), qty: ps.duplicateShards };
    addItem(state, shards.itemId, shards.qty);
    return { shards };
  }
  return { potInstanceId: grantPot(state, potId, source, now) };
}

/** Shards to go up one star, or null at the top. */
export function nextStarShards(content: ContentPack, pot: PotInstance): number | null {
  const ps = content.potStars;
  if (!ps) return null;
  const stars = pot.stars ?? 0;
  return stars >= ps.maxStars ? null : (ps.starShards[stars] ?? null);
}

export function starUpPot(content: ContentPack, state: GameState, potInstanceId: string): PotStarError | { stars: number; shards: number } {
  if (!content.potStars) return 'locked';
  const pot = state.pots[potInstanceId];
  if (!pot) return 'unknown_pot';
  const need = nextStarShards(content, pot);
  if (need === null) return 'pot_max_stars';
  const id = shardId(pot.potId);
  if ((state.inventory[id] ?? 0) < need) return 'not_enough_items';
  removeItem(state, id, need);
  pot.stars = (pot.stars ?? 0) + 1;
  return { stars: pot.stars, shards: need };
}

/** Puts combineShards shards of one kind together into a new pot (always a whole pot). */
export function combineShards(content: ContentPack, state: GameState, potId: string, now: number): PotStarError | { potInstanceId: string } {
  const ps = content.potStars;
  if (!ps) return 'locked';
  if (!content.pots.has(potId)) return 'unknown_pot';
  const id = shardId(potId);
  if ((state.inventory[id] ?? 0) < ps.combineShards) return 'not_enough_items';
  removeItem(state, id, ps.combineShards);
  return { potInstanceId: grantPot(state, potId, 'combine', now) };
}
