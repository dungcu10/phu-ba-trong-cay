// Command processor. Every change to the game goes through dispatch(): the command is validated
// first, and only applied if valid. The player UI and (later) BOTs use exactly this entry point.

import { isSoldInShop, type ContentPack, type FloorDef } from './content.ts';
import { floorAtIndex } from './floorgen.ts';
import type { BazaarSlot, GameState, SlotState } from './state.ts';
import { adjustedOffset, gameTime } from './clock.ts';
import { stochasticRound } from './rng.ts';
import { cropStatus, cycleDurationMs } from '../systems/growth.ts';
import { townDaily } from '../systems/town.ts';
import { settleLeague } from '../systems/league.ts';
import { friendGifts, helpsLeftToday, isEnemy, steal, stealWhileAway, useHelp, visitBug } from '../systems/social.ts';
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
import { floorUnlockCost } from '../systems/coinSinks.ts';
import { buyBazaar, ensureBazaar, rerollBazaar } from '../systems/bazaar.ts';
import { blowCloud, settleEnergy } from '../systems/sea.ts';
import { quickSellPlan } from '../systems/storage.ts';
import { combineShards, obtainPot as obtainPotFrom, starUpPot } from '../systems/potStars.ts';
import { castLine, claimFishBook, claimFreeBait, craftBait, exchangeFish, reelFish } from '../systems/fishing.ts';
import { buyDecor, placeDecor } from '../systems/decor.ts';
import { tapXuxu } from '../systems/xuxu.ts';
import { claimErrand, ensureErrands, rerollErrand, sendErrand, type ErrandReward } from '../systems/pets.ts';
import { activeSkill, advancePets, comboValue, dailyLeft, sparrowDailyGift, feedPet, giftKitten, guardFloor, jadeRainCooldownMs, obtainPet, patPet, petOf, replantOn, starUpPet, walkPet } from '../systems/pets.ts';
import { awardMedals, claimCheckIn, houseBonus, potBuyPrice, settleBuildings, upgradeHouse } from '../systems/village.ts';
import { allMissionsClaimed, ensureMissions, localDay, missionDef, recordMissions } from '../systems/missions.ts';
import { ensureQuestPeriods, questActive, questClaims, questReward, questView, recordQuests } from '../systems/quests.ts';
import { botGarden, helpReward, helpsLeft, helpToday, type HelpKind } from '../systems/visit.ts';
import { castPot } from '../systems/casting.ts';
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
  | { type: 'stealCrop'; botId: string; floor: number; slot: number }
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
  | { type: 'sellBugs'; itemId: string; qty: number }
  /** Chỉ thị 10 § 3.8: cast a crafted pot at the Lò Gốm. */
  | { type: 'castPot'; potId: string }
  | { type: 'rerollBazaar' }
  | { type: 'buyBazaar'; slot: number }
  | { type: 'blowCloud'; cell: number }
  | { type: 'quickSell' }
  | { type: 'tapXuxu' }
  | { type: 'upgradeHouse'; house: string }
  | { type: 'claimCheckIn' }
  | { type: 'obtainPet'; species: string; pay: 'coins' | 'gems' | 'shards' }
  | { type: 'feedPet'; species: string; itemId: string }
  | { type: 'patPet'; species: string }
  | { type: 'walkPet'; species: string; active: boolean }
  | { type: 'toggleReplant'; on: boolean }
  | { type: 'guardFloor'; species: string; floor: number }
  | { type: 'starUpPet'; species: string }
  | { type: 'jadeRain' }
  | { type: 'sendErrand'; index: number; species: string }
  | { type: 'rerollErrand'; index: number }
  | { type: 'claimErrand'; index: number }
  | { type: 'starUpPot'; potInstanceId: string }
  | { type: 'combineShards'; potId: string }
  | { type: 'claimFreeBait' }
  | { type: 'craftBait'; bait: string }
  | { type: 'castLine'; bait: string }
  | { type: 'reelFish'; success: boolean }
  | { type: 'exchangeFish'; fishId: string; option: number }
  | { type: 'claimFishBook' }
  | { type: 'buyDecor'; itemId: string }
  | { type: 'placeDecor'; floor: number; slot: number; itemId: string | null };

export type GameEvent =
  | { type: 'planted'; slot: SlotRef; cropId: string; cost: number }
  | { type: 'watered'; slot: SlotRef; savedMs: number }
  | { type: 'bugCaught'; slot: SlotRef; itemId: string }
  | BirdEvent
  | WorkshopEvent
  | { type: 'birdObtained'; birdId: string; species: string; rented: boolean }
  | { type: 'birdFed'; birdId: string; food: number }
  | { type: 'newBug'; itemId: string }
  | { type: 'harvested'; slot: SlotRef; itemId: string; qty: number; xp: number; cleared: boolean; mutation: string | null; doubled?: boolean; helper?: boolean }
  | { type: 'giftFound'; slot: SlotRef; gift: Gift }
  | { type: 'ordersArrived'; slots: number[] }
  | { type: 'orderDelivered'; slot: number; coins: number; xp: number; gems: number; customer: string; rare: boolean }
  | { type: 'orderSkipped'; slot: number }
  | Exclude<OrderWorldEvent, { type: 'levelUp' }>
  | { type: 'bugsSold'; itemId: string; qty: number; coins: number }
  | { type: 'potCast'; potInstanceId: string; potId: string; perfect: boolean }
  | { type: 'bazaarRerolled'; coins: number; best: BazaarSlot['rarity']; sure: BazaarSlot['rarity'] | null }
  | { type: 'bazaarRefreshed' }
  | { type: 'petObtained'; species: string; gift: boolean }
  | { type: 'petFed'; species: string; liked: boolean; bond: number; levelUps: number[]; milestones: number[] }
  | { type: 'petPatted'; species: string; bond: number; milestones: number[] }
  | { type: 'petWalked'; species: string; active: boolean }
  | { type: 'petGuards'; species: string; floor: number }
  | { type: 'petStarred'; species: string; stars: number }
  | { type: 'petCaught'; species: string; itemId: string; floor: number }
  | { type: 'errandSent'; index: number; species: string; endsAt: number }
  | { type: 'errandRerolled'; index: number; errand: string }
  | ({ type: 'errandClaimed'; index: number; species: string } & ErrandReward)
  | { type: 'jadeRained'; floor: number; pots: number; savedMs: number }
  | { type: 'petHarvested'; species: string; floor: number; pots: number; stopped: boolean }
  | { type: 'petReplanted'; species: string; slot: SlotRef; cropId: string }
  | { type: 'blessed'; slot: SlotRef; qty: number }
  | { type: 'replantToggled'; on: boolean }
  | { type: 'sparrowGift'; bags: number; coins: number; items: Record<string, number> }
  | { type: 'seedRefunded'; slot: SlotRef; coins: number }
  | { type: 'houseUpgradeStarted'; house: string; level: number; endsAt: number; coins: number }
  | { type: 'houseUpgraded'; house: string; level: number }
  | { type: 'medalAwarded'; floor: number; potInstanceId?: string }
  | { type: 'checkedIn'; day: number; coins: number; gems: number; items: Record<string, number> }
  | { type: 'xuxuTapped'; line: string; gift: { coins: number; items: Record<string, number> } | null }
  | { type: 'baitGot'; itemId: string; qty: number; free: boolean }
  | { type: 'lineCast'; fishId: string; bait: string }
  | { type: 'fishReeled'; fishId: string; landed: boolean; first: boolean }
  | { type: 'fishExchanged'; fishId: string; coins: number; items: Record<string, number> }
  | { type: 'fishBookClaimed'; index: number; gems: number; items: Record<string, number> }
  | { type: 'decorBought'; itemId: string; coins: number }
  | { type: 'decorPlaced'; floor: number; slot: number; itemId: string | null; removed: string | null }
  | { type: 'potStarred'; potInstanceId: string; stars: number; shards: number }
  | { type: 'potCombined'; potInstanceId: string; potId: string }
  | { type: 'potToShards'; potId: string; itemId: string; qty: number }
  | { type: 'quickSold'; items: Array<{ itemId: string; qty: number }>; coins: number }
  | { type: 'cloudBlown'; cell: number; finds: Array<{ itemId: string; qty: number }>; chest?: number; potInstanceId?: string; cleared?: { gems: number } }
  | { type: 'bazaarBought'; slot: number; rarity: BazaarSlot['rarity']; kind: 'item' | 'pot'; itemId: string; qty: number; currency: 'coins' | 'gems'; price: number; potInstanceId?: string }
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
  | { type: 'neighborHelped'; botId: string; floor: number; slot: number; kind: HelpKind; coins: number; xp: number; bugId?: string }
  | { type: 'cropStolen'; botId: string; floor: number; slot: number; itemId: string; qty: number; mutation: string | null; seed: string | null; enemy: boolean; double: boolean }
  | { type: 'stealCaught'; botId: string; floor: number; slot: number }
  | { type: 'takenWhileAway'; list: Array<{ botId: string; itemId: string; qty: number; at: number }> }
  | { type: 'friendGift'; botId: string; at: number; coins: number; items: Record<string, number> }
  | { type: 'townChanged'; left: string[]; came: string[] }
  | { type: 'leagueSettled'; week: number; points: number; tier: number; rank: number; newTier: number; coins: number; gems: number; items: Record<string, number>; pot: string | null }
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
  | 'enemy_garden'
  | 'not_ripe'
  | 'already_stolen'
  | 'no_steal_turns'
  | 'not_available'
  | 'unknown_neighbor'
  | 'level_not_open'
  | 'not_obtainable'
  | 'nothing_growing'
  | 'unknown_quest'
  | 'quest_not_ready'
  | 'market_limit'
  | BirdError
  | 'help_used'
  | 'not_castable'
  | 'already_bought'
  | 'nothing_to_sell'
  | 'pot_max_stars'
  | 'no_bait'
  | 'casts_used'
  | 'unknown_house'
  | 'unknown_pet'
  | 'have_it'
  | 'no_pet'
  | 'cannot_eat'
  | 'pet_full'
  | 'no_walk_slot'
  | 'bad_floor'
  | 'pet_max_stars'
  | 'pet_level_low'
  | 'cooldown'
  | 'pet_away'
  | 'pet_asleep'
  | 'errand_busy'
  | 'not_back'
  | 'no_reroll'
  | 'house_max_level'
  | 'busy'
  | 'no_build_slot'
  | 'line_busy'
  | 'nothing_hooked'
  | 'bad_option'
  | 'unknown_floor'
  | 'unknown_item'
  | 'bad_cell'
  | 'already_open'
  | 'no_energy'
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
  // Chỉ thị 12 B3: neighbours follow the player's level, move house now and then (before the ranks snapshot).
  const town = townDaily(content, state, now);
  if (town.left.length || town.came.length) events.push({ type: 'townChanged', ...town });
  snapshotRanks(content, state, localDay(content, now));
  if (ensureBazaar(content, state, now)) events.push({ type: 'bazaarRefreshed' });
  settleEnergy(content, state, now);
  for (const d of settleBuildings(content, state, now)) events.push({ type: 'houseUpgraded', ...d });
  for (const m of awardMedals(content, state, now)) events.push({ type: 'medalAwarded', ...m });
  ensureErrands(content, state, now);
  // Chỉ thị 12 B3: the weekly league.
  const league = settleLeague(content, state, now, (potId) => {
    const got = obtainPotFrom(content, state, potId, 'event', now);
    events.push('potInstanceId' in got ? { type: 'potObtained', potInstanceId: got.potInstanceId, potId, source: 'event' } : { type: 'potToShards', potId, ...got.shards });
  });
  if (league) events.push({ type: 'leagueSettled', ...league });
  if (giftKitten(content, state, now)) events.push({ type: 'petObtained', species: state.pets.at(-1)!.species, gift: true });
  events.push(...simulateNeighbors(content, state, now));
  return events;
}

export function dispatch(content: ContentPack, state: GameState, cmd: Command, realNow: number): Result {
  const seen = state.maxSeenAt;
  const now = advanceTime(state, realNow);
  // Chỉ thị 12 B4.2.3: neighbours only come for your crops while the game was closed (a long gap).
  const taken = stealWhileAway(content, state, seen, now);
  ensureMissions(content, state, now);
  ensureQuestPeriods(content, state, now);
  // Birds work in time order up to now, before the player acts, with the player's own catchBug.
  const birdEvents = [...runBirds(content, state, now), ...runPets(content, state, now), ...collectWorkshop(content, state, now)];
  if (taken.length > 0) birdEvents.push({ type: 'takenWhileAway', list: taken });
  const ran = run(content, state, cmd, now);
  // Chỉ thị 12 B5: friendship marks (3, 6, 10) bring a gift, whatever raised the friendship.
  if (ran.ok) for (const id of Object.keys(state.neighbors)) for (const g of friendGifts(content, state, id)) ran.events.push({ type: 'friendGift', botId: id, ...g });
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

/** Chỉ thị 11 § E: pets work in time order up to now with the player's own catchBug. */
function runPets(content: ContentPack, state: GameState, now: number): GameEvent[] {
  if (!content.pets || state.pets.length === 0) return [];
  const extra: GameEvent[] = [];
  const out = advancePets(content, state, now, (floor, slot, at) => {
    const r = catchBug(content, state, { floor, slot }, at);
    if (!r.ok) return { ok: false };
    for (const e of r.events) if (e.type === 'newBug') extra.push(e);
    const caught = r.events.find((e) => e.type === 'bugCaught');
    return { ok: true, itemId: caught?.type === 'bugCaught' ? caught.itemId : undefined };
  });
  const gift = sparrowDailyGift(content, state, now);
  if (gift) extra.push({ type: 'sparrowGift', ...gift });
  return [...(out as GameEvent[]), ...extra, ...runHarvestHelp(content, state, now)];
}

/** Sẻ Thu Hoạch Hộ (§ E1): every (4 → 2) hours the sparrow harvests the ripe pots on its floor with
 *  the player's own harvest (half XP), in time order up to now (at most a day back). Stops when the
 *  storage is full. Gieo Lại Như Cũ follows each cleared pot. */
function runHarvestHelp(content: ContentPack, state: GameState, now: number): GameEvent[] {
  const p = petOf(state, 'pet.sprout-sparrow');
  if (!p) return [];
  const events: GameEvent[] = [];
  let t = p.skillAt.harvestHelpAt ?? now;
  if (t < now - 24 * 3_600_000) t = now - 24 * 3_600_000;
  for (let guard = 0; guard < 64; guard++) {
    const sk = activeSkill(content, state, 'harvestHelp', t, p.floor);
    const step = (sk?.value ?? 4) * 3_600_000;
    if (t + step > now) break;
    t += step;
    if (!activeSkill(content, state, 'harvestHelp', t, p.floor)) continue;
    const floor = state.floors[p.floor];
    if (!floor) break;
    let pots = 0;
    let stopped = false;
    for (let i = 0; i < floor.slots.length; i++) {
      const ref = { floor: p.floor, slot: i };
      const r = harvest(content, state, ref, t, 0.5);
      if (!r.ok) {
        if (r.error === 'storage_full') {
          stopped = true;
          break;
        }
        continue;
      }
      pots += 1;
      events.push(...r.events, ...replantAfter(content, state, ref, r.events, t));
    }
    if (pots > 0 || stopped) events.push({ type: 'petHarvested', species: p.species, floor: p.floor, pots, stopped });
  }
  p.skillAt.harvestHelpAt = t;
  return events;
}

/** Sẻ Gieo Lại Như Cũ: a pot just cleared on the sparrow's floor is planted again with the same crop
 *  (the player's own plant, paying the seed), at most (20 → 60) a day; has an on/off switch. */
function replantAfter(content: ContentPack, state: GameState, ref: SlotRef, events: GameEvent[], now: number): GameEvent[] {
  const h = events.find((e) => e.type === 'harvested');
  if (!h || h.type !== 'harvested' || !h.cleared) return [];
  const sk = activeSkill(content, state, 'replant', now, ref.floor);
  if (!sk || !replantOn(sk.pet)) return [];
  const crop = content.cropList.find((c) => c.produce.id === (content.items.get(h.itemId)?.baseItem ?? h.itemId));
  if (!crop || state.player.coins < crop.seedPrice || dailyLeft(content, sk.pet, 'replant', sk.value, now) <= 0) return [];
  const r = plant(content, state, ref, crop.id, now);
  if (!r.ok) return [];
  dailyLeft(content, sk.pet, 'replant', sk.value, now, true);
  return [...r.events, { type: 'petReplanted', species: sk.pet.species, slot: ref, cropId: crop.id }];
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
    case 'castPot': {
      const r = castPot(content, state, cmd.potId, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'potCast', potInstanceId: r.potInstanceId, potId: cmd.potId, perfect: r.perfect }] };
    }
    case 'blowCloud': {
      const r = blowCloud(content, state, cmd.cell, now);
      if (typeof r === 'string') return fail(r);
      return { ok: true, events: [{ type: 'cloudBlown', ...r }] };
    }
    case 'rerollBazaar': {
      const r = rerollBazaar(content, state, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'bazaarRerolled', coins: r.coins, best: r.best, sure: r.sure }] };
    }
    case 'buyBazaar': {
      const r = buyBazaar(content, state, cmd.slot, now);
      if (typeof r === 'string') return fail(r);
      const s = r.slot;
      const events: GameEvent[] = [{ type: 'bazaarBought', slot: cmd.slot, rarity: s.rarity, kind: s.kind, itemId: s.id, qty: s.qty, currency: s.currency, price: s.price, ...(r.potInstanceId ? { potInstanceId: r.potInstanceId } : {}) }];
      if (r.shards) events.push({ type: 'potToShards', potId: s.id, ...r.shards });
      return { ok: true, events };
    }
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
    case 'harvest': {
      const r = harvest(content, state, cmd, now);
      return r.ok ? { ok: true, events: [...r.events, ...replantAfter(content, state, cmd, r.events, now)] } : r;
    }
    case 'toggleReplant': {
      const p = state.pets.find((x) => x.species === 'pet.sprout-sparrow');
      if (!p) return fail('no_pet');
      if (cmd.on) p.skillAt.replantOn = 1;
      else delete p.skillAt.replantOn;
      return { ok: true, events: [{ type: 'replantToggled', on: cmd.on }] };
    }
    case 'sell':
      return sell(content, state, cmd.itemId, cmd.qty, now);
    case 'obtainPet': {
      const r = obtainPet(content, state, cmd.species, cmd.pay, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petObtained', species: cmd.species, gift: false }] };
    }
    case 'feedPet': {
      const r = feedPet(content, state, cmd.species, cmd.itemId, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petFed', species: cmd.species, ...r }] };
    }
    case 'patPet': {
      const r = patPet(content, state, cmd.species, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petPatted', species: cmd.species, ...r }] };
    }
    case 'walkPet': {
      const r = walkPet(content, state, cmd.species, cmd.active, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petWalked', species: cmd.species, active: r.active }] };
    }
    case 'guardFloor': {
      const r = guardFloor(state, cmd.species, cmd.floor, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petGuards', species: cmd.species, floor: r.floor }] };
    }
    case 'starUpPet': {
      const r = starUpPet(content, state, cmd.species);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'petStarred', species: cmd.species, stars: r.stars }] };
    }
    case 'jadeRain':
      return jadeRain(content, state, now);
    case 'sendErrand': {
      const r = sendErrand(content, state, cmd.index, cmd.species, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'errandSent', index: cmd.index, species: cmd.species, endsAt: r.endsAt }] };
    }
    case 'rerollErrand': {
      const r = rerollErrand(content, state, cmd.index, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'errandRerolled', index: cmd.index, errand: r.errand }] };
    }
    case 'claimErrand': {
      const species = state.errands.list[cmd.index]?.pet ?? '';
      const r = claimErrand(content, state, cmd.index, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'errandClaimed', index: cmd.index, species, ...r }] };
    }
    case 'upgradeHouse': {
      const r = upgradeHouse(content, state, cmd.house, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'houseUpgradeStarted', house: cmd.house, ...r }] };
    }
    case 'claimCheckIn': {
      const r = claimCheckIn(content, state, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'checkedIn', day: r.day, coins: r.reward.coins ?? 0, gems: r.reward.gems ?? 0, items: r.reward.items ?? {} }] };
    }
    case 'tapXuxu': {
      const r = tapXuxu(content, state, now);
      return { ok: true, events: [{ type: 'xuxuTapped', ...r }] };
    }
    case 'claimFreeBait': {
      const r = claimFreeBait(content, state, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'baitGot', ...r, free: true }] };
    }
    case 'craftBait': {
      const r = craftBait(content, state, cmd.bait);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'baitGot', itemId: r.itemId, qty: 1, free: false }] };
    }
    case 'castLine': {
      const r = castLine(content, state, cmd.bait, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'lineCast', fishId: r.fish.id, bait: cmd.bait }] };
    }
    case 'reelFish': {
      const r = reelFish(content, state, cmd.success, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'fishReeled', ...r }] };
    }
    case 'exchangeFish': {
      const r = exchangeFish(content, state, cmd.fishId, cmd.option);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'fishExchanged', fishId: cmd.fishId, ...r }] };
    }
    case 'claimFishBook': {
      const r = claimFishBook(content, state);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'fishBookClaimed', ...r }] };
    }
    case 'buyDecor': {
      const r = buyDecor(content, state, cmd.itemId);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'decorBought', itemId: cmd.itemId, coins: r.coins }] };
    }
    case 'placeDecor': {
      const r = placeDecor(content, state, cmd.floor, cmd.slot, cmd.itemId);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'decorPlaced', floor: cmd.floor, slot: cmd.slot, itemId: cmd.itemId, removed: r.removed }] };
    }
    case 'starUpPot': {
      const r = starUpPot(content, state, cmd.potInstanceId);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'potStarred', potInstanceId: cmd.potInstanceId, ...r }] };
    }
    case 'combineShards': {
      const r = combineShards(content, state, cmd.potId, now);
      return typeof r === 'string' ? fail(r) : { ok: true, events: [{ type: 'potCombined', potInstanceId: r.potInstanceId, potId: cmd.potId }] };
    }
    case 'quickSell': {
      // Chỉ thị 12 A2: sell all of the Kho Nông Sản beyond what the open orders still need.
      const plan = quickSellPlan(content, state, now);
      if (plan.length === 0) return fail('nothing_to_sell');
      let coins = 0;
      for (const p of plan) {
        removeItem(state, p.itemId, p.qty);
        coins += p.coins;
      }
      state.player.coins += coins;
      state.stats.coinsEarned += coins;
      return { ok: true, events: [{ type: 'quickSold', items: plan.map((p) => ({ itemId: p.itemId, qty: p.qty })), coins }] };
    }
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
    case 'stealCrop': {
      const r = steal(content, state, cmd.botId, cmd.floor, cmd.slot, now);
      if (typeof r === 'string') return fail(r as ErrorCode);
      if (r.caught) return { ok: true, events: [{ type: 'stealCaught', botId: cmd.botId, floor: cmd.floor, slot: cmd.slot }] };
      state.league.steals += 1;
      return { ok: true, events: [{ type: 'cropStolen', botId: cmd.botId, floor: cmd.floor, slot: cmd.slot, itemId: r.itemId!, qty: r.qty, mutation: r.mutation, seed: r.seed, enemy: r.enemy, double: r.double }] };
    }
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
    const got = obtainPotFrom(content, state, r.pot, 'event', now);
    events.push('potInstanceId' in got ? { type: 'potObtained', potInstanceId: got.potInstanceId, potId: r.pot, source: 'event' } : { type: 'potToShards', potId: r.pot, ...got.shards });
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
  const cost = expandCost(def, floor, content, state.player.level);
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
  // Chỉ thị 12 B5: one daily allowance over all gardens (perDay); older content keeps the per-garden one.
  const global = content.neighbors.help.perDay !== undefined;
  if (global ? helpsLeftToday(content, state, now) <= 0 : helpsLeft(content, bot, now) <= 0) return fail('help_limit');
  const pot = botGarden(content, state, cmd.botId, now)[cmd.floor]?.pots[cmd.slot];
  if (!pot) return fail('bad_slot');
  if (pot.need !== cmd.kind) return fail('no_help_needed');
  // Catching bugs for an enemy gives nothing (B4.2.4): say so instead of using a turn.
  if (isEnemy(state, cmd.botId, now)) return fail('enemy_garden');
  const day = localDay(content, now);
  bot.help = { day, pots: [...helpToday(content, bot, now).filter(() => bot.help.day === day), pot.key] };
  if (global) useHelp(content, state, now);
  state.league.helps += 1;
  bot.friendship += content.neighbors.help.friendship;
  const r = helpReward(content, bot);
  // B5: the bug caught in a neighbour's garden goes to the player's own bag.
  const bugId = cmd.kind === 'bug' && global ? visitBug(content, state, cmd.botId, pot, now) : undefined;
  if (bugId) {
    addItem(state, bugId, 1);
    state.stats.bugsCaught += 1;
  }
  const events: GameEvent[] = [{ type: 'neighborHelped', botId: cmd.botId, floor: cmd.floor, slot: cmd.slot, kind: cmd.kind, ...r, ...(bugId ? { bugId } : {}) }];
  giveReward(content, state, { ...r, gems: 0 }, events);
  return { ok: true, events };
}

function plant(content: ContentPack, state: GameState, ref: SlotRef, cropId: string, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  if (slot.planting) return fail('slot_busy');
  const crop = content.crops.get(cropId);
  if (!crop) return fail('unknown_crop');
  // Chỉ thị 12 B4.2.1: a seed found while stealing plants a crop above the player's level once (free).
  const trial = crop.unlockLevel > state.player.level && (state.social.trialSeeds[cropId] ?? 0) > 0;
  if (crop.unlockLevel > state.player.level && !trial) return fail('locked');
  if (!trial && state.player.coins < crop.seedPrice) return fail('not_enough_coins');
  if (trial) {
    state.social.trialSeeds[cropId]! -= 1;
    if (state.social.trialSeeds[cropId]! <= 0) delete state.social.trialSeeds[cropId];
  } else state.player.coins -= crop.seedPrice;
  // Chỉ thị 11 § E1: Sẻ Mầm Nhặt Hạt on its floor — a chance to get the seed money back.
  const pick = activeSkill(content, state, 'pickSeeds', now, ref.floor);
  const refunded = !trial && !!pick && crop.seedPrice > 0 && randomFor(state.seed, 'pickSeeds', state.nextId) < pick.value;
  if (refunded) state.player.coins += crop.seedPrice;
  slot.planting = {
    id: state.nextId++,
    cropId,
    seedCost: trial ? 0 : crop.seedPrice,
    cycleStartedAt: now,
    harvestsDone: 0,
    bonusMs: 0,
    wateredStages: [],
    caughtBugs: {},
    bugLevel: state.player.level,
  };
  seasonHead(content, state, slot, ref.floor, now);
  const events: GameEvent[] = [{ type: 'planted', slot: ref, cropId, cost: crop.seedPrice }];
  if (refunded) events.push({ type: 'seedRefunded', slot: ref, coins: crop.seedPrice });
  return { ok: true, events };
}

/** Mùa Màng (§ E4): on a floor that Sẻ and Rồng look after together, a new cycle starts with 8% of its
 *  growing time already done (kept in the planting, so it never changes afterwards). */
function seasonHead(content: ContentPack, state: GameState, slot: SlotState, floor: number, now: number): void {
  const g = comboValue(content, state, 'growth', now, floor);
  if (g <= 0 || !slot.planting) return;
  slot.planting.bonusMs += cycleDurationMs(content, state, slot, slot.planting) * g;
}

function water(content: ContentPack, state: GameState, ref: SlotRef, now: number): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  if (!status || !slot.planting) return fail('slot_empty');
  if (!status.thirsty) return fail('not_thirsty');
  // Care (POT_SYSTEM 5) makes each watering save more of the remaining time.
  const care = slotBonus(content, state, slot, status.crop, 'care');
  // Cáo Lửa Ấm (§ E1): on the fox's floor the water lasts longer — each watering saves (20 → 50)% more.
  const warm = activeSkill(content, state, 'warmFire', now, ref.floor)?.value ?? 0;
  const savedMs = status.remainingMs * content.config.water.remainingTimeReduction * (1 + care) * (1 + warm);
  slot.planting.bonusMs += savedMs;
  slot.planting.wateredStages.push(status.stage);
  return { ok: true, events: [{ type: 'watered', slot: ref, savedMs }] };
}

/** Rồng Mưa Ngọc (chỉ thị 11 § E1): waters the dragon's whole floor with the player's own water, then
 *  takes (5 → 15)% off every pot's remaining growing time. Cooldown 8 → 4 hours by stars. */
function jadeRain(content: ContentPack, state: GameState, now: number): Result {
  const sk = activeSkill(content, state, 'jadeRain', now);
  if (!sk) return fail(state.pets.some((p) => p.species === 'pet.jade-dragon') ? 'pet_asleep' : 'no_pet');
  if ((sk.pet.skillAt.jadeRain ?? 0) > now) return fail('cooldown');
  const floor = state.floors[sk.pet.floor];
  if (!floor) return fail('bad_floor');
  let pots = 0;
  let savedMs = 0;
  floor.slots.forEach((slot, i) => {
    if (!slot.planting) return;
    water(content, state, { floor: sk.pet.floor, slot: i }, now);
    const st = cropStatus(content, state, slot, now);
    if (!st || st.ripe || !slot.planting) return;
    const cut = st.remainingMs * sk.value;
    slot.planting.bonusMs += cut;
    savedMs += cut;
    pots += 1;
  });
  sk.pet.skillAt.jadeRain = now + jadeRainCooldownMs(content, sk.pet, state, now);
  return { ok: true, events: [{ type: 'jadeRained', floor: sk.pet.floor, pots, savedMs }] };
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

function harvest(content: ContentPack, state: GameState, ref: SlotRef, now: number, xpScale = 1): Result {
  const slot = slotAt(state, ref);
  if (!slot) return fail('bad_slot');
  const status = cropStatus(content, state, slot, now);
  const planting = slot.planting;
  if (!status || !planting) return fail('slot_empty');
  if (!status.ripe) return fail('not_ripe');
  const crop = status.crop;
  const luck = slotBonus(content, state, slot, crop, 'luck');
  const potInst = state.pots[slot.potInstanceId]!;
  // Chỉ thị 11 § E1: Rồng Long Khí on its floor raises the mutation chance.
  const breath = activeSkill(content, state, 'dragonBreath', now, ref.floor)?.value ?? 0;
  const mutation = rollMutation(content, state, planting, luck, mutationMultiplier(content, potInst) * (1 + breath));
  const itemId = mutation ? `${crop.produce.id}~${mutation}` : crop.produce.id;
  const cycleSeconds = planting.harvestsDone === 0 || crop.regrowSeconds === null ? crop.growSeconds : crop.regrowSeconds;
  const gift = rollGift(content, state, planting, cycleSeconds, luck);
  const baseQty = stochasticRound(crop.yield * (1 + slotBonus(content, state, slot, crop, 'yield')), state.seed, 'yield', planting.id, planting.harvestsDone);
  const doubled = randomFor(state.seed, 'double', planting.id, planting.harvestsDone) < doubleYieldChance(content, potInst);
  // Rồng Ban Lộc (§ E1): once a day the next harvest on the dragon's floor is doubled.
  const bless = activeSkill(content, state, 'blessing', now, ref.floor);
  const blessed = !!bless && dailyLeft(content, bless.pet, 'blessing', Math.max(1, Math.round(bless.value)), now) > 0;
  // Chỉ thị 12 B4.2.3: what neighbours took while the game was closed (never from a mutated harvest).
  const taken = mutation ? 0 : (planting.stolen ?? 0);
  const qty = Math.max(1, (doubled ? baseQty * 2 : baseQty) * (blessed ? 2 : 1) - taken);
  const xp = stochasticRound(crop.xp * (1 + slotBonus(content, state, slot, crop, 'xp')) * xpScale, state.seed, 'xp', planting.id, planting.harvestsDone);
  if (storageFree(content, state) < qty) return fail('storage_full');
  if (blessed) dailyLeft(content, bless.pet, 'blessing', Math.max(1, Math.round(bless.value)), now, true);

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
    delete planting.stolen;
    planting.wateredStages = [];
    planting.caughtBugs = {};
    seasonHead(content, state, slot, ref.floor, now);
  }
  events.push({ type: 'harvested', slot: ref, itemId, qty, xp, cleared, mutation, doubled, ...(xpScale < 1 ? { helper: true } : {}) });
  if (blessed) events.push({ type: 'blessed', slot: ref, qty });
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
  const got = r.pot ? obtainPotFrom(content, state, r.pot, 'quest', now) : null;
  const events: GameEvent[] = [{ type: 'questClaimed', questId, tier, coins: r.coins, gems: r.gems, xp: r.xp, items: r.items, pot: r.pot }];
  if (got && 'shards' in got) events.push({ type: 'potToShards', potId: r.pot!, ...got.shards });
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
  const cost = floorUnlockCost(content, def, state.player.level);
  if (state.player.coins < cost) return fail('not_enough_coins');
  const items = def.unlockItems ?? {};
  if (!canAfford(state, { coins: 0, items })) return fail('not_enough_items');
  state.player.coins -= cost;
  for (const [id, q] of Object.entries(items)) removeItem(state, id, q);
  const index = state.floors.length;
  state.floors.push(createFloorState(def, state.pots, index));
  return { ok: true, events: [{ type: 'floorUnlocked', floorId, index, cost }] };
}

function buyPot(content: ContentPack, state: GameState, potId: string): Result {
  const def = content.pots.get(potId);
  if (!def) return fail('unknown_pot');
  if (!isSoldInShop(def)) return fail('not_for_sale');
  if (def.unlockLevel > state.player.level) return fail('locked');
  const price = potBuyPrice(content, state, def.price);
  if (state.player.coins < price) return fail('not_enough_coins');
  state.player.coins -= price;
  const potInstanceId = grantPot(state, potId, 'shop', state.maxSeenAt);
  return { ok: true, events: [{ type: 'potBought', potInstanceId, potId, cost: price }] };
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
  if (state.stall.length >= cfg.stallSlots + houseBonus(content, state, 'market', 'stallSlots')) return fail('stall_full');
  removeItem(state, itemId, qty);
  const listingId = state.nextId++;
  state.stall.push({ id: listingId, itemId, qty, price, qty0: qty });
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
