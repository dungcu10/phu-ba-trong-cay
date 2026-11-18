// Growth is a pure function of time: nothing ticks. A crop planted 8 hours ago is computed as
// 8 hours old the moment the game reopens, which is how offline progress stays exact.

import type { BugDef, ContentPack, CropDef } from '../core/content.ts';
import type { GameState, Planting, SlotState } from '../core/state.ts';
import { randomFor, stochasticRound } from '../core/rng.ts';
import { floorOfSlot, slotBonus } from './modifiers.ts';
import { cropNightGrowth } from './cropExtras.ts';

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
  /** Chỉ thị 12 B4: a neighbour's pot the player already stole from today (footprints). */
  stolen?: boolean;
}

export function cycleDurationMs(content: ContentPack, state: GameState, slot: SlotState, planting: Planting): number {
  const crop = content.crops.get(planting.cropId);
  if (!crop) throw new Error(`Không có cây ${planting.cropId}`);
  const pot = state.pots[slot.potInstanceId];
  if (!pot) throw new Error(`Không có chậu ${slot.potInstanceId}`);
  const base = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  // Capped by config.bonusCaps.speed (plan A4), so a crop is never instant from stats alone.
  const speed = Math.min(slotBonus(content, state, slot, crop, 'speed'), 0.95);
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

/** The bug whose numbers set how many bugs a cycle attracts (the first bug, Bọ Rùa Mây). */
function countRule(content: ContentPack): BugDef {
  return content.bugList[0]!;
}

/**
 * Bọ Mây are attracted by growing time, not by number of stages: a cycle of T seconds brings
 * on average T / growSecondsPerBug bugs (capped). Each bug lands at a fixed point of the
 * cycle's growth progress and stays until caught or until the harvest. Because arrival is
 * tied to progress, watering (which only moves progress forward) can never remove a bug.
 * Chỉ thị 10 § 3.2: this count rule is unchanged (same keys, so old saves see the same bugs);
 * each arriving bug then gets a kind, picked by the crop's weights.
 */
export function bugsInCycle(state: GameState, bug: BugDef, crop: CropDef, planting: Planting, attract = 0): number {
  const expected = Math.min(bug.maxPerCycle!, (baseCycleSeconds(crop, planting) / bug.growSecondsPerBug!) * (1 + attract));
  return stochasticRound(expected, state.seed, 'bug', bug.id, planting.id, planting.harvestsDone);
}

/** Hour of the day (0–24) in the game's local time. */
export function localHour(content: ContentPack, at: number): number {
  const ms = at + content.missions.utcOffsetHours * 3_600_000;
  return (((ms % 86_400_000) + 86_400_000) % 86_400_000) / 3_600_000;
}

/** Night in the game's local time (Đom Đóm Sao, Cú Mèo Đêm, Vườn Trăng). */
export function isNight(content: ContentPack, at: number): boolean {
  const h = localHour(content, at);
  const n = content.config.night ?? { from: 19, to: 6 };
  return h >= n.from || h < n.to;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Milliseconds of night (game local time) between two moments. */
export function nightMs(content: ContentPack, from: number, to: number): number {
  if (to <= from) return 0;
  const off = content.missions.utcOffsetHours * HOUR_MS;
  const n = content.config.night ?? { from: 19, to: 6 };
  let total = 0;
  const first = Math.floor((from + off) / DAY_MS) - 1;
  const last = Math.floor((to + off) / DAY_MS);
  for (let d = first; d <= last; d++) {
    const start = d * DAY_MS - off;
    // Night of local day d: [d + from h, d + 24 h + to h).
    const a = Math.max(from, start + n.from * HOUR_MS);
    const b = Math.min(to, start + (24 + n.to) * HOUR_MS);
    if (b > a) total += b - a;
  }
  return total;
}

/** Growth time counted between two moments on a floor that grows faster at night. */
function grownMs(content: ContentPack, nightSpeed: number, from: number, to: number): number {
  const real = Math.max(0, to - from);
  return nightSpeed > 0 ? real + nightSpeed * nightMs(content, from, to) : real;
}

/** First moment the growth time since `from` reaches `target` (exact to the millisecond). */
function reachedAt(content: ContentPack, nightSpeed: number, from: number, target: number): number {
  if (nightSpeed <= 0) return from + target;
  // Integer bisection on whole milliseconds: lo never reaches the target, hi always does.
  let lo = Math.floor(from + target / (1 + nightSpeed)) - 1;
  let hi = Math.ceil(from + target);
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (grownMs(content, nightSpeed, from, mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Weight multiplier for a bug on a floor (Vườn Trăng: Đom Đóm Sao twice as often). */
export type BugBoost = (bugId: string) => number;

/**
 * Kind of arriving bug number i of the current cycle, deterministic: a weighted pick among the crop's
 * bugs that are unlocked at the planting's level; night-only bugs only when the bug arrives at night.
 */
export function bugKind(content: ContentPack, state: GameState, crop: CropDef, planting: Planting, i: number, at: number, boost?: BugBoost): BugDef {
  const first = countRule(content);
  if (planting.bugLevel === undefined) return first;
  const night = isNight(content, planting.cycleStartedAt + at * baseCycleSeconds(crop, planting) * 1000);
  const pool: Array<{ bug: BugDef; w: number }> = [];
  for (const b of crop.bugs) {
    const def = content.bugs.get(b.id);
    if (!def || def.unlockLevel > planting.bugLevel) continue;
    if (def.nightOnly && !night) continue;
    pool.push({ bug: def, w: b.weight * (boost ? boost(def.id) : 1) });
  }
  if (pool.length === 0) return first;
  const total = pool.reduce((a, p) => a + p.w, 0);
  let r = randomFor(state.seed, 'bugKind', planting.id, planting.harvestsDone, i) * total;
  for (const p of pool) {
    r -= p.w;
    if (r < 0) return p.bug;
  }
  return pool[pool.length - 1]!.bug;
}

/** Bugs that have arrived by `progress`, in arrival order. */
export function arrivals(content: ContentPack, state: GameState, crop: CropDef, planting: Planting, progress: number, attract: number, boost?: BugBoost): BugDef[] {
  const rule = countRule(content);
  const total = bugsInCycle(state, rule, crop, planting, attract);
  const list: Array<{ at: number; bug: BugDef }> = [];
  for (let i = 0; i < total; i++) {
    const at = BUG_ARRIVAL_FROM + randomFor(state.seed, 'bugAt', rule.id, planting.id, planting.harvestsDone, i) * (BUG_ARRIVAL_TO - BUG_ARRIVAL_FROM);
    if (progress >= at) list.push({ at, bug: bugKind(content, state, crop, planting, i, at, boost) });
  }
  return list.sort((a, b) => a.at - b.at).map((x) => x.bug);
}

/** Bugs on the plant now: per kind, arrived minus caught. The first kind (in arrival order) is shown. */
export function bugsOnPlant(content: ContentPack, state: GameState, slot: SlotState, crop: CropDef, planting: Planting, progress: number, boost?: BugBoost): Array<{ bug: BugDef; count: number }> {
  const attract = slotBonus(content, state, slot, crop, 'attract');
  const arrived = arrivals(content, state, crop, planting, progress, attract, boost);
  const left = new Map<string, { bug: BugDef; count: number }>();
  for (const b of arrived) {
    const e = left.get(b.id) ?? { bug: b, count: 0 };
    e.count += 1;
    left.set(b.id, e);
  }
  const out: Array<{ bug: BugDef; count: number }> = [];
  for (const e of left.values()) {
    const n = e.count - (planting.caughtBugs[e.bug.id] ?? 0);
    if (n > 0) out.push({ bug: e.bug, count: n });
  }
  return out;
}

function visibleBug(content: ContentPack, state: GameState, slot: SlotState, crop: CropDef, planting: Planting, progress: number, boost?: BugBoost) {
  return bugsOnPlant(content, state, slot, crop, planting, progress, boost)[0] ?? null;
}

export function cropStatus(content: ContentPack, state: GameState, slot: SlotState, now: number, boost?: BugBoost): CropStatus | null {
  const planting = slot.planting;
  if (!planting) return null;
  const crop = content.crops.get(planting.cropId);
  if (!crop) throw new Error(`Không có cây ${planting.cropId}`);
  const cycleMs = cycleDurationMs(content, state, slot, planting);
  // Chỉ thị 10 § 3.1: the floor's night growth bonus and bug weights (Vườn Trăng Lơ Lửng).
  const floorDef = (() => {
    const f = floorOfSlot(state, slot);
    return f ? content.floors.get(f.floorId) : undefined;
  })();
  // Floor (Vườn Trăng) and crop (Hoa Trăng Non, A6.1) night bonuses add up.
  const nightSpeed = (floorDef?.nightSpeed ?? 0) + cropNightGrowth(content, crop.id);
  const floorBoost = floorDef?.bugBoost;
  if (!boost && floorBoost) boost = (id) => floorBoost[id] ?? 1;
  // Real time already covers the cycle: ripe, no need to count the night bonus (it can only add).
  const real = Math.max(0, now - planting.cycleStartedAt) + planting.bonusMs;
  const elapsed = real >= cycleMs ? real : grownMs(content, nightSpeed, planting.cycleStartedAt, now) + planting.bonusMs;
  const progress = Math.min(1, elapsed / cycleMs);
  const stage = stageAt(crop, planting, progress);
  const ripe = progress >= 1;
  const remainingMs = ripe ? 0 : Math.max(0, reachedAt(content, nightSpeed, planting.cycleStartedAt, cycleMs - planting.bonusMs) - now);
  return {
    crop,
    stage,
    ripe,
    progress,
    cycleMs,
    remainingMs,
    readyAt: now + remainingMs,
    thirsty: !ripe && !planting.wateredStages.includes(stage),
    bug: visibleBug(content, state, slot, crop, planting, progress, boost),
    isRegrow: planting.harvestsDone > 0,
  };
}
