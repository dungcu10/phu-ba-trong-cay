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
