// Endless cloud floors (owner decision 2026-11-17: no top floor, each floor asks more).
//
// The hand-made floors in floors.json come first. Every floor above them is generated from the
// `floorGen` rule in config.json: name, colour, sprite and family trait cycle through lists, and
// the level, coins, slot costs and floor stars grow with the floor number. A generated floor's id
// is `base:floor.gen-<number>` (number counts from 1 at the bottom), so saves only store ids and
// the same floor comes back after a reload. Definitions are created on first use and cached, so
// the same object is returned every time (the renderer compares floors by identity).

import type { CropDef, FloorDef, PotStatName } from './content.ts';

export interface FloorGenConfig {
  /** Name stems, used in order; after the list runs out a cycle number is appended ("… II"). */
  names: string[];
  sprites: string[];
  tints: string[];
  traits: Array<{ family: string; stat: PotStatName }>;
  /** Trait strength: base + perFloor × k, at most max (k = 0 for the first generated floor). */
  traitValue: { base: number; perFloor: number; max: number };
  /** Level needed: firstLevel + levelStep × k + levelStepGrowth × k(k-1)/2. */
  firstLevel: number;
  levelStep: number;
  levelStepGrowth: number;
  /** Coins to unlock: firstCost × costGrowth^k, rounded to a tidy number. */
  firstCost: number;
  costGrowth: number;
  slotCount: number;
  maxSlots: number;
  /** Each extra slot costs this fraction of the floor's unlock cost. */
  expandFactors: number[];
  startingPot: string;
  /** Floor stars: level above the unlock level, coins as a fraction of the unlock cost, and
   *  produce of the newest crop unlocked by then (qty + qtyPerFloor × k). */
  stars: Array<{ levelOffset: number; costFactor: number; qty: number; qtyPerFloor: number }>;
}

export const GEN_PREFIX = 'base:floor.gen-';

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** Rounds to 2 significant figures so prices read well (12 345 → 12 000). */
export function tidy(n: number): number {
  if (n < 100) return Math.round(n);
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

/** Floor number (1-based) of a generated id, or null. */
export function genFloorNumber(id: string): number | null {
  if (!id.startsWith(GEN_PREFIX)) return null;
  const n = Number(id.slice(GEN_PREFIX.length));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function makeGeneratedFloor(gen: FloorGenConfig, handCount: number, crops: CropDef[], number: number): FloorDef {
  const k = number - handCount - 1;
  const cycle = Math.floor(k / gen.names.length);
  const stem = gen.names[k % gen.names.length]!;
  const name = cycle === 0 ? stem : `${stem}${ROMAN[cycle] ?? ` ${cycle + 1}`}`;
  const unlockLevel = Math.round(gen.firstLevel + gen.levelStep * k + (gen.levelStepGrowth * k * (k - 1)) / 2);
  const unlockCost = tidy(gen.firstCost * Math.pow(gen.costGrowth, k));
  const trait = gen.traits[k % gen.traits.length]!;
  const newestBy = (level: number) => [...crops].filter((c) => c.unlockLevel <= level).sort((a, b) => b.unlockLevel - a.unlockLevel);
  return {
    id: `${GEN_PREFIX}${number}`,
    name: { vi: name },
    unlockLevel,
    unlockCost,
    slotCount: gen.slotCount,
    maxSlots: gen.maxSlots,
    expandCosts: gen.expandFactors.slice(0, gen.maxSlots - gen.slotCount).map((f) => tidy(unlockCost * f)),
    startingPot: gen.startingPot,
    sprite: gen.sprites[k % gen.sprites.length]!,
    tint: gen.tints[k % gen.tints.length],
    trait: { family: trait.family, stat: trait.stat, value: Math.min(gen.traitValue.max, Math.round((gen.traitValue.base + gen.traitValue.perFloor * k) * 100) / 100) },
    stars: gen.stars.map((st, j) => {
      const level = unlockLevel + st.levelOffset;
      const pool = newestBy(level);
      const crop = pool[j % Math.max(1, Math.min(3, pool.length))] ?? pool[0];
      return { level, coins: tidy(unlockCost * st.costFactor), items: crop ? { [crop.produce.id]: st.qty + st.qtyPerFloor * k } : {} };
    }),
  };
}

/**
 * Floors by id. Hand-made floors are stored; generated ones (`base:floor.gen-N`, N above the
 * hand-made count) are created on first lookup and kept.
 */
export class FloorMap extends Map<string, FloorDef> {
  constructor(
    entries: Iterable<[string, FloorDef]>,
    private readonly gen: FloorGenConfig,
    private readonly handCount: number,
    private readonly crops: CropDef[],
  ) {
    super(entries);
  }

  override get(id: string): FloorDef | undefined {
    const hit = super.get(id);
    if (hit) return hit;
    const n = genFloorNumber(id);
    if (n === null || n <= this.handCount) return undefined;
    const def = makeGeneratedFloor(this.gen, this.handCount, this.crops, n);
    super.set(id, def);
    return def;
  }

  override has(id: string): boolean {
    return this.get(id) !== undefined;
  }
}

/** The floor at bottom-to-top position `index` (0 = first floor), hand-made or generated. */
export function floorAtIndex(floors: Map<string, FloorDef>, floorList: FloorDef[], index: number): FloorDef {
  if (index < floorList.length) return floorList[index]!;
  return floors.get(`${GEN_PREFIX}${index + 1}`)!;
}
