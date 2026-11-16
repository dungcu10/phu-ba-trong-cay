// Command processor. Every change to the game goes through dispatch(): the command is validated
// first, and only applied if valid. The player UI and (later) BOTs use exactly this entry point.

import type { ContentPack } from './content.ts';
import type { GameState, SlotState } from './state.ts';
import { adjustedOffset, gameTime } from './clock.ts';
import { stochasticRound } from './rng.ts';
import { cropStatus } from '../systems/growth.ts';
import { addItem, addXp, removeItem, sellPrice, storageFree } from '../systems/economy.ts';
import { canAfford, nextUpgradeCost } from '../systems/pots.ts';
import { slotBonus } from '../systems/modifiers.ts';
import { createFloorState } from './state.ts';

export type SlotRef = { floor: number; slot: number };

export type Command =
  | ({ type: 'plant'; cropId: string } & SlotRef)
  | ({ type: 'water' } & SlotRef)
  | ({ type: 'catchBug' } & SlotRef)
  | ({ type: 'harvest' } & SlotRef)
  | { type: 'sell'; itemId: string; qty: number }
  | { type: 'upgradePot'; potInstanceId: string }
  | { type: 'unlockFloor'; floorId: string }
  | { type: 'buyPot'; potId: string }
  | ({ type: 'placePot'; potInstanceId: string } & SlotRef);

export type GameEvent =
  | { type: 'planted'; slot: SlotRef; cropId: string; cost: number }
  | { type: 'watered'; slot: SlotRef; savedMs: number }
  | { type: 'bugCaught'; slot: SlotRef; itemId: string }
  | { type: 'harvested'; slot: SlotRef; itemId: string; qty: number; xp: number; cleared: boolean }
  | { type: 'sold'; itemId: string; qty: number; coins: number }
  | { type: 'potUpgraded'; potInstanceId: string; level: number }
  | { type: 'levelUp'; level: number }
  | { type: 'floorUnlocked'; floorId: string; index: number; cost: number }
  | { type: 'potBought'; potInstanceId: string; potId: string; cost: number }
  | { type: 'potPlaced'; slot: SlotRef; potInstanceId: string; replaced: string };

export type ErrorCode =
  | 'bad_slot'
  | 'slot_busy'
  | 'slot_empty'
  | 'unknown_crop'
  | 'locked'
  | 'not_enough_coins'
  | 'not_enough_items'
  | 'not_thirsty'
  | 'no_bug'
  | 'not_ripe'
  | 'storage_full'
  | 'bad_quantity'
  | 'not_sellable'
  | 'unknown_pot'
  | 'max_level'
  | 'not_next_floor'
  | 'not_for_sale'
  | 'not_in_stock';

export type Result = { ok: true; events: GameEvent[] } | { ok: false; error: ErrorCode };

const fail = (error: ErrorCode): Result => ({ ok: false, error });

function slotAt(state: GameState, ref: SlotRef): SlotState | null {
  return state.floors[ref.floor]?.slots[ref.slot] ?? null;
}

/** Current game time for a device time, without changing the state (for display). */
export function currentGameTime(state: GameState, realNow: number): number {
  return gameTime(realNow, state.clockOffsetMs, state.maxSeenAt);
}

/** Records the device time: updates the clock offset and the latest-seen marker, returns game time. */
export function advanceTime(state: GameState, realNow: number): number {
  state.clockOffsetMs = adjustedOffset(realNow, state.clockOffsetMs, state.maxSeenAt);
  const now = gameTime(realNow, state.clockOffsetMs, state.maxSeenAt);
  state.maxSeenAt = now;
  return now;
}

export function dispatch(content: ContentPack, state: GameState, cmd: Command, realNow: number): Result {
  const now = advanceTime(state, realNow);
  switch (cmd.type) {
    case 'plant':
      return plant(content, state, cmd, cmd.cropId, now);
    case 'water':
      return water(content, state, cmd, now);
    case 'catchBug':
      return catchBug(content, state, cmd, now);
    case 'harvest':
      return harvest(content, state, cmd, now);
    case 'sell':
      return sell(content, state, cmd.itemId, cmd.qty, now);
    case 'upgradePot':
      return upgradePot(content, state, cmd.potInstanceId);
    case 'unlockFloor':
      return unlockFloor(content, state, cmd.floorId);
    case 'buyPot':
      return buyPot(content, state, cmd.potId);
    case 'placePot':
      return placePot(state, cmd, cmd.potInstanceId);
  }
}

function plant(content: ContentPack, state: GameState, ref: SlotRef, cropId: string, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  if (slot.planting) return fail('slot_busy');
  const crop = content.crops.get(cropId);
  if (!crop) return fail('unknown_crop');
  if (crop.unlockLevel > state.player.level) return fail('locked');
  if (state.player.coins < crop.seedPrice) return fail('not_enough_coins');
  state.player.coins -= crop.seedPrice;
  slot.planting = {
    id: state.nextId++,
    cropId,
    seedCost: crop.seedPrice,
    cycleStartedAt: now,
    harvestsDone: 0,
    bonusMs: 0,
    wateredStages: [],
    caughtBugs: {},
  };
  return { ok: true, events: [{ type: 'planted', slot: ref, cropId, cost: crop.seedPrice }] };
}

function water(content: ContentPack, state: GameState, ref: SlotRef, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  if (!status || !slot.planting) return fail('slot_empty');
  if (!status.thirsty) return fail('not_thirsty');
  const savedMs = status.remainingMs * content.config.water.remainingTimeReduction;
  slot.planting.bonusMs += savedMs;
  slot.planting.wateredStages.push(status.stage);
  return { ok: true, events: [{ type: 'watered', slot: ref, savedMs }] };
}

function catchBug(content: ContentPack, state: GameState, ref: SlotRef, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  if (!status || !slot.planting) return fail('slot_empty');
  if (!status.bug) return fail('no_bug');
  const bugId = status.bug.bug.id;
  slot.planting.caughtBugs[bugId] = (slot.planting.caughtBugs[bugId] ?? 0) + 1;
  addItem(state, status.bug.bug.id, 1);
  state.stats.bugsCaught += 1;
  return { ok: true, events: [{ type: 'bugCaught', slot: ref, itemId: status.bug.bug.id }] };
}

function harvest(content: ContentPack, state: GameState, ref: SlotRef, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  const planting = slot.planting;
  if (!status || !planting) return fail('slot_empty');
  if (!status.ripe) return fail('not_ripe');
  const crop = status.crop;
  const qty = stochasticRound(crop.yield * (1 + slotBonus(content, state, slot, crop, 'yield')), state.seed, 'yield', planting.id, planting.harvestsDone);
  const xp = stochasticRound(crop.xp * (1 + slotBonus(content, state, slot, crop, 'xp')), state.seed, 'xp', planting.id, planting.harvestsDone);
  if (storageFree(content, state) < qty) return fail('storage_full');

  addItem(state, crop.produce.id, qty);
  state.stats.harvests += 1;
  const events: GameEvent[] = [];
  planting.harvestsDone += 1;
  const cleared = planting.harvestsDone >= crop.harvests;
  if (cleared) {
    slot.planting = null;
  } else {
    planting.cycleStartedAt = now;
    planting.bonusMs = 0;
    planting.wateredStages = [];
    planting.caughtBugs = {};
  }
  events.push({ type: 'harvested', slot: ref, itemId: crop.produce.id, qty, xp, cleared });
  for (const level of addXp(content, state, xp)) events.push({ type: 'levelUp', level });
  return { ok: true, events };
}

function sell(content: ContentPack, state: GameState, itemId: string, qty: number, now: number): Result {
  if (!Number.isInteger(qty) || qty <= 0) return fail('bad_quantity');
  const price = sellPrice(content, state, itemId, now);
  if (price === null) return fail('not_sellable');
  if ((state.inventory[itemId] ?? 0) < qty) return fail('not_enough_items');
  removeItem(state, itemId, qty);
  const coins = price * qty;
  state.player.coins += coins;
  state.stats.coinsEarned += coins;
  return { ok: true, events: [{ type: 'sold', itemId, qty, coins }] };
}

function upgradePot(content: ContentPack, state: GameState, potInstanceId: string): Result {
  const pot = state.pots[potInstanceId];
  if (!pot) return fail('unknown_pot');
  const cost = nextUpgradeCost(content, pot);
  if (!cost) return fail('max_level');
  if (state.player.coins < cost.coins) return fail('not_enough_coins');
  if (!canAfford(state, cost)) return fail('not_enough_items');
  state.player.coins -= cost.coins;
  for (const [id, qty] of Object.entries(cost.items)) removeItem(state, id, qty);
  pot.level += 1;
  return { ok: true, events: [{ type: 'potUpgraded', potInstanceId, level: pot.level }] };
}

/** The next floor that can be unlocked (floors open bottom to top, in content order). */
export function nextFloor(content: ContentPack, state: GameState) {
  const have = new Set(state.floors.map((f) => f.floorId));
  return content.floorList.find((f) => !have.has(f.id)) ?? null;
}

function unlockFloor(content: ContentPack, state: GameState, floorId: string): Result {
  const def = nextFloor(content, state);
  if (!def || def.id !== floorId) return fail('not_next_floor');
  if (def.unlockLevel > state.player.level) return fail('locked');
  if (state.player.coins < def.unlockCost) return fail('not_enough_coins');
  state.player.coins -= def.unlockCost;
  const index = state.floors.length;
  state.floors.push(createFloorState(def, state.pots, index));
  return { ok: true, events: [{ type: 'floorUnlocked', floorId, index, cost: def.unlockCost }] };
}

function buyPot(content: ContentPack, state: GameState, potId: string): Result {
  const def = content.pots.get(potId);
  if (!def) return fail('unknown_pot');
  if (def.price === null) return fail('not_for_sale');
  if (def.unlockLevel > state.player.level) return fail('locked');
  if (state.player.coins < def.price) return fail('not_enough_coins');
  state.player.coins -= def.price;
  const potInstanceId = `pot-b${state.nextId++}`;
  state.pots[potInstanceId] = { potId, level: 1 };
  state.potStock.push(potInstanceId);
  return { ok: true, events: [{ type: 'potBought', potInstanceId, potId, cost: def.price }] };
}

/** Puts a pot from stock on a slot; the pot that was there goes back to stock. */
function placePot(state: GameState, ref: SlotRef, potInstanceId: string): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const i = state.potStock.indexOf(potInstanceId);
  if (i < 0 || !state.pots[potInstanceId]) return fail('not_in_stock');
  if (slot.planting) return fail('slot_busy');
  const replaced = slot.potInstanceId;
  state.potStock.splice(i, 1, replaced);
  slot.potInstanceId = potInstanceId;
  return { ok: true, events: [{ type: 'potPlaced', slot: ref, potInstanceId, replaced }] };
}
