// Command processor. Every change to the game goes through dispatch(): the command is validated
// first, and only applied if valid. The player UI and (later) BOTs use exactly this entry point.

import { isSoldInShop, type ContentPack, type FloorDef } from './content.ts';
import { floorAtIndex } from './floorgen.ts';
import type { GameState, SlotState } from './state.ts';
import { adjustedOffset, gameTime } from './clock.ts';
import { stochasticRound } from './rng.ts';
import { cropStatus } from '../systems/growth.ts';
import { addItem, addXp, removeItem, sellPrice, storageCapacity, storageFree, storageUpgradeCost } from '../systems/economy.ts';
import { canAfford, doubleYieldChance, grantPot, isMilestone, mutationMultiplier, nextUpgradeCost, noteInBook, upgradeBlock } from '../systems/pots.ts';
import { randomFor } from './rng.ts';
import { activeEvents, eventPointsFor } from '../systems/events.ts';
import { slotBonus } from '../systems/modifiers.ts';
import { createFloorState } from './state.ts';
import { askNeighborsHelp, canDeliver, flightFor, refillOrders, stillNeeded, type OrderWorldEvent } from '../systems/orders.ts';
import { coinGiftAmount, nextMilestone, recordHarvest, rollGift, rollMutation, type Gift } from '../systems/surprises.ts';
import { playerPrice, sellBugs, simulateNeighbors, snapshotRanks, type NeighborEvent } from '../systems/neighbors.ts';
import { expandCost, expandItems, nextStar } from '../systems/floors.ts';
import { allMissionsClaimed, ensureMissions, localDay, missionDef, recordMissions } from '../systems/missions.ts';
import { ensureQuestPeriods, questActive, questClaims, questReward, questView, recordQuests } from '../systems/quests.ts';
import { botGarden, helpReward, helpsLeft, helpToday, type HelpKind } from '../systems/visit.ts';
import { buyMachineSlot, collectWorkshop, startJob, upgradeMachine, type WorkshopError, type WorkshopEvent } from '../systems/workshop.ts';
import { advanceBirds, buyMillet, feedAll, feedBird, obtainBird, placeBird, type BirdError, type BirdEvent } from '../systems/birds.ts';

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
  /** Sends an order: the balloon flies off and pays when it comes back; a bird may escort it. */
  | { type: 'deliverOrder'; slot: number; birdId?: string }
  /** Once a day: ask the neighbours to chip in for an order (chỉ thị 10 § 3.6). */
  | { type: 'askNeighbors'; slot: number }
  | { type: 'skipOrder'; slot: number }
  | { type: 'rushOrder'; slot: number }
  | { type: 'claimJournal'; cropId: string }
  | { type: 'listItem'; itemId: string; qty: number; price: number }
  | { type: 'buyFromNeighbor'; botId: string; itemId: string; qty: number }
  | { type: 'cancelListing'; listingId: number }
  | { type: 'readNotices' }
  /** Opens one more pot slot on a floor (REDESIGN_V2 2.1). */
  | { type: 'expandFloor'; floor: number }
  | { type: 'upgradeFloorStar'; floor: number }
  | { type: 'claimMission'; index: number }
  | { type: 'claimMissionBonus' }
  /** Helps one pot while visiting a neighbour's garden. */
  | { type: 'helpNeighbor'; botId: string; floor: number; slot: number; kind: HelpKind }
  /** Gets a non-shop pot by exchanging items (mission seals). */
  | { type: 'obtainPot'; potId: string }
  | { type: 'claimEventMilestone'; eventId: string }
  | { type: 'claimBookReward' }
  /** Buys the next Rương Mây tier for coins (no cap). */
  | { type: 'upgradeStorage' }
  /** Mưa Mây: spends gems to ripen every growing crop on one floor now. */
  | { type: 'cloudRain'; floor: number }
  /** Claims the next tier of a quest (đợt 2). */
  | { type: 'claimQuest'; questId: string }
  /** Marks a tutorial as shown so it never comes back. */
  | { type: 'seeTutorial'; tutorialId: string }
  /** Chỉ thị 10 § 3.3: rent (coins) or buy (gems) a bug-catching bird. */
  | { type: 'obtainBird'; species: string; how: 'rent' | 'buy' }
  | { type: 'feedBird'; birdId: string; itemId: string }
  | { type: 'placeBird'; birdId: string; floor: number; branch: number }
  | { type: 'buyMillet'; qty: number }
  | { type: 'feedAllBirds' }
  /** Chỉ thị 10 § 3.5: Xưởng Bọ. */
  | { type: 'startJob'; recipeId: string }
  | { type: 'upgradeMachine'; machineId: string }
  | { type: 'buyMachineSlot'; machineId: string }
  /** Chỉ thị 12 B6.3: sell spare bugs to a BOT trader at a low price. */
  | { type: 'sellBugs'; itemId: string; qty: number };

export type GameEvent =
  | { type: 'planted'; slot: SlotRef; cropId: string; cost: number }
  | { type: 'watered'; slot: SlotRef; savedMs: number }
  | { type: 'bugCaught'; slot: SlotRef; itemId: string }
  | BirdEvent
  | WorkshopEvent
  | { type: 'birdObtained'; birdId: string; species: string; rented: boolean }
  | { type: 'birdFed'; birdId: string; food: number }
  | { type: 'newBug'; itemId: string }
  | { type: 'harvested'; slot: SlotRef; itemId: string; qty: number; xp: number; cleared: boolean; mutation: string | null; doubled?: boolean }
  | { type: 'giftFound'; slot: SlotRef; gift: Gift }
  | { type: 'ordersArrived'; slots: number[] }
  | { type: 'orderDelivered'; slot: number; coins: number; xp: number; gems: number; customer: string; rare: boolean }
  | { type: 'orderSkipped'; slot: number }
  | Exclude<OrderWorldEvent, { type: 'levelUp' }>
  | { type: 'bugsSold'; itemId: string; qty: number; coins: number }
  | { type: 'neighborsChipped'; slot: number; help: Array<{ botId: string; itemId: string; qty: number }> }
  | { type: 'journalClaimed'; cropId: string; gems: number; harvests: number }
  | { type: 'itemListed'; listingId: number; itemId: string; qty: number; price: number }
  | { type: 'boughtFromNeighbor'; botId: string; itemId: string; qty: number; coins: number }
  | { type: 'listingCancelled'; listingId: number }
  | NeighborEvent
  | { type: 'sold'; itemId: string; qty: number; coins: number }
  | { type: 'potUpgraded'; potInstanceId: string; level: number; milestone: boolean; skills: string[] }
  | { type: 'levelUp'; level: number }
  | { type: 'floorUnlocked'; floorId: string; index: number; cost: number }
  | { type: 'potBought'; potInstanceId: string; potId: string; cost: number }
  | { type: 'potPlaced'; slot: SlotRef; potInstanceId: string; replaced: string }
  | { type: 'floorExpanded'; floor: number; slot: number; cost: number }
  | { type: 'floorStarred'; floor: number; stars: number }
  | { type: 'missionDone'; index: number; missionId: string }
  | { type: 'missionClaimed'; index: number; coins: number; xp: number; gems: number }
  | { type: 'missionBonusClaimed'; coins: number; xp: number; gems: number }
  | { type: 'neighborHelped'; botId: string; floor: number; slot: number; kind: HelpKind; coins: number; xp: number }
  | { type: 'materialFound'; slot: SlotRef; itemId: string; qty: number }
  | { type: 'potObtained'; potInstanceId: string; potId: string; source: 'exchange' | 'event' }
  | { type: 'eventPoints'; eventId: string; points: number; total: number }
  | { type: 'eventMilestoneClaimed'; eventId: string; index: number; coins: number; gems: number; items: Record<string, number>; pot: string | null }
  | { type: 'bookRewardClaimed'; lines: number; gems: number }
  | { type: 'storageUpgraded'; tier: number; capacity: number; cost: number }
  | { type: 'cloudRained'; floor: number; pots: number; gems: number }
  | { type: 'questDone'; questId: string }
  | { type: 'questClaimed'; questId: string; tier: number; coins: number; gems: number; xp: number; items: Record<string, number>; pot: string | null };

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
  | 'help_limit'
  | 'level_not_open'
  | 'not_obtainable'
  | 'nothing_growing'
  | 'unknown_quest'
  | 'quest_not_ready'
  | 'market_limit'
  | BirdError
  | 'help_used'
  | 'bird_busy'
  | WorkshopError;

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
  const back: OrderWorldEvent[] = [];
  const arrived = refillOrders(content, state, now, back);
  events.push(...(back as GameEvent[]));
  if (arrived.length > 0) events.push({ type: 'ordersArrived', slots: arrived });
  snapshotRanks(content, state, localDay(content, now));
  events.push(...simulateNeighbors(content, state, now));
  return events;
}

export function dispatch(content: ContentPack, state: GameState, cmd: Command, realNow: number): Result {
  const now = advanceTime(state, realNow);
  ensureMissions(content, state, now);
  ensureQuestPeriods(content, state, now);
  // Birds work in time order up to now, before the player acts, with the player's own catchBug.
  const birdEvents = [...runBirds(content, state, now), ...collectWorkshop(content, state, now)];
  const ran = run(content, state, cmd, now);
  // Bird catches count for missions even when the player's command itself fails.
  const result: Result = ran.ok ? { ok: true, events: [...birdEvents, ...ran.events] } : { ok: true, events: birdEvents };
  if (result.events.length > 0) {
    for (const index of recordMissions(content, state, result.events)) result.events.push({ type: 'missionDone', index, missionId: state.missions.list[index]!.id });
    for (const questId of recordQuests(content, state, result.events, now)) result.events.push({ type: 'questDone', questId });
    // Event points come from what just happened, only while an event runs (POT_SYSTEM 3).
    for (const ev of activeEvents(content, now)) {
      const pts = eventPointsFor(ev, result.events);
      if (pts <= 0) continue;
      const e = (state.events[ev.id] ??= { points: 0, claimed: 0 });
      e.points += pts;
      result.events.push({ type: 'eventPoints', eventId: ev.id, points: pts, total: e.points });
    }
  }
  return ran.ok ? result : ran;
}

function runBirds(content: ContentPack, state: GameState, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  const birdEvents = advanceBirds(content, state, now, (floor, slot, at) => {
    const r = catchBug(content, state, { floor, slot }, at);
    if (!r.ok) return { ok: false };
    // Only the "new bug" note is kept; the catch itself is reported as the bird's.
    for (const e of r.events) if (e.type === 'newBug') events.push(e);
    const caught = r.events.find((e) => e.type === 'bugCaught');
    return { ok: true, itemId: caught?.type === 'bugCaught' ? caught.itemId : undefined };
  });
  return [...birdEvents, ...events];
}

function birdResult(r: BirdError | null | object, ok: GameEvent[]): Result {
  return typeof r === 'string' ? fail(r) : { ok: true, events: ok };
}

function run(content: ContentPack, state: GameState, cmd: Command, now: number): Result {
  switch (cmd.type) {
    case 'plant':
      return plant(content, state, cmd, cmd.cropId, now);
    case 'water':
      return water(content, state, cmd, now);
    case 'catchBug':
      return catchBug(content, state, cmd, now);
    case 'obtainBird': {
      const b = obtainBird(content, state, cmd.species, cmd.how, now);
      return typeof b === 'string' ? fail(b) : { ok: true, events: [{ type: 'birdObtained', birdId: b.id, species: b.species, rented: cmd.how === 'rent' }] };
    }
    case 'feedBird': {
      const r = feedBird(content, state, cmd.birdId, cmd.itemId, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'birdFed', birdId: cmd.birdId, food: r.food }] };
    }
    case 'placeBird':
      return birdResult(placeBird(content, state, cmd.birdId, cmd.floor, cmd.branch), []);
    case 'buyMillet':
      return birdResult(buyMillet(content, state, cmd.qty), []);
    case 'sellBugs': {
      const r = sellBugs(content, state, cmd.itemId, cmd.qty);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'bugsSold', itemId: cmd.itemId, qty: cmd.qty, coins: r.coins }] };
    }
    case 'startJob':
    case 'upgradeMachine':
    case 'buyMachineSlot': {
      const r = cmd.type === 'startJob' ? startJob(content, state, cmd.recipeId, now) : cmd.type === 'upgradeMachine' ? upgradeMachine(content, state, cmd.machineId) : buyMachineSlot(content, state, cmd.machineId);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [r] };
    }
    case 'feedAllBirds': {
      const r = feedAll(content, state, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'birdFed', birdId: '*', food: r.fed }] };
    }
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
      return deliverOrder(content, state, cmd.slot, now, cmd.birdId);
    case 'askNeighbors':
      return askNeighbors(content, state, cmd.slot, now);
    case 'skipOrder':
      return skipOrder(content, state, cmd.slot, now);
    case 'rushOrder':
      return rushOrder(content, state, cmd.slot, now);
    case 'claimJournal':
      return claimJournal(content, state, cmd.cropId);
    case 'listItem':
      return listItem(content, state, cmd.itemId, cmd.qty, cmd.price);
    case 'buyFromNeighbor':
      return buyFromNeighbor(content, state, cmd.botId, cmd.itemId, cmd.qty, now);
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
    case 'obtainPot':
      return obtainPot(content, state, cmd.potId, now);
    case 'claimEventMilestone':
      return claimEventMilestone(content, state, cmd.eventId, now);
    case 'upgradeStorage':
      return upgradeStorage(content, state);
    case 'cloudRain':
      return cloudRain(content, state, cmd.floor, now);
    case 'claimQuest':
      return claimQuest(content, state, cmd.questId, now);
    case 'seeTutorial':
      if (!content.tutorials.has(cmd.tutorialId)) return fail('unknown_quest');
      if (!state.tutorials.includes(cmd.tutorialId)) state.tutorials.push(cmd.tutorialId);
      return { ok: true, events: [] };
    case 'claimBookReward':
      return claimBookReward(content, state);
  }
}

function obtainPot(content: ContentPack, state: GameState, potId: string, now: number): Result {
  const def = content.pots.get(potId);
  if (!def) return fail('unknown_pot');
  if (!def.exchange) return fail('not_obtainable');
  if (!canAfford(state, { coins: 0, items: def.exchange.items })) return fail('not_enough_items');
  for (const [id, q] of Object.entries(def.exchange.items)) removeItem(state, id, q);
  const potInstanceId = grantPot(state, potId, 'exchange', now);
  return { ok: true, events: [{ type: 'potObtained', potInstanceId, potId, source: 'exchange' }] };
}

function claimEventMilestone(content: ContentPack, state: GameState, eventId: string, now: number): Result {
  const ev = content.events.find((e) => e.id === eventId);
  if (!ev) return fail('nothing_to_claim');
  const prog = state.events[eventId] ?? { points: 0, claimed: 0 };
  const m = ev.milestones[prog.claimed];
  // Earned milestones stay claimable after the event ends (nothing earned is lost).
  if (!m || prog.points < m.points) return fail('nothing_to_claim');
  prog.claimed += 1;
  state.events[eventId] = prog;
  const r = m.reward;
  state.player.coins += r.coins ?? 0;
  state.player.gems += r.gems ?? 0;
  for (const [id, q] of Object.entries(r.items ?? {})) addItem(state, id, q);
  const events: GameEvent[] = [{ type: 'eventMilestoneClaimed', eventId, index: prog.claimed - 1, coins: r.coins ?? 0, gems: r.gems ?? 0, items: r.items ?? {}, pot: r.pot ?? null }];
  if (r.pot) {
    const potInstanceId = grantPot(state, r.pot, 'event', now);
    events.push({ type: 'potObtained', potInstanceId, potId: r.pot, source: 'event' });
  }
  return { ok: true, events };
}

function claimBookReward(content: ContentPack, state: GameState): Result {
  const rewards = content.config.collectionRewards ?? [];
  const next = rewards[state.potBookClaimed];
  const lines = Object.keys(state.potBook).filter((id) => content.pots.has(id)).length;
  if (!next || lines < next.lines) return fail('nothing_to_claim');
  state.potBookClaimed += 1;
  state.player.gems += next.gems;
  return { ok: true, events: [{ type: 'bookRewardClaimed', lines: next.lines, gems: next.gems }] };
}

function expandFloor(content: ContentPack, state: GameState, index: number): Result {
  const floor = state.floors[index];
  const def = floor && content.floors.get(floor.floorId);
  if (!floor || !def) return fail('bad_slot');
  const cost = expandCost(def, floor);
  if (cost === null) return fail('max_slots');
  if (state.player.coins < cost) return fail('not_enough_coins');
  const items = expandItems(def, floor);
  if (!canAfford(state, { coins: 0, items })) return fail('not_enough_items');
  state.player.coins -= cost;
  for (const [id, q] of Object.entries(items)) removeItem(state, id, q);
  const slot = floor.slots.length;
  let potInstanceId = index === 0 ? `pot-${slot + 1}` : `pot-f${index + 1}-${slot + 1}`;
  while (state.pots[potInstanceId]) potInstanceId += '-n';
  state.pots[potInstanceId] = { potId: def.startingPot, level: 1, obtainedAt: state.maxSeenAt, source: 'floor', history: [] };
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

function giveReward(content: ContentPack, state: GameState, r: { coins: number; xp: number; gems: number; items?: Record<string, number> }, events: GameEvent[]): void {
  state.player.coins += r.coins;
  state.player.gems += r.gems;
  for (const [id, q] of Object.entries(r.items ?? {})) addItem(state, id, q);
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
    bugLevel: state.player.level,
  };
  return { ok: true, events: [{ type: 'planted', slot: ref, cropId, cost: crop.seedPrice }] };
}

function water(content: ContentPack, state: GameState, ref: SlotRef, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  if (!status || !slot.planting) return fail('slot_empty');
  if (!status.thirsty) return fail('not_thirsty');
  // Care (POT_SYSTEM 5) makes each watering save more of the remaining time.
  const care = slotBonus(content, state, slot, status.crop, 'care');
  const savedMs = status.remainingMs * content.config.water.remainingTimeReduction * (1 + care);
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
  addItem(state, bugId, 1);
  state.stats.bugsCaught += 1;
  // Chỉ thị 10 § 3.2: Sổ Sâu Bọ — the first catch of a kind is a "Bọ mới!".
  const book = state.collections.bugs;
  const first = !book[bugId];
  book[bugId] = { firstAt: book[bugId]?.firstAt ?? now, count: (book[bugId]?.count ?? 0) + 1 };
  const events: GameEvent[] = [{ type: 'bugCaught', slot: ref, itemId: bugId }];
  if (first) events.push({ type: 'newBug', itemId: bugId });
  return { ok: true, events };
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
  const potInst = state.pots[slot.potInstanceId]!;
  const mutation = rollMutation(content, state, planting, luck, mutationMultiplier(content, potInst));
  const itemId = mutation ? `${crop.produce.id}~${mutation}` : crop.produce.id;
  const cycleSeconds = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  const gift = rollGift(content, state, planting, cycleSeconds, luck);
  const baseQty = stochasticRound(crop.yield * (1 + slotBonus(content, state, slot, crop, 'yield')), state.seed, 'yield', planting.id, planting.harvestsDone);
  const doubled = randomFor(state.seed, 'double', planting.id, planting.harvestsDone) < doubleYieldChance(content, potInst);
  const qty = doubled ? baseQty * 2 : baseQty;
  const xp = stochasticRound(crop.xp * (1 + slotBonus(content, state, slot, crop, 'xp')), state.seed, 'xp', planting.id, planting.harvestsDone);
  if (storageFree(content, state) < qty) return fail('storage_full');

  addItem(state, itemId, qty);
  state.stats.harvests += 1;
  recordHarvest(state, crop, mutation);
  const events: GameEvent[] = [];
  // Materials: the line's own shard, and the common clay (POT_SYSTEM 4). Not counted in storage.
  const found: Array<{ itemId: string; qty: number }> = [];
  const potDef = content.pots.get(potInst.potId);
  if (potDef?.shard && randomFor(state.seed, 'shard', planting.id, planting.harvestsDone) < potDef.shard.chance * (1 + luck)) found.push({ itemId: potDef.shard.item, qty: 1 });
  const hm = content.config.harvestMaterial;
  if (hm && randomFor(state.seed, 'clay', planting.id, planting.harvestsDone) < hm.chance * (1 + luck)) found.push({ itemId: hm.item, qty: 1 });
  // Chỉ thị 10 § 3.1: Sợi Mây Kết / Giọt Sương Trời for opening floors (2% a harvest).
  const fm = content.config.floorMaterialDrop;
  if (fm && fm.items.length > 0 && randomFor(state.seed, 'floorMat', planting.id, planting.harvestsDone) < fm.chance * (1 + luck)) {
    found.push({ itemId: fm.items[Math.floor(randomFor(state.seed, 'floorMatKind', planting.id, planting.harvestsDone) * fm.items.length)]!, qty: 1 });
  }
  for (const f of found) addItem(state, f.itemId, f.qty);
  if (gift?.kind === 'gems') {
    // Daily gem budget for surprise gifts (plan C): past it the gift is coins instead, so big
    // gardens do not flood the game with gems.
    const day = localDay(content, now);
    if (state.budget.day !== day) state.budget = { day, giftGems: 0 };
    const room = content.surprises.giftGemsPerDay - state.budget.giftGems;
    if (room <= 0) Object.assign(gift, { kind: 'coins', amount: coinGiftAmount(content, state) });
    else {
      gift.amount = Math.min(gift.amount, room);
      state.budget.giftGems += gift.amount;
    }
  }
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
  events.push({ type: 'harvested', slot: ref, itemId, qty, xp, cleared, mutation, doubled });
  if (gift) events.push({ type: 'giftFound', slot: ref, gift });
  for (const f of found) events.push({ type: 'materialFound', slot: ref, ...f });
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
  const block = upgradeBlock(content, state, pot);
  if (block) return fail(block);
  const cost = nextUpgradeCost(content, pot);
  if (!cost) return fail('max_level');
  if (state.player.coins < cost.coins) return fail('not_enough_coins');
  if (!canAfford(state, cost)) return fail('not_enough_items');
  // Upgrades never fail and never lose the pot (POT_SYSTEM 4).
  state.player.coins -= cost.coins;
  for (const [id, qty] of Object.entries(cost.items)) removeItem(state, id, qty);
  pot.level += 1;
  const at = state.maxSeenAt;
  (pot.history ??= []).push({ level: pot.level, at });
  if (pot.history.length > 60) pot.history.splice(0, pot.history.length - 60);
  noteInBook(state, pot.potId, pot.level, at);
  const def = content.pots.get(pot.potId)!;
  const skills = def.skills.filter((s) => s.level === pot.level).map((s) => s.id);
  return { ok: true, events: [{ type: 'potUpgraded', potInstanceId, level: pot.level, milestone: isMilestone(def, pot.level), skills }] };
}

function claimQuest(content: ContentPack, state: GameState, questId: string, now: number): Result {
  const q = content.quests.get(questId);
  if (!q) return fail('unknown_quest');
  if (!questActive(content, state, q) || !questView(content, state, q).claimable) return fail('quest_not_ready');
  const r = questReward(content, state, q);
  const tier = questClaims(state, q.id);
  state.quests.claims[q.id] = tier + 1;
  state.player.coins += r.coins;
  state.player.gems += r.gems;
  for (const [id, n] of Object.entries(r.items)) addItem(state, id, n);
  if (r.pot) grantPot(state, r.pot, 'quest', now);
  const events: GameEvent[] = [{ type: 'questClaimed', questId, tier, coins: r.coins, gems: r.gems, xp: r.xp, items: r.items, pot: r.pot }];
  for (const level of addXp(content, state, r.xp)) events.push({ type: 'levelUp', level });
  return { ok: true, events };
}

function upgradeStorage(content: ContentPack, state: GameState): Result {
  const cost = storageUpgradeCost(content, state);
  if (state.player.coins < cost) return fail('not_enough_coins');
  state.player.coins -= cost;
  state.upgrades.storage += 1;
  return { ok: true, events: [{ type: 'storageUpgraded', tier: state.upgrades.storage, capacity: storageCapacity(content, state), cost }] };
}

/** Gems Mưa Mây would cost on a floor now, and how many pots it would ripen. */
export function cloudRainCost(content: ContentPack, state: GameState, floor: number, now: number): { gems: number; pots: number } {
  const cfg = content.config.cloudRain;
  let gems = 0;
  let pots = 0;
  for (const slot of state.floors[floor]?.slots ?? []) {
    const st = cropStatus(content, state, slot, now);
    if (!st || st.ripe) continue;
    pots += 1;
    gems += Math.max(cfg.minGemsPerPot, Math.ceil(st.remainingMs / 60_000 / cfg.minutesPerGem));
  }
  return { gems, pots };
}

function cloudRain(content: ContentPack, state: GameState, floor: number, now: number): Result {
  if (!state.floors[floor]) return fail('bad_slot');
  const { gems, pots } = cloudRainCost(content, state, floor, now);
  if (pots === 0) return fail('nothing_growing');
  if (state.player.gems < gems) return fail('not_enough_gems');
  state.player.gems -= gems;
  for (const slot of state.floors[floor]!.slots) {
    const st = cropStatus(content, state, slot, now);
    if (st && !st.ripe && slot.planting) slot.planting.bonusMs += st.remainingMs + 1;
  }
  return { ok: true, events: [{ type: 'cloudRained', floor, pots, gems }] };
}

/** The next floor that can be unlocked (floors open bottom to top, in content order). */
export function nextFloor(content: ContentPack, state: GameState): FloorDef | null {
  // Floors open bottom to top and there is no top floor (owner decision 2026-11-17).
  return floorAtIndex(content.floors, content.floorList, state.floors.length);
}

function unlockFloor(content: ContentPack, state: GameState, floorId: string): Result {
  const def = nextFloor(content, state);
  if (!def || def.id !== floorId) return fail('not_next_floor');
  if (def.unlockLevel > state.player.level) return fail('locked');
  if (state.player.coins < def.unlockCost) return fail('not_enough_coins');
  const items = def.unlockItems ?? {};
  if (!canAfford(state, { coins: 0, items })) return fail('not_enough_items');
  state.player.coins -= def.unlockCost;
  for (const [id, q] of Object.entries(items)) removeItem(state, id, q);
  const index = state.floors.length;
  state.floors.push(createFloorState(def, state.pots, index));
  return { ok: true, events: [{ type: 'floorUnlocked', floorId, index, cost: def.unlockCost }] };
}

function buyPot(content: ContentPack, state: GameState, potId: string): Result {
  const def = content.pots.get(potId);
  if (!def) return fail('unknown_pot');
  if (!isSoldInShop(def)) return fail('not_for_sale');
  if (def.unlockLevel > state.player.level) return fail('locked');
  if (state.player.coins < def.price) return fail('not_enough_coins');
  state.player.coins -= def.price;
  const potInstanceId = grantPot(state, potId, 'shop', state.maxSeenAt);
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

function deliverOrder(content: ContentPack, state: GameState, index: number, now: number, birdId?: string): Result {
  const slot = state.orders.slots[index];
  const order = slot?.order;
  if (!slot || !order) return fail('no_order');
  if (!canDeliver(state, order)) return fail('not_enough_items');
  // Chỉ thị 10 § 3.6: an escorting bird (from escortLevel) flies with the balloon until it is back,
  // and does not catch bugs meanwhile.
  const bird = birdId ? state.birds.find((b) => b.id === birdId) : undefined;
  if (birdId) {
    if (!bird) return fail('no_bird');
    if (state.player.level < (content.orders.escortLevel ?? 1)) return fail('level_not_open');
    if (bird.escort && bird.escort.until > now) return fail('bird_busy');
  }
  for (const [id, qty] of Object.entries(stillNeeded(order))) removeItem(state, id, qty);
  state.stats.ordersDone += 1;
  const friend = state.neighbors[order.customer];
  if (friend) friend.friendship += content.neighbors.orderFriendship;
  slot.order = null;
  slot.readyAt = now + content.orders.refillSeconds * 1000;
  slot.flight = flightFor(content, state, order, bird?.species ?? null, now);
  if (bird) bird.escort = { slot: index, until: slot.readyAt };
  // XP now (the customer's thanks); coins, gems and items come back with the balloon.
  const xp = slot.flight.xp;
  slot.flight.xp = 0;
  const events: GameEvent[] = [{ type: 'orderDelivered', slot: index, coins: slot.flight.coins, xp, gems: slot.flight.gems, customer: order.customer, rare: order.rare }];
  for (const level of addXp(content, state, xp)) events.push({ type: 'levelUp', level });
  return { ok: true, events };
}

/** "Nhờ hàng xóm góp hàng": once a day, from helpLevel. */
function askNeighbors(content: ContentPack, state: GameState, index: number, now: number): Result {
  const order = state.orders.slots[index]?.order;
  if (!order) return fail('no_order');
  if (state.player.level < (content.orders.helpLevel ?? 1)) return fail('level_not_open');
  const day = localDay(content, now);
  if (state.orders.helpDay === day) return fail('help_used');
  state.orders.helpDay = day;
  const help = askNeighborsHelp(content, state, order, now);
  for (const h of help) {
    const bot = state.neighbors[h.botId];
    if (bot) bot.friendship += 1;
  }
  return { ok: true, events: [{ type: 'neighborsChipped', slot: index, help }] };
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

/** Chợ Mây (chỉ thị 07): buys from a neighbour's stall. Price ≥ 1,25 × shop price, ≤ 20 buys a day. */
function buyFromNeighbor(content: ContentPack, state: GameState, botId: string, itemId: string, qty: number, now: number): Result {
  const bot = state.neighbors[botId];
  if (!bot || !content.bots.has(botId)) return fail('unknown_neighbor');
  const listing = bot.stall.find((l) => l.itemId === itemId);
  if (!listing) return fail('unknown_listing');
  if (!Number.isInteger(qty) || qty <= 0 || qty > listing.qty) return fail('bad_quantity');
  const m = content.neighbors.market;
  const day = localDay(content, now);
  if (state.market.day !== day) state.market = { day, buys: 0 };
  if (state.market.buys >= m.buysPerDay) return fail('market_limit');
  const coins = playerPrice(content, state, listing) * qty;
  if (state.player.coins < coins) return fail('not_enough_coins');
  if (content.items.get(itemId)?.countsTowardStorage && storageFree(content, state) < qty) return fail('storage_full');
  state.player.coins -= coins;
  bot.coins += coins;
  bot.friendship += m.friendship;
  addItem(state, itemId, qty);
  listing.qty -= qty;
  if (listing.qty === 0) bot.stall.splice(bot.stall.indexOf(listing), 1);
  state.market.buys += 1;
  return { ok: true, events: [{ type: 'boughtFromNeighbor', botId, itemId, qty, coins }] };
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
