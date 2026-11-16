// Growth is a pure function of time: nothing ticks. A crop planted 8 hours ago is computed as
// 8 hours old the moment the game reopens, which is how offline progress stays exact.

import type { BugDef, ContentPack, CropDef } from '../core/content.ts';
import type { GameState, Planting, SlotState } from '../core/state.ts';
import { randomFor, stochasticRound } from '../core/rng.ts';
import { slotBonus } from './modifiers.ts';

/** In a regrow cycle the crop restarts from this stage (the "grown, no fruit" stage). */
export const REGROW_FROM_STAGE = 2;
/** Bugs land somewhere between these fractions of a cycle's growth (never on a fresh seed). */
const BUG_ARRIVAL_FROM = 0.25;
const BUG_ARRIVAL_TO = 0.95;

export interface CropStatus {
  crop: CropDef;
  /** 0..stages-1; the last stage means ripe. */
  stage: number;
  ripe: boolean;
  progress: number;
  cycleMs: number;
  remainingMs: number;
  readyAt: number;
  thirsty: boolean;
  /** Bọ Mây currently on the plant (they stay until caught or harvested). */
  bug: { bug: BugDef; count: number } | null;
  isRegrow: boolean;
}

export function cycleDurationMs(content: ContentPack, state: GameState, slot: SlotState, planting: Planting): number {
  const crop = content.crops.get(planting.cropId);
  if (!crop) throw new Error(`Không có cây ${planting.cropId}`);
  const pot = state.pots[slot.potInstanceId];
  if (!pot) throw new Error(`Không có chậu ${slot.potInstanceId}`);
  const base = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  const speed = Math.min(slotBonus(content, state, slot, crop, 'speed'), 0.9);
  return base * 1000 * (1 - speed);
}

function firstStageOfCycle(planting: Planting): number {
  return planting.harvestsDone === 0 ? 0 : REGROW_FROM_STAGE;
}

function stageAt(crop: CropDef, planting: Planting, progress: number): number {
  const last = crop.stages - 1;
  if (progress >= 1) return last;
  const from = firstStageOfCycle(planting);
  const span = last - from;
  return Math.min(last - 1, from + Math.floor(progress * span));
}

/** Base (unmodified) length of the current cycle in seconds: drives how many Bọ Mây it attracts. */
function baseCycleSeconds(crop: CropDef, planting: Planting): number {
  return planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
}

/**
 * Bọ Mây are attracted by growing time, not by number of stages: a cycle of T seconds brings
 * on average T / growSecondsPerBug bugs (capped). Each bug lands at a fixed point of the
 * cycle's growth progress and stays until caught or until the harvest. Because arrival is
 * tied to progress, watering (which only moves progress forward) can never remove a bug.
 */
export function bugsInCycle(state: GameState, bug: BugDef, crop: CropDef, planting: Planting, attract = 0): number {
  const expected = Math.min(bug.maxPerCycle, (baseCycleSeconds(crop, planting) / bug.growSecondsPerBug) * (1 + attract));
  return stochasticRound(expected, state.seed, 'bug', bug.id, planting.id, planting.harvestsDone);
}

function arrivedBugs(state: GameState, bug: BugDef, crop: CropDef, planting: Planting, progress: number, attract: number): number {
  const total = bugsInCycle(state, bug, crop, planting, attract);
  let arrived = 0;
  for (let i = 0; i < total; i++) {
    const at = BUG_ARRIVAL_FROM + randomFor(state.seed, 'bugAt', bug.id, planting.id, planting.harvestsDone, i) * (BUG_ARRIVAL_TO - BUG_ARRIVAL_FROM);
    if (progress >= at) arrived += 1;
  }
  return arrived;
}

function visibleBug(content: ContentPack, state: GameState, slot: SlotState, crop: CropDef, planting: Planting, progress: number) {
  const attract = slotBonus(content, state, slot, crop, 'attract');
  for (const bug of content.bugList) {
    const count = arrivedBugs(state, bug, crop, planting, progress, attract) - (planting.caughtBugs[bug.id] ?? 0);
    if (count > 0) return { bug, count };
  }
  return null;
}

export function cropStatus(content: ContentPack, state: GameState, slot: SlotState, now: number): CropStatus | null {
  const planting = slot.planting;
  if (!planting) return null;
  const crop = content.crops.get(planting.cropId);
  if (!crop) throw new Error(`Không có cây ${planting.cropId}`);
  const cycleMs = cycleDurationMs(content, state, slot, planting);
  const elapsed = Math.max(0, now - planting.cycleStartedAt) + planting.bonusMs;
  const progress = Math.min(1, elapsed / cycleMs);
  const stage = stageAt(crop, planting, progress);
  const ripe = progress >= 1;
  const remainingMs = Math.max(0, cycleMs - elapsed);
  return {
    crop,
    stage,
    ripe,
    progress,
    cycleMs,
    remainingMs,
    readyAt: now + remainingMs,
    thirsty: !ripe && !planting.wateredStages.includes(stage),
    bug: visibleBug(content, state, slot, crop, planting, progress),
    isRegrow: planting.harvestsDone > 0,
  };
}
