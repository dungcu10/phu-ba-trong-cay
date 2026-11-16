// Surprises on harvest (owner decision 2026-11-16, part 3): rare mutated produce, small gifts
// (coins, Ngọc Mây, Bọ Mây) and the plant journal. Every roll is keyed by the planting and the
// harvest number, so results never depend on when or how often the game is opened.

import type { ContentPack, CropDef } from '../core/content.ts';
import type { GameState, Planting } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';

export type Gift = { kind: 'coins' | 'gems' | 'bug'; amount: number; itemId?: string };

/** The mutation of this harvest, if any. Luck multiplies every chance. Rarest is checked first. */
export function rollMutation(content: ContentPack, state: GameState, planting: Planting, luck: number): string | null {
  const muts = [...content.surprises.mutations].sort((a, b) => a.chance - b.chance);
  for (const m of muts) {
    if (randomFor(state.seed, 'mutation', m.id, planting.id, planting.harvestsDone) < m.chance * (1 + luck)) return m.id;
  }
  return null;
}

/** A small gift found while harvesting, or null. The chance grows with the cycle's growing
 *  time, so short crops do not shower gifts (same reasoning as Bọ Mây, review 01 R2). */
export function rollGift(content: ContentPack, state: GameState, planting: Planting, cycleSeconds: number, luck: number): Gift | null {
  const cfg = content.surprises;
  const r = (k: string) => randomFor(state.seed, 'gift', k, planting.id, planting.harvestsDone);
  const chance = Math.min(cfg.giftChanceMax, (cfg.giftChancePer10Min * cycleSeconds) / 600) * (1 + luck);
  if (r('chance') >= chance) return null;
  const total = cfg.gifts.reduce((a, g) => a + g.weight, 0);
  let pick = r('kind') * total;
  const g = cfg.gifts.find((x) => (pick -= x.weight) < 0) ?? cfg.gifts[0]!;
  const span = (g.max ?? 1) - (g.min ?? 1) + 1;
  const n = (g.min ?? 1) + Math.floor(r('amount') * span);
  if (g.kind === 'coins') return { kind: 'coins', amount: (g.perLevel ?? 10) * state.player.level };
  if (g.kind === 'gems') return { kind: 'gems', amount: n };
  return { kind: 'bug', amount: n, itemId: content.bugList[0]?.id ?? '' };
}

export function recordHarvest(state: GameState, crop: CropDef, mutation: string | null): void {
  const e = (state.journal[crop.id] ??= { harvests: 0, mutations: {}, claimed: 0 });
  e.harvests += 1;
  if (mutation) e.mutations[mutation] = (e.mutations[mutation] ?? 0) + 1;
}

/** Next unclaimed journal milestone for a crop, or null when none is reached yet. */
export function nextMilestone(content: ContentPack, state: GameState, cropId: string): { index: number; harvests: number; gems: number } | null {
  const e = state.journal[cropId];
  const { milestones, gems } = content.surprises.journal;
  if (!e || e.claimed >= milestones.length) return null;
  const need = milestones[e.claimed]!;
  if (e.harvests < need) return null;
  return { index: e.claimed, harvests: need, gems: gems[e.claimed] ?? 0 };
}
