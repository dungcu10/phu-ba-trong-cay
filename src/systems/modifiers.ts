// Bonuses that apply to a crop growing in a given slot: the pot's stats (stronger when the crop
// is the pot's favoured family), the floor's environment trait (GAMEPLAY_DESIGN 3–4), and the
// floor's stars and completed pot sets (REDESIGN_V2 2.1–2.2).

import type { ContentPack, CropDef, PotStatName } from '../core/content.ts';
import type { FloorState, GameState, SlotState } from '../core/state.ts';
import { potStat } from './pots.ts';
import { floorBonus } from './floors.ts';

export function floorOfSlot(state: GameState, slot: SlotState): FloorState | undefined {
  return state.floors.find((f) => f.slots.includes(slot));
}

export function slotBonus(content: ContentPack, state: GameState, slot: SlotState, crop: CropDef, stat: PotStatName): number {
  const pot = state.pots[slot.potInstanceId];
  let bonus = 0;
  if (pot) {
    const def = content.pots.get(pot.potId);
    const affinity = def?.favoredFamily === crop.family ? 1 + content.config.potAffinityBonus : 1;
    bonus += potStat(content, pot, stat) * affinity;
  }
  const floor = floorOfSlot(state, slot);
  const trait = floor ? content.floors.get(floor.floorId)?.trait : null;
  if (trait && trait.family === crop.family && trait.stat === stat) bonus += trait.value;
  if (floor) bonus += floorBonus(content, state, floor, stat);
  // Every source adds up, then the total is capped (POT_SYSTEM 5: no endless stacking).
  const cap = content.config.bonusCaps?.[stat];
  return cap === undefined ? bonus : Math.min(bonus, cap);
}
