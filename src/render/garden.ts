// What the garden view draws, independent of whose garden it is: the player's own (from the
// simulation) or a neighbour's while visiting (from systems/visit). Pure data, rebuilt cheaply.

import type { ContentPack, FloorDef, PotDef } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { nextFloor } from '../core/game.ts';
import { cropStatus, type CropStatus } from '../systems/growth.ts';
import { expandCost, floorSets, potTier } from '../systems/floors.ts';
import { potLook } from '../systems/pots.ts';

/** Effect tier and small-step count of a pot at a level: from its line's looks when it has them. */
export function potFx(pot: PotDef, level: number): { tier: 0 | 1 | 2; step: number } {
  const { look, step } = potLook(pot, level);
  return look ? { tier: look.aura, step } : { tier: potTier(level, pot.levels.length), step: 0 };
}
import { botGarden } from '../systems/visit.ts';

export interface GardenPot {
  pot: PotDef;
  level: number;
  tier: 0 | 1 | 2;
  /** Small evolution steps since the current look started (POT_SYSTEM 2). */
  step: number;
  status: CropStatus | null;
}

export interface GardenFloor {
  def: FloorDef;
  stars: number;
  pots: GardenPot[];
  /** Coins for the next slot (own garden only), null = cannot expand. */
  expandCost: number | null;
  /** Name of the best completed set on this floor, for the floor sign. */
  setName: string | null;
}

export interface GardenModel {
  mode: 'home' | 'visit';
  floors: GardenFloor[];
  /** Next floor to unlock (own garden only). */
  locked: FloorDef | null;
}

export function homeGarden(content: ContentPack, state: GameState, now: number): GardenModel {
  const floors = state.floors.map((floor) => {
    const def = content.floors.get(floor.floorId)!;
    const best = floorSets(content, state, floor).find((a) => a.tier >= 0);
    return {
      def,
      stars: floor.stars,
      expandCost: expandCost(def, floor),
      setName: best ? best.set.name.vi : null,
      pots: floor.slots.map((slot) => {
        const inst = state.pots[slot.potInstanceId]!;
        const pot = content.pots.get(inst.potId)!;
        return { pot, level: inst.level, ...potFx(pot, inst.level), status: cropStatus(content, state, slot, now) };
      }),
    };
  });
  return { mode: 'home', floors, locked: nextFloor(content, state) };
}

export function visitGarden(content: ContentPack, state: GameState, botId: string, now: number): GardenModel {
  const bug = content.bugList[0]!;
  const floors = botGarden(content, state, botId, now).map((f) => ({
    def: f.def,
    stars: f.stars,
    expandCost: null,
    setName: null,
    pots: f.pots.map((p) => {
      const cycleMs = p.crop.growSeconds * 1000;
      const status: CropStatus = {
        crop: p.crop,
        stage: p.stage,
        ripe: p.ripe,
        progress: Math.min(1, p.progress / 0.85),
        cycleMs,
        remainingMs: p.remainingMs,
        readyAt: now + p.remainingMs,
        thirsty: p.need === 'water',
        bug: p.need === 'bug' ? { bug, count: 1 } : null,
        isRegrow: false,
      };
      return { pot: p.pot, level: p.level, ...potFx(p.pot, p.level), status };
    }),
  }));
  return { mode: 'visit', floors, locked: null };
}
