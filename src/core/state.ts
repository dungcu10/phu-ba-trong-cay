// Game state: plain data only, serializable to JSON as-is. No class instances, no functions.

import type { ContentPack, FloorDef } from './content.ts';
import { newSeed } from './rng.ts';

export const SAVE_VERSION = 6;

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
}

export interface SlotState {
  potInstanceId: string;
  planting: Planting | null;
}

export interface FloorState {
  floorId: string;
  slots: SlotState[];
}

export interface PotInstance {
  potId: string;
  level: number;
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
}

export interface OrderSlot {
  order: Order | null;
  /** When an empty slot receives its next order (the balloon's return). */
  readyAt: number;
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
}

export interface Listing {
  id: number;
  itemId: string;
  qty: number;
  /** Price per item asked by the player. */
  price: number;
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
  orders: { slots: OrderSlot[]; counter: number };
  journal: Record<string, JournalEntry>;
  neighbors: Record<string, BotState>;
  stall: Listing[];
  notices: Notice[];
}

/** Builds a floor with its starting pots (used for the first floor and every unlocked one). */
export function createFloorState(floorDef: FloorDef, pots: Record<string, PotInstance>, floorIndex: number): FloorState {
  const slots: SlotState[] = [];
  for (let i = 0; i < floorDef.slotCount; i++) {
    const potInstanceId = floorIndex === 0 ? `pot-${i + 1}` : `pot-f${floorIndex + 1}-${i + 1}`;
    pots[potInstanceId] = { potId: floorDef.startingPot, level: 1 };
    slots.push({ potInstanceId, planting: null });
  }
  return { floorId: floorDef.id, slots };
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
  };
}

export function newNeighbors(content: ContentPack, now: number): Record<string, BotState> {
  const out: Record<string, BotState> = {};
  for (const b of content.bots.values()) {
    out[b.id] = { level: b.startLevel, xp: 0, coins: b.startCoins, gardenValue: b.startCoins, friendship: 0, simulatedTo: now, lastAction: null };
  }
  return out;
}
