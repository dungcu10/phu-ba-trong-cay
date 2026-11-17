// Save migrations. Each entry upgrades data from version N to N+1. When the save format
// changes: bump SAVE_VERSION in core/state.ts, add one function here, add a fixture test.

import { SAVE_VERSION } from '../core/state.ts';

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

type RawPlanting = Record<string, unknown> | null;
type RawFloor = { slots?: Array<{ planting?: RawPlanting }> };

/** Key = version the migration starts from. */
export const MIGRATIONS: Record<number, Migration> = {
  // 1 -> 2 (R2): bugs are counted per bug id and stay until harvest. The old per-stage record
  // cannot be mapped to the new bug positions, so the current cycle's catches restart from zero.
  1: (data) => {
    for (const floor of (data.floors as RawFloor[] | undefined) ?? []) {
      for (const slot of floor.slots ?? []) {
        const p = slot.planting;
        if (!p) continue;
        delete p.caughtBugStages;
        p.caughtBugs = {};
      }
    }
    return data;
  },
  // 2 -> 3 (R4): game time = device clock + clockOffsetMs. Old saves start with no offset; the
  // first command after loading sets it from maxSeenAt if the device clock is behind.
  2: (data) => {
    data.clockOffsetMs = 0;
    return data;
  },
  // 3 -> 4 (R5): plantings record seedCost. Migrations do not see the content pack, so the
  // value is filled in by reconcile() right after loading (current seed price of that crop).
  3: (data) => data,
  // 4 -> 5 (multi-floor + pot shop): owned pots not on a floor.
  4: (data) => {
    data.potStock = [];
    return data;
  },
  // 5 -> 6 (orders, surprises, neighbours): new parts start empty; reconcile() fills the order
  // board and the neighbours from the content pack, and the starting Ngọc Mây.
  5: (data) => {
    const player = data.player as Record<string, unknown>;
    player.gems = 0;
    const stats = data.stats as Record<string, unknown>;
    stats.ordersDone = 0;
    stats.gifts = 0;
    data.orders = { slots: [], counter: 0 };
    data.journal = {};
    data.neighbors = {};
    data.stall = [];
    data.notices = [];
    return data;
  },
  // 6 -> 7 (REDESIGN_V2): floor stars, daily missions, help given in neighbours' gardens.
  // Floors keep every slot they have (10 = fully expanded).
  6: (data) => {
    for (const floor of (data.floors as Array<Record<string, unknown>> | undefined) ?? []) floor.stars = 0;
    for (const bot of Object.values((data.neighbors as Record<string, Record<string, unknown>> | undefined) ?? {})) bot.help = { day: -1, pots: [] };
    data.missions = { day: -1, list: [], bonusClaimed: false };
    return data;
  },
  // 7 -> 8 (POT_SYSTEM): pot ownership records, collection book, event progress. Levels kept.
  7: (data) => {
    const at = typeof data.createdAt === 'number' ? data.createdAt : 0;
    const book: Record<string, { firstAt: number; bestLevel: number }> = {};
    for (const p of Object.values((data.pots as Record<string, Record<string, unknown>> | undefined) ?? {})) {
      p.obtainedAt = at;
      p.source = 'old-save';
      p.history = [];
      const id = String(p.potId);
      book[id] = { firstAt: at, bestLevel: Math.max(book[id]?.bestLevel ?? 1, Number(p.level) || 1) };
    }
    data.potBook = book;
    data.potBookClaimed = 0;
    data.events = {};
    return data;
  },
  // 8 -> 9 (nâng cấp v3, đợt 1): Rương Mây upgrades start at tier 0. Levels above 30 and
  // generated floors need no data change.
  8: (data) => {
    data.upgrades = { storage: 0 };
    data.budget = { day: -1, giftGems: 0 };
    return data;
  },
  // 9 -> 10 (nâng cấp v3 đợt 2): quests and tutorials. Left empty here; reconcile, which has the
  // content, fills them and lets players past the newbie chain skip it (adoptQuestsForOldSave).
  9: (data) => {
    delete data.quests;
    delete data.tutorials;
    return data;
  },
  // 10 -> 11 (chỉ thị 07): Chợ Mây. Every neighbour starts with an empty stall; new neighbours
  // (40 instead of 8) are added by reconcile, which has the content. Friendship and history kept.
  10: (data) => {
    for (const bot of Object.values((data.neighbors as Record<string, Record<string, unknown>> | undefined) ?? {})) bot.stall = [];
    data.market = { day: -1, buys: 0 };
    data.ranks = { day: -1, prev: {} };
    return data;
  },
  // 11 -> 12 (chỉ thị 10): birds, Xưởng Bọ, Biển Mây, Năng Lượng Gió, fishing, collections, floor
  // decor. All start empty / full energy; ids, coins, pots and the Bọ Rùa in the inventory are kept.
  // The bugs already caught are counted into the Sổ Sâu Bọ by reconcile (it has the content).
  11: (data) => {
    const at = typeof data.maxSeenAt === 'number' ? data.maxSeenAt : typeof data.createdAt === 'number' ? data.createdAt : 0;
    for (const floor of (data.floors as Array<Record<string, unknown>> | undefined) ?? []) floor.decor = [null, null];
    data.birds = [];
    data.workshop = {};
    data.seaMap = { day: -1, index: 0, open: [], chests: [], cleared: false };
    data.energy = { value: 30, at, dailyDay: -1 };
    data.fishing = { freeBaitDay: -1 };
    data.collections = { bugs: {}, fish: {}, claimed: [] };
    return data;
  },
};

export function migrate(
  data: unknown,
  fromVersion: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  toVersion: number = SAVE_VERSION,
): unknown {
  let current = data as Record<string, unknown>;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) throw new MigrationError(`Thiếu migration từ phiên bản ${v} lên ${v + 1}`);
    current = step(structuredClone(current));
    current.saveVersion = v + 1;
  }
  return current;
}
