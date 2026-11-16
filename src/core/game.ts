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
import { canDeliver, refillOrders } from '../systems/orders.ts';
import { nextMilestone, recordHarvest, rollGift, rollMutation, type Gift } from '../systems/surprises.ts';
import { simulateNeighbors, type NeighborEvent } from '../systems/neighbors.ts';
import { expandCost, nextStar } from '../systems/floors.ts';
import { allMissionsClaimed, ensureMissions, localDay, missionDef, recordMissions } from '../systems/missions.ts';
import { botGarden, helpReward, helpsLeft, helpToday, type HelpKind } from '../systems/visit.ts';

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
  | ({ type: 'placePot'; potInstanceId: string } & SlotRef)
  /** Lets time-driven things happen: balloons bring orders, neighbours act. Sent by the app
   *  before every player command and every few seconds. */
  | { type: 'tick' }
  | { type: 'deliverOrder'; slot: number }
  | { type: 'skipOrder'; slot: number }
  | { type: 'rushOrder'; slot: number }
  | { type: 'claimJournal'; cropId: string }
  | { type: 'listItem'; itemId: string; qty: number; price: number }
  | { type: 'cancelListing'; listingId: number }
  | { type: 'readNotices' }
  /** Opens one more pot slot on a floor (REDESIGN_V2 2.1). */
  | { type: 'expandFloor'; floor: number }
  | { type: 'upgradeFloorStar'; floor: number }
  | { type: 'claimMission'; index: number }
  | { type: 'claimMissionBonus' }
  /** Helps one pot while visiting a neighbour's garden. */
  | { type: 'helpNeighbor'; botId: string; floor: number; slot: number; kind: HelpKind };

export type GameEvent =
  | { type: 'planted'; slot: SlotRef; cropId: string; cost: number }
  | { type: 'watered'; slot: SlotRef; savedMs: number }
  | { type: 'bugCaught'; slot: SlotRef; itemId: string }
  | { type: 'harvested'; slot: SlotRef; itemId: string; qty: number; xp: number; cleared: boolean; mutation: string | null }
  | { type: 'giftFound'; slot: SlotRef; gift: Gift }
  | { type: 'ordersArrived'; slots: number[] }
  | { type: 'orderDelivered'; slot: number; coins: number; xp: number; gems: number; customer: string; rare: boolean }
  | { type: 'orderSkipped'; slot: number }
  | { type: 'journalClaimed'; cropId: string; gems: number; harvests: number }
  | { type: 'itemListed'; listingId: number; itemId: string; qty: number; price: number }
  | { type: 'listingCancelled'; listingId: number }
  | NeighborEvent
  | { type: 'sold'; itemId: string; qty: number; coins: number }
  | { type: 'potUpgraded'; potInstanceId: string; level: number }
  | { type: 'levelUp'; level: number }
  | { type: 'floorUnlocked'; floorId: string; index: number; cost: number }
  | { type: 'potBought'; potInstanceId: string; potId: string; cost: number }
  | { type: 'potPlaced'; slot: SlotRef; potInstanceId: string; replaced: string }
  | { type: 'floorExpanded'; floor: number; slot: number; cost: number }
  | { type: 'floorStarred'; floor: number; stars: number }
  | { type: 'missionDone'; index: number; missionId: string }
  | { type: 'missionClaimed'; index: number; coins: number; xp: number; gems: number }
  | { type: 'missionBonusClaimed'; coins: number; xp: number; gems: number }
  | { type: 'neighborHelped'; botId: string; floor: number; slot: number; kind: HelpKind; coins: number; xp: number };

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
  | 'not_in_stock'
  | 'no_order'
  | 'not_waiting'
  | 'not_enough_gems'
  | 'nothing_to_claim'
  | 'stall_full'
  | 'bad_price'
  | 'unknown_listing'
  | 'max_slots'
  | 'max_stars'
  | 'not_complete'
  | 'already_claimed'
  | 'unknown_neighbor'
  | 'no_help_needed'
  | 'help_limit';

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

/** Things that happen because time passed: balloons bring new orders, neighbours live. */
export function updateWorld(content: ContentPack, state: GameState, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  const arrived = refillOrders(content, state, now);
  if (arrived.length > 0) events.push({ type: 'ordersArrived', slots: arrived });
  events.push(...simulateNeighbors(content, state, now));
  return events;
}

export function dispatch(content: ContentPack, state: GameState, cmd: Command, realNow: number): Result {
  const now = advanceTime(state, realNow);
  ensureMissions(content, state, now);
  const result = run(content, state, cmd, now);
  if (result.ok) {
    for (const index of recordMissions(content, state, result.events)) result.events.push({ type: 'missionDone', index, missionId: state.missions.list[index]!.id });
  }
  return result;
}

function run(content: ContentPack, state: GameState, cmd: Command, now: number): Result {
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
    case 'tick':
      return { ok: true, events: updateWorld(content, state, now) };
    case 'deliverOrder':
      return deliverOrder(content, state, cmd.slot, now);
    case 'skipOrder':
      return skipOrder(content, state, cmd.slot, now);
    case 'rushOrder':
      return rushOrder(content, state, cmd.slot, now);
    case 'claimJournal':
      return claimJournal(content, state, cmd.cropId);
    case 'listItem':
      return listItem(content, state, cmd.itemId, cmd.qty, cmd.price);
    case 'cancelListing':
      return cancelListing(content, state, cmd.listingId);
    case 'readNotices':
      for (const n of state.notices) n.read = true;
      return { ok: true, events: [] };
    case 'expandFloor':
      return expandFloor(content, state, cmd.floor);
    case 'upgradeFloorStar':
      return upgradeFloorStar(content, state, cmd.floor);
    case 'claimMission':
      return claimMission(content, state, cmd.index);
    case 'claimMissionBonus':
      return claimMissionBonus(content, state);
    case 'helpNeighbor':
      return helpNeighbor(content, state, cmd, now);
  }
}

function expandFloor(content: ContentPack, state: GameState, index: number): Result {
  const floor = state.floors[index];
  const def = floor && content.floors.get(floor.floorId);
  if (!floor || !def) return fail('bad_slot');
  const cost = expandCost(def, floor);
  if (cost === null) return fail('max_slots');
  if (state.player.coins < cost) return fail('not_enough_coins');
  state.player.coins -= cost;
  const slot = floor.slots.length;
  let potInstanceId = index === 0 ? `pot-${slot + 1}` : `pot-f${index + 1}-${slot + 1}`;
  while (state.pots[potInstanceId]) potInstanceId += '-n';
  state.pots[potInstanceId] = { potId: def.startingPot, level: 1 };
  floor.slots.push({ potInstanceId, planting: null });
  return { ok: true, events: [{ type: 'floorExpanded', floor: index, slot, cost }] };
}

function upgradeFloorStar(content: ContentPack, state: GameState, index: number): Result {
  const floor = state.floors[index];
  const def = floor && content.floors.get(floor.floorId);
  if (!floor || !def) return fail('bad_slot');
  const star = nextStar(def, floor);
  if (!star) return fail('max_stars');
  if (state.player.level < star.level) return fail('locked');
  if (state.player.coins < star.coins) return fail('not_enough_coins');
  if (!canAfford(state, { coins: star.coins, items: star.items })) return fail('not_enough_items');
  state.player.coins -= star.coins;
  for (const [id, qty] of Object.entries(star.items)) removeItem(state, id, qty);
  floor.stars += 1;
  return { ok: true, events: [{ type: 'floorStarred', floor: index, stars: floor.stars }] };
}

function giveReward(content: ContentPack, state: GameState, r: { coins: number; xp: number; gems: number }, events: GameEvent[]): void {
  state.player.coins += r.coins;
  state.player.gems += r.gems;
  state.stats.coinsEarned += r.coins;
  for (const level of addXp(content, state, r.xp)) events.push({ type: 'levelUp', level });
}

function claimMission(content: ContentPack, state: GameState, index: number): Result {
  const m = state.missions.list[index];
  const def = m && missionDef(content, m.id);
  if (!m || !def) return fail('nothing_to_claim');
  if (m.claimed) return fail('already_claimed');
  if (m.progress < def.target) return fail('not_complete');
  m.claimed = true;
  const events: GameEvent[] = [{ type: 'missionClaimed', index, ...def.reward }];
  giveReward(content, state, def.reward, events);
  return { ok: true, events };
}

function claimMissionBonus(content: ContentPack, state: GameState): Result {
  if (state.missions.bonusClaimed) return fail('already_claimed');
  if (!allMissionsClaimed(state)) return fail('not_complete');
  state.missions.bonusClaimed = true;
  const r = content.missions.allDone;
  const events: GameEvent[] = [{ type: 'missionBonusClaimed', ...r }];
  giveReward(content, state, r, events);
  return { ok: true, events };
}

function helpNeighbor(content: ContentPack, state: GameState, cmd: { botId: string; floor: number; slot: number; kind: HelpKind }, now: number): Result {
  const bot = state.neighbors[cmd.botId];
  if (!bot || !content.bots.has(cmd.botId)) return fail('unknown_neighbor');
  if (helpsLeft(content, bot, now) <= 0) return fail('help_limit');
  const pot = botGarden(content, state, cmd.botId, now)[cmd.floor]?.pots[cmd.slot];
  if (!pot) return fail('bad_slot');
  if (pot.need !== cmd.kind) return fail('no_help_needed');
  const day = localDay(content, now);
  bot.help = { day, pots: [...helpToday(content, bot, now), pot.key] };
  bot.friendship += content.neighbors.help.friendship;
  const r = helpReward(content, bot);
  const events: GameEvent[] = [{ type: 'neighborHelped', botId: cmd.botId, floor: cmd.floor, slot: cmd.slot, kind: cmd.kind, ...r }];
  giveReward(content, state, { ...r, gems: 0 }, events);
  return { ok: true, events };
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
  const luck = slotBonus(content, state, slot, crop, 'luck');
  const mutation = rollMutation(content, state, planting, luck);
  const itemId = mutation ? `${crop.produce.id}~${mutation}` : crop.produce.id;
  const cycleSeconds = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  const gift = rollGift(content, state, planting, cycleSeconds, luck);
  const qty = stochasticRound(crop.yield * (1 + slotBonus(content, state, slot, crop, 'yield')), state.seed, 'yield', planting.id, planting.harvestsDone);
  const xp = stochasticRound(crop.xp * (1 + slotBonus(content, state, slot, crop, 'xp')), state.seed, 'xp', planting.id, planting.harvestsDone);
  if (storageFree(content, state) < qty) return fail('storage_full');

  addItem(state, itemId, qty);
  state.stats.harvests += 1;
  recordHarvest(state, crop, mutation);
  const events: GameEvent[] = [];
  if (gift) {
    if (gift.kind === 'coins') state.player.coins += gift.amount;
    else if (gift.kind === 'gems') state.player.gems += gift.amount;
    else if (gift.itemId) addItem(state, gift.itemId, gift.amount);
    state.stats.gifts += 1;
  }
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
  events.push({ type: 'harvested', slot: ref, itemId, qty, xp, cleared, mutation });
  if (gift) events.push({ type: 'giftFound', slot: ref, gift });
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

function deliverOrder(content: ContentPack, state: GameState, index: number, now: number): Result {
  const slot = state.orders.slots[index];
  const order = slot?.order;
  if (!slot || !order) return fail('no_order');
  if (!canDeliver(state, order)) return fail('not_enough_items');
  for (const [id, qty] of Object.entries(order.items)) removeItem(state, id, qty);
  state.player.coins += order.coins;
  state.player.gems += order.gems;
  state.stats.coinsEarned += order.coins;
  state.stats.ordersDone += 1;
  const friend = state.neighbors[order.customer];
  if (friend) friend.friendship += content.neighbors.orderFriendship;
  slot.order = null;
  slot.readyAt = now + content.orders.refillSeconds * 1000;
  const events: GameEvent[] = [{ type: 'orderDelivered', slot: index, coins: order.coins, xp: order.xp, gems: order.gems, customer: order.customer, rare: order.rare }];
  for (const level of addXp(content, state, order.xp)) events.push({ type: 'levelUp', level });
  return { ok: true, events };
}

function skipOrder(content: ContentPack, state: GameState, index: number, now: number): Result {
  const slot = state.orders.slots[index];
  if (!slot?.order) return fail('no_order');
  slot.order = null;
  slot.readyAt = now + content.orders.skipSeconds * 1000;
  return { ok: true, events: [{ type: 'orderSkipped', slot: index }] };
}

/** Pays Ngọc Mây to bring a waiting balloon back at once. */
function rushOrder(content: ContentPack, state: GameState, index: number, now: number): Result {
  const slot = state.orders.slots[index];
  if (!slot || slot.order || slot.readyAt <= now) return fail('not_waiting');
  if (state.player.gems < content.orders.skipNowGems) return fail('not_enough_gems');
  state.player.gems -= content.orders.skipNowGems;
  slot.readyAt = now;
  const arrived = refillOrders(content, state, now);
  return { ok: true, events: [{ type: 'ordersArrived', slots: arrived }] };
}

function claimJournal(content: ContentPack, state: GameState, cropId: string): Result {
  const m = nextMilestone(content, state, cropId);
  if (!m) return fail('nothing_to_claim');
  state.journal[cropId]!.claimed += 1;
  state.player.gems += m.gems;
  return { ok: true, events: [{ type: 'journalClaimed', cropId, gems: m.gems, harvests: m.harvests }] };
}

function listItem(content: ContentPack, state: GameState, itemId: string, qty: number, price: number): Result {
  const item = content.items.get(itemId);
  if (!item || item.sellPrice === null) return fail('not_sellable');
  const cfg = content.neighbors;
  if (!Number.isInteger(qty) || qty <= 0 || qty > cfg.maxListingQty) return fail('bad_quantity');
  if (!Number.isInteger(price) || price < Math.max(1, Math.floor(item.sellPrice * cfg.priceRange[0])) || price > Math.ceil(item.sellPrice * cfg.priceRange[1])) return fail('bad_price');
  if ((state.inventory[itemId] ?? 0) < qty) return fail('not_enough_items');
  if (state.stall.length >= cfg.stallSlots) return fail('stall_full');
  removeItem(state, itemId, qty);
  const listingId = state.nextId++;
  state.stall.push({ id: listingId, itemId, qty, price });
  return { ok: true, events: [{ type: 'itemListed', listingId, itemId, qty, price }] };
}

function cancelListing(content: ContentPack, state: GameState, listingId: number): Result {
  const i = state.stall.findIndex((l) => l.id === listingId);
  if (i < 0) return fail('unknown_listing');
  const l = state.stall[i]!;
  if (content.items.get(l.itemId)?.countsTowardStorage && storageFree(content, state) < l.qty) return fail('storage_full');
  state.stall.splice(i, 1);
  addItem(state, l.itemId, l.qty);
  return { ok: true, events: [{ type: 'listingCancelled', listingId }] };
}
