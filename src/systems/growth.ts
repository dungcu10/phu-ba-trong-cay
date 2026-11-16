// Growth is a pure function of time: nothing ticks. A crop planted 8 hours ago is computed as
// 8 hours old the moment the game reopens, which is how offline progress stays exact.

import type { BugDef, ContentPack, CropDef } from '../core/content.ts';
import type { GameState, Planting, SlotState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { potStat } from './pots.ts';

/** In a regrow cycle the crop restarts from this stage (the "grown, no fruit" stage). */
export const REGROW_FROM_STAGE = 2;

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
  bug: { bug: BugDef; stage: number; leavesAt: number } | null;
  isRegrow: boolean;
}

export function cycleDurationMs(content: ContentPack, state: GameState, slot: SlotState, planting: Planting): number {
  const crop = content.crops.get(planting.cropId);
  if (!crop) throw new Error(`Không có cây ${planting.cropId}`);
  const pot = state.pots[slot.potInstanceId];
  if (!pot) throw new Error(`Không có chậu ${slot.potInstanceId}`);
  const base = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  const speed = Math.min(potStat(content, pot, 'speed'), 0.9);
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

/** Real time at which a given growing stage starts in the current cycle. */
function stageStartsAt(crop: CropDef, planting: Planting, stage: number, cycleMs: number): number {
  const from = firstStageOfCycle(planting);
  const span = crop.stages - 1 - from;
  const progressAtStart = (stage - from) / span;
  return planting.cycleStartedAt - planting.bonusMs + progressAtStart * cycleMs;
}

function visibleBug(content: ContentPack, state: GameState, crop: CropDef, planting: Planting, stage: number, cycleMs: number, now: number) {
  for (const bug of content.bugList) {
    if (planting.caughtBugStages.includes(stage)) return null;
    const roll = randomFor(state.seed, 'bug', bug.id, planting.id, planting.harvestsDone, stage);
    if (roll >= bug.chancePerStage) continue;
    const arrivesAt = stageStartsAt(crop, planting, stage, cycleMs);
    const leavesAt = arrivesAt + bug.lingerSeconds * 1000;
    if (now >= arrivesAt && now < leavesAt) return { bug, stage, leavesAt };
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
    bug: ripe ? null : visibleBug(content, state, crop, planting, stage, cycleMs, now),
    isRegrow: planting.harvestsDone > 0,
  };
}
