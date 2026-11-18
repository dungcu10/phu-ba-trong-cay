// Game state: plain data only, serializable to JSON as-is. No class instances, no functions.

import type { ContentPack, FloorDef } from './content.ts';
import { newSeed } from './rng.ts';
import { emptyQuestState, type QuestState } from '../systems/quests.ts';

export const SAVE_VERSION = 15;

export interface Planting {
  /** Unique per planting, used as a key for deterministic randomness. */
  id: number;
  cropId: string;
  /** Coins paid for the seed; refunded if this crop is ever removed from the game. */
  seedCost: number;
  /** Start of the current growth cycle (first growth or a regrow), in ms. */
  cycleStartedAt: number;
  /** Number of harvests already taken from this planting. */
  harvestsDone: number;
  /** Growth time already skipped by watering in this cycle, in ms. */
  bonusMs: number;
  /** Stage indexes already watered in this cycle. */
  wateredStages: number[];
  /** Bọ Mây caught in this cycle, per bug id. */
  caughtBugs: Record<string, number>;
  /** Chỉ thị 12 B4.2.3: produce neighbours took from this cycle while the game was closed. */
  stolen?: number;
  /**
   * Chỉ thị 10 (save 12): player level when planted. Its presence means the bugs of this planting are
   * of several kinds (§ 3.2); plantings from older saves keep attracting only Bọ Rùa Mây.
   */
  bugLevel?: number;
}

export interface SlotState {
  potInstanceId: string;
  planting: Planting | null;
}

export interface FloorState {
  floorId: string;
  slots: SlotState[];
  /** Floor stars earned (0–3, REDESIGN_V2 2.1). */
  stars: number;
  /** Chỉ thị 10 § 3.10 (save 12): decoration item ids in the floor's 2 decor slots (null = empty). */
  decor: Array<string | null>;
}

/** Chỉ thị 10 § 3.3 (save 12): a bird that catches bugs. */
export interface BirdState {
  /** Instance id ("bird-3"). */
  id: string;
  species: string;
  level: number;
  /** Bugs caught in its whole life (drives its level). */
  caught: number;
  /** Fullness 0–100 at `fedAt`; it drains over time from there. */
  food: number;
  fedAt: number;
  /** Floor index it perches on and which branch (0 or 1), or null while not placed. */
  floor: number | null;
  branch: number;
  /** Rented birds fly away at this time; null = owned. */
  rentUntil: number | null;
  /** Game time up to which its catching has been simulated. */
  simulatedTo: number;
  /** Bugs caught on local day `day` (bird panel). */
  today: { day: number; count: number };
  /** Order slot index it is escorting (§ 3.6), with the time it comes back; null = at home. */
  escort: { slot: number; until: number } | null;
}

/** Chỉ thị 10 § 3.5 (save 12): one machine of the Xưởng Bọ. */
export interface MachineState {
  stars: number;
  /** Open queue slots (2–4). */
  slots: number;
  /** Jobs in order; each starts when the previous one ends. Finished jobs wait to be collected. */
  queue: Array<{ recipe: string; endsAt: number }>;
}

/** Chỉ thị 10 § 3.7 (save 12): the Biển Mây map of the current day. */
export interface SeaMapState {
  /** Map number (a new map after one is cleared) and the local day it belongs to. */
  day: number;
  index: number;
  /** Cells blown open (row-major 6×8 = 48 cells). */
  open: number[];
  /** Chest cells already opened. */
  chests: number[];
  cleared: boolean;
}

export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface PotInstance {
  potId: string;
  level: number;
  /** Game time it was obtained (POT_SYSTEM 8), and how. */
  obtainedAt?: number;
  source?: 'start' | 'shop' | 'floor' | 'exchange' | 'event' | 'old-save' | 'quest' | 'cast' | 'bazaar' | 'sea' | 'combine';
  /** Every level reached, with the time (kept small: one entry per level, at most 50). */
  history?: Array<{ level: number; at: number }>;
  /** Pot stars (chỉ thị 10 § 3.8 "Hoàn Mỹ", chỉ thị 12 B7.2): each star raises every stat a little. */
  stars?: number;
}

/** Collection record per pot line: survives even if the pot itself is gone. */
export interface PotBookEntry {
  firstAt: number;
  bestLevel: number;
}

export interface Order {
  id: number;
  /** Neighbour who placed the order. */
  customer: string;
  items: Record<string, number>;
  coins: number;
  xp: number;
  gems: number;
  rare: boolean;
  /** Chỉ thị 10 § 3.6: a rare order leaves at this time; an extra item it pays (Sợi Mây / Giọt Sương). */
  expiresAt?: number;
  bonusItem?: string;
  /** Items neighbours chipped in (they count toward the order). */
  given?: Record<string, number>;
}

/** A balloon on its way with a sent order: it pays when it comes back (chỉ thị 10 § 3.6). */
export interface OrderFlight {
  coins: number;
  xp: number;
  gems: number;
  items: Record<string, number>;
  customer: string;
  rare: boolean;
  /** Escorting bird (its species bonus is added when the balloon comes back), or null. */
  bird: string | null;
}

export interface OrderSlot {
  order: Order | null;
  /** When an empty slot receives its next order (the balloon's return). */
  readyAt: number;
  flight?: OrderFlight | null;
}

export interface JournalEntry {
  harvests: number;
  mutations: Record<string, number>;
  /** How many harvest milestones have been rewarded. */
  claimed: number;
}

export interface BotState {
  level: number;
  xp: number;
  coins: number;
  /** Value invested in the neighbour's own garden (counts on the leaderboard). */
  gardenValue: number;
  friendship: number;
  /** Game time up to which this neighbour has been simulated. */
  simulatedTo: number;
  lastAction: { kind: string; reason: string; at: number } | null;
  /** Pots the player helped in this neighbour's garden today (local day number, pot keys). */
  help: { day: number; pots: string[] };
  /** Chỉ thị 12 B5: friendship marks already rewarded (count of friendMilestones reached). */
  friendGifts?: number;
  /** Chợ Mây (save 11): what this neighbour has laid out for the player to buy. */
  stall: BotListing[];
  /** Chỉ thị 11 D1: the neighbour's birds (same rules as the player's) and the bugs they caught. */
  birds: BirdState[];
  bugs: Record<string, number>;
  /** Chỉ thị 11 § I: the neighbour's village houses and pets (same rules as the player's; absent in older saves). */
  buildings?: GameState['buildings'];
  pets?: PetState[];
  errands?: GameState['errands'];
}

export interface BotListing {
  itemId: string;
  qty: number;
  /** Asking price per item before the "not unlocked yet" factor. */
  price: number;
}

export interface Listing {
  id: number;
  itemId: string;
  qty: number;
  /** Price per item asked by the player. */
  price: number;
  /** How many were first laid out (Mèo Tự Bày Hàng lays out the same again). */
  qty0?: number;
}

/** Things that happened while the player was away or not looking, shown as letters. */
export interface Notice {
  at: number;
  text: string;
  read: boolean;
}

export interface GameState {
  saveVersion: number;
  contentVersion: number;
  createdAt: number;
  seed: number;
  /** Latest game time ever seen; game time never goes below it. */
  maxSeenAt: number;
  /** Added to the device clock to get game time; grows when the device clock is found behind. */
  clockOffsetMs: number;
  player: { coins: number; xp: number; level: number; gems: number };
  inventory: Record<string, number>;
  floors: FloorState[];
  pots: Record<string, PotInstance>;
  /** Owned pots not placed on any floor (bought, or swapped out). */
  potStock: string[];
  nextId: number;
  stats: { harvests: number; coinsEarned: number; bugsCaught: number; ordersDone: number; gifts: number };
  orders: { slots: OrderSlot[]; counter: number; helpDay?: number };
  journal: Record<string, JournalEntry>;
  neighbors: Record<string, BotState>;
  stall: Listing[];
  notices: Notice[];
  /** Pot collection (POT_SYSTEM 6) and how many collection rewards were claimed. */
  potBook: Record<string, PotBookEntry>;
  potBookClaimed: number;
  /** Event progress: points earned and milestones claimed. */
  events: Record<string, { points: number; claimed: number }>;
  /** Today's missions (day = local day number, -1 = not rolled yet). */
  missions: { day: number; list: MissionState[]; bonusClaimed: boolean };
  /** Bought upgrades (save 9): Rương Mây tiers. */
  upgrades: { storage: number };
  /** Daily budgets (save 9): gems given by surprise gifts on local day `day`. */
  budget: { day: number; giftGems: number };
  /** Quests (save 10): counted progress, tiers claimed, weekly/monthly draws. */
  quests: QuestState;
  /** Tutorials already shown (save 10). */
  tutorials: string[];
  /** Chợ Mây (save 11): purchases from neighbours on local day `day`. */
  market: { day: number; buys: number };
  /** Chỉ thị 11 § D (save 13): house levels and upgrades in progress. */
  buildings: Record<string, { level: number; upgradeEndsAt: number | null }>;
  /** Chỉ thị 11 § C3/D3 (save 13): sky zones already greeted, Huy Chương Độ Cao, 7-day check-in. */
  village: { seenZones: number[]; medals: number[]; checkIn: { day: number; count: number } };
  /** Chỉ thị 11 § E (save 13): the player's pets. */
  pets: PetState[];
  /** Chỉ thị 11 § E3: today's errands board. */
  errands: { day: number; rerolls: number; list: ErrandSlot[] };
  /** Chỉ thị 12 B4/B5 (save 14): stealing, helping, enemies, trial seeds. */
  social: SocialState;
  /** Chỉ thị 12 B3 (save 15): generated neighbours (counter), who moved out, last daily check. */
  town: { next: number; movedOut: string[]; day: number };
  /** Chỉ thị 12 B3 (save 15): the weekly Giải Phú Bà. */
  league: LeagueState;
  /** Chỉ thị 10 § 3.11: when Xu Xu last gave its small gift. */
  xuxu?: { giftAt: number; taps: number };
  /** Chỉ thị 12 B2: the Sạp Săn Hàng board (optional; rolled when first opened). */
  bazaar?: BazaarState;
  /** Phú Bà board (save 11): everyone's rank at the start of local day `day`, for the arrows. */
  ranks: { day: number; prev: Record<string, number> };
  /** Chỉ thị 10 (save 12): bug-catching birds. */
  birds: BirdState[];
  /** Chỉ thị 10 (save 12): Xưởng Bọ machines by id (only unlocked ones are present). */
  workshop: Record<string, MachineState>;
  /** Chỉ thị 10 (save 12): Biển Mây map. */
  seaMap: SeaMapState;
  /** Chỉ thị 10 (save 12): Năng Lượng Gió (value at `at`), and the day the free daily 10 were given. */
  energy: { value: number; at: number; dailyDay: number };
  /** Chỉ thị 10 (save 12): fishing — the day the free bait was taken. */
  fishing: {
    freeBaitDay: number;
    /** Lines cast so far (the random key for what bites). */
    casts?: number;
    /** Casts on local day `castDay` (for fishing.castsPerDay). */
    castDay?: number;
    castsToday?: number;
    /** A fish on the line, waiting for the reel mini-game. */
    hooked?: { fishId: string; bait: string } | null;
  };
  /** Chỉ thị 10 (save 12): Sổ Sâu Bọ / Sổ Cá — first catch time and count per id, rewards claimed. */
  collections: { bugs: Record<string, { firstAt: number; count: number }>; fish: Record<string, { firstAt: number; count: number }>; claimed: string[] };
}

/** Save 13 defaults for the chỉ thị 11 parts (new games and old saves alike). */
/** Chỉ thị 12 B4/B5 (save 14): stealing, helping, enemies, what neighbours took, trial seeds. */
export interface SocialState {
  steal: { tokens: number; at: number; day: number; pots: Record<string, string[]>; streak: string[]; double: boolean };
  help: { day: number; used: number };
  /** Neighbour → until when they are an enemy (they stole from the player). */
  enemies: Record<string, number>;
  /** What neighbours took while the game was closed (shown once, then cleared), and today's count. */
  taken: { day: number; count: number; log: Array<{ botId: string; itemId: string; qty: number; at: number }> };
  /** Seeds of crops above the player's level, found while stealing (one planting each). */
  trialSeeds: Record<string, number>;
}

export interface LeagueState {
  /** Week number (Monday start), −1 before the first. */
  week: number;
  /** 0 Đồng … 4 Phú Bà Huyền Thoại. */
  tier: number;
  /** The 29 neighbours of this week's group. */
  group: string[];
  /** Counters at the start of the week. */
  base: { coins: number; orders: number };
  helps: number;
  steals: number;
  last: { week: number; points: number; tier: number; rank: number; newTier: number; coins: number; gems: number; items: Record<string, number>; pot: string | null } | null;
}

export function emptyLeague(): LeagueState {
  return { week: -1, tier: 0, group: [], base: { coins: 0, orders: 0 }, helps: 0, steals: 0, last: null };
}

export function emptySocial(now: number, turns: number): SocialState {
  return { steal: { tokens: turns, at: now, day: -1, pots: {}, streak: [], double: false }, help: { day: -1, used: 0 }, enemies: {}, taken: { day: -1, count: 0, log: [] }, trialSeeds: {} };
}

export function emptyV13Parts(): Pick<GameState, 'buildings' | 'village' | 'pets' | 'errands'> {
  return { buildings: {}, village: { seenZones: [], medals: [], checkIn: { day: -1, count: 0 } }, pets: [], errands: { day: -1, rerolls: 0, list: [] } };
}

/** Save 12 defaults for the chỉ thị 10 parts (new games and old saves alike). */
export function emptyV12Parts(now: number): Pick<GameState, 'birds' | 'workshop' | 'seaMap' | 'energy' | 'fishing' | 'collections'> {
  return {
    birds: [],
    workshop: {},
    seaMap: { day: -1, index: 0, open: [], chests: [], cleared: false },
    energy: { value: 30, at: now, dailyDay: -1 },
    fishing: { freeBaitDay: -1 },
    collections: { bugs: {}, fish: {}, claimed: [] },
  };
}

/** Builds a floor with its starting pots (used for the first floor and every unlocked one). */
export function createFloorState(floorDef: FloorDef, pots: Record<string, PotInstance>, floorIndex: number): FloorState {
  const slots: SlotState[] = [];
  for (let i = 0; i < floorDef.slotCount; i++) {
    const potInstanceId = floorIndex === 0 ? `pot-${i + 1}` : `pot-f${floorIndex + 1}-${i + 1}`;
    pots[potInstanceId] = { potId: floorDef.startingPot, level: 1, source: floorIndex === 0 ? 'start' : 'floor', history: [] };
    slots.push({ potInstanceId, planting: null });
  }
  return { floorId: floorDef.id, slots, stars: 0, decor: [null, null] };
}

/** A brand-new profile built entirely from content data. */
export function createNewGame(content: ContentPack, now: number, entropy = now): GameState {
  const cfg = content.config;
  const floorDef = content.floors.get(cfg.startFloor);
  if (!floorDef) throw new Error(`Không tìm thấy tầng khởi đầu ${cfg.startFloor}`);
  const pots: Record<string, PotInstance> = {};
  const floor = createFloorState(floorDef, pots, 0);
  return {
    saveVersion: SAVE_VERSION,
    contentVersion: content.contentVersion,
    createdAt: now,
    seed: newSeed(entropy),
    maxSeenAt: now,
    clockOffsetMs: 0,
    player: { coins: cfg.startingCoins, xp: 0, level: cfg.startingLevel, gems: content.surprises.startingGems },
    inventory: {},
    floors: [floor],
    pots,
    potStock: [],
    nextId: 1,
    stats: { harvests: 0, coinsEarned: 0, bugsCaught: 0, ordersDone: 0, gifts: 0 },
    orders: { slots: Array.from({ length: content.orders.slots }, () => ({ order: null, readyAt: now })), counter: 0 },
    journal: {},
    neighbors: newNeighbors(content, now),
    stall: [],
    notices: [],
    missions: { day: -1, list: [], bonusClaimed: false },
    potBook: Object.fromEntries([...new Set(Object.values(pots).map((p) => p.potId))].map((id) => [id, { firstAt: now, bestLevel: 1 }])),
    potBookClaimed: 0,
    events: {},
    upgrades: { storage: 0 },
    budget: { day: -1, giftGems: 0 },
    quests: emptyQuestState(),
    tutorials: [],
    market: { day: -1, buys: 0 },
    ranks: { day: -1, prev: {} },
    ...emptyV12Parts(now),
    ...emptyV13Parts(),
    social: emptySocial(now, content.neighbors.steal?.turnsMax ?? 0),
    town: { next: 0, movedOut: [], day: -1 },
    league: emptyLeague(),
  };
}

export function newNeighbors(content: ContentPack, now: number): Record<string, BotState> {
  const out: Record<string, BotState> = {};
  for (const b of content.bots.values()) {
    // Generated neighbours (chỉ thị 12 B3) belong to one save: they are added by town.ts, not here.
    if (b.id.startsWith('gen:')) continue;
    out[b.id] = { level: b.startLevel, xp: 0, coins: b.startCoins, gardenValue: b.startCoins, friendship: 0, simulatedTo: now, lastAction: null, help: { day: -1, pots: [] }, stall: [], birds: [], bugs: {} };
  }
  return out;
}

/** Chỉ thị 12 B2: one slot of the Sạp Săn Hàng, bought once. */
export interface BazaarSlot {
  rarity: 'common' | 'good' | 'rare' | 'epic' | 'legendary';
  kind: 'item' | 'pot';
  id: string;
  qty: number;
  currency: 'coins' | 'gems';
  price: number;
  /** The Phú Bà (bot id) who laid it out; the coins go to them. */
  seller: string;
  sold?: boolean;
}

export interface BazaarState {
  /** Free-refresh window the board belongs to. */
  window: number;
  /** Boards laid so far (the random key). */
  roll: number;
  slots: BazaarSlot[];
  /** Paid rerolls on local day `day`. */
  day: number;
  rerolls: number;
  /** Vận May counter per pity rarity. */
  luck: Record<string, number>;
}

/** Chỉ thị 11 § E: one pet. Food runs down from `food` at `fedAt`; bond never goes down. */
export interface PetState {
  species: string;
  level: number;
  xp: number;
  stars: number;
  bond: number;
  food: number;
  fedAt: number;
  /** Walked (dắt) pets work in the garden; the others stay in the village. */
  active: boolean;
  /** Floor index the pet looks after (garden skills only work there). */
  floor: number;
  /** Away on an errand until this time (passive skills rest). */
  awayUntil: number | null;
  /** Garden skills worked out up to this time (offline-exact). */
  simulatedTo: number;
  /** Skill clocks: cooldown ends, last daily use (local day). */
  skillAt: Record<string, number>;
  /** Bond points today / this hour (caps). */
  bondDay: { day: number; feeds: number };
  patHour: { hour: number; n: number };
  /** Bond milestones already rewarded. */
  milestones: number[];
}

/** One errand of the day: open, out with a pet (back at endsAt), or done (reward collected). */
export interface ErrandSlot {
  errand: string;
  /** Random key for this slot's reward. */
  key: number;
  pet: string | null;
  endsAt: number | null;
  done: boolean;
}
