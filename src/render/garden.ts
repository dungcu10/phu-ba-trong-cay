// What the garden view draws, independent of whose garden it is: the player's own (from the
// simulation) or a neighbour's while visiting (from systems/visit). Pure data, rebuilt cheaply.

import { stolenToday, visitBug } from '../systems/social.ts';
import type { ContentPack, FloorDef, PotDef } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { nextFloor } from '../core/game.ts';
import { cropStatus, type CropStatus } from '../systems/growth.ts';
import { expandCost, floorSets, potTier } from '../systems/floors.ts';
import { potLook } from '../systems/pots.ts';

/** Effect tier and small-step count of a pot at a level: from its line's looks when it has them. */
export function potFx(pot: PotDef, level: number, stars = 0): { tier: 0 | 1 | 2; step: number } {
  const { look, step } = potLook(pot, level);
  const fx = look ? { tier: look.aura, step } : { tier: potTier(level, pot.levels.length), step: 0 };
  // Chỉ thị 12 B7: pot stars light the pot too — a glow from ★1, the orbiting sparkles from ★3.
  const starTier = stars >= 3 ? 2 : stars >= 1 ? 1 : 0;
  return { tier: Math.max(fx.tier, starTier) as 0 | 1 | 2, step: fx.step };
}
import { botGarden } from '../systems/visit.ts';
import { petWorking, speciesDef } from '../systems/pets.ts';

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
  /** Chỉ thị 11 § E: pets looking after this floor (frame prefix + pose names; asleep when not working). */
  pets: GardenPet[];
}

export interface GardenPet {
  species: string;
  art: string;
  poses: Record<'stand' | 'run' | 'sleep' | 'happy', string>;
  asleep: boolean;
}

function floorPets(content: ContentPack, state: GameState, fi: number, now: number): GardenPet[] {
  return state.pets
    .filter((p) => p.active && p.floor === fi && (p.awayUntil === null || p.awayUntil <= now))
    .map((p) => {
      const sp = speciesDef(content, p.species)!;
      return { species: p.species, art: sp.art, poses: sp.poses, asleep: !petWorking(content, p, now) };
    });
}

export interface GardenModel {
  mode: 'home' | 'visit';
  floors: GardenFloor[];
  /** Next floor to unlock (own garden only). */
  locked: FloorDef | null;
}

export function homeGarden(content: ContentPack, state: GameState, now: number): GardenModel {
  const floors = state.floors.map((floor, fi) => {
    const def = content.floors.get(floor.floorId)!;
    const best = floorSets(content, state, floor).find((a) => a.tier >= 0);
    return {
      def,
      stars: floor.stars,
      expandCost: expandCost(def, floor, content, state.player.level),
      setName: best ? best.set.name.vi : null,
      pets: floorPets(content, state, fi, now),
      pots: floor.slots.map((slot) => {
        const inst = state.pots[slot.potInstanceId]!;
        const pot = content.pots.get(inst.potId)!;
        return { pot, level: inst.level, ...potFx(pot, inst.level, inst.stars ?? 0), status: cropStatus(content, state, slot, now) };
      }),
    };
  });
  return { mode: 'home', floors, locked: nextFloor(content, state) };
}

export function visitGarden(content: ContentPack, state: GameState, botId: string, now: number): GardenModel {
  const bug = content.bugList[0]!;
  // A neighbour's own pets (chỉ thị 11 § I), the ones at home, one per lower floor; asleep when hungry.
  const own = (state.neighbors[botId]?.pets ?? []).filter((p) => (p.awayUntil ?? 0) <= now);
  const species = own.map((p) => ({ def: speciesDef(content, p.species)!, asleep: !petWorking(content, { ...p, active: true }, now) })).filter((x) => x.def);
  const stolen = stolenToday(content, state, botId, now);
  const floors = botGarden(content, state, botId, now).map((f, fi) => ({
    def: f.def,
    stars: f.stars,
    expandCost: null,
    setName: null,
    pets: fi < species.length ? [{ species: species[fi]!.def.id, art: species[fi]!.def.art, poses: species[fi]!.def.poses, asleep: species[fi]!.asleep }] : [],
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
        bug: p.need === 'bug' ? { bug: content.bugs.get(visitBug(content, state, botId, p, now)) ?? bug, count: 1 } : null,
        isRegrow: false,
        ...(stolen.has(p.key) ? { stolen: true } : {}),
      };
      return { pot: p.pot, level: p.level, ...potFx(p.pot, p.level), status };
    }),
  }));
  return { mode: 'visit', floors, locked: null };
}
