// Game state: plain data only, serializable to JSON as-is. No class instances, no functions.

import type { ContentPack } from './content.ts';
import { newSeed } from './rng.ts';

export const SAVE_VERSION = 3;

export interface Planting {
  /** Unique per planting, used as a key for deterministic randomness. */
  id: number;
  cropId: string;
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

export interface GameState {
  saveVersion: number;
  contentVersion: number;
  createdAt: number;
  seed: number;
  /** Latest game time ever seen; game time never goes below it. */
  maxSeenAt: number;
  /** Added to the device clock to get game time; grows when the device clock is found behind. */
  clockOffsetMs: number;
  player: { coins: number; xp: number; level: number };
  inventory: Record<string, number>;
  floors: FloorState[];
  pots: Record<string, PotInstance>;
  nextId: number;
  stats: { harvests: number; coinsEarned: number; bugsCaught: number };
}

/** A brand-new profile built entirely from content data. */
export function createNewGame(content: ContentPack, now: number, entropy = now): GameState {
  const cfg = content.config;
  const floorDef = content.floors.get(cfg.startFloor);
  if (!floorDef) throw new Error(`Không tìm thấy tầng khởi đầu ${cfg.startFloor}`);
  const pots: Record<string, PotInstance> = {};
  const slots: SlotState[] = [];
  for (let i = 0; i < floorDef.slotCount; i++) {
    const potInstanceId = `pot-${i + 1}`;
    pots[potInstanceId] = { potId: floorDef.startingPot, level: 1 };
    slots.push({ potInstanceId, planting: null });
  }
  return {
    saveVersion: SAVE_VERSION,
    contentVersion: content.contentVersion,
    createdAt: now,
    seed: newSeed(entropy),
    maxSeenAt: now,
    clockOffsetMs: 0,
    player: { coins: cfg.startingCoins, xp: 0, level: cfg.startingLevel },
    inventory: {},
    floors: [{ floorId: floorDef.id, slots }],
    pots,
    nextId: 1,
    stats: { harvests: 0, coinsEarned: 0, bugsCaught: 0 },
  };
}
