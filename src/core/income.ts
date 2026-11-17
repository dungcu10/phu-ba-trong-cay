// Income unit U(L) (kế hoạch v3, mục A1): coins a diligent player earns in one hour of play at
// level L. Every price and reward that must keep pace with endless levels and floors is written
// as "hours of income" × U(L), so adding crops, floors or pots rescales them all at once.
//
// U(L) = best crop's coins per pot-hour at L (visiting every `visitMinutes`)
//        × pots expected at L (floors open by L × potsPerFloor)
//        × (1 + potBonus)
// Floors counted are the hand-made ones and the generated ones whose level is ≤ L, using only
// their unlock *levels*, so U never depends on floor prices (no circularity).

import type { CropDef, FloorDef } from './content.ts';

export interface IncomeConfig {
  /** Gap between visits assumed for a diligent player. */
  visitMinutes: number;
  /** Average pots per open floor. */
  potsPerFloor: number;
  /** Average pot, floor and set bonus on earnings. */
  potBonus: number;
}

/** Floors above the hand-made ones unlock at firstLevel + levelStep·k + levelStepGrowth·k(k−1)/2. */
export interface FloorLevelRule {
  firstLevel: number;
  levelStep: number;
  levelStepGrowth: number;
}

export function generatedFloorLevel(rule: FloorLevelRule, k: number): number {
  return Math.round(rule.firstLevel + rule.levelStep * k + (rule.levelStepGrowth * k * (k - 1)) / 2);
}

/** Coins per pot per hour of one crop when the player comes back every `visitMinutes`. */
export function cropCoinsPerPotHour(crop: CropDef, visitMinutes: number): number {
  const gap = visitMinutes * 60;
  const first = Math.max(crop.growSeconds, gap);
  const regrow = Math.max(crop.regrowSeconds ?? crop.growSeconds, gap);
  const seconds = first + (crop.harvests - 1) * regrow;
  return ((crop.sellPrice * crop.yield * crop.harvests - crop.seedPrice) / seconds) * 3600;
}

/** Floors a player can have open at level L (hand-made + generated). */
export function floorsOpenAt(handFloors: FloorDef[], rule: FloorLevelRule, level: number): number {
  let n = handFloors.filter((f) => f.unlockLevel <= level).length;
  for (let k = 0; generatedFloorLevel(rule, k) <= level; k++) n++;
  return n;
}

export class IncomeModel {
  private readonly cache = new Map<number, number>();

  constructor(
    private readonly cfg: IncomeConfig,
    private readonly crops: CropDef[],
    private readonly handFloors: FloorDef[],
    private readonly floorRule: FloorLevelRule,
  ) {}

  /** U(L): coins per hour of diligent play at level L (≥ 1, finite, never decreasing in L). */
  unit(level: number): number {
    const L = Math.max(1, Math.floor(level));
    const hit = this.cache.get(L);
    if (hit !== undefined) return hit;
    const best = Math.max(0, ...this.crops.filter((c) => c.unlockLevel <= L).map((c) => cropCoinsPerPotHour(c, this.cfg.visitMinutes)));
    const pots = floorsOpenAt(this.handFloors, this.floorRule, L) * this.cfg.potsPerFloor;
    const u = Math.max(1, best * pots * (1 + this.cfg.potBonus));
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(L, u);
    return u;
  }
}

/** Rounds prices so they read well: 2 significant figures below 100 000 (12 345 → 12 000),
 *  3 below 10 million, then to the thousand, so neighbouring prices far up still differ. */
export function tidy(n: number): number {
  if (!Number.isFinite(n) || n < 100) return Math.round(n);
  if (n >= 10_000_000) return Math.round(n / 1000) * 1000;
  const digits = n < 100_000 ? 2 : 3;
  const p = Math.pow(10, Math.floor(Math.log10(n)) - (digits - 1));
  return Math.round(n / p) * p;
}
