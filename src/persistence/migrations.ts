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
