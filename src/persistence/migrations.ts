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

/** Key = version the migration starts from. Version 1 is the first released format: none yet. */
export const MIGRATIONS: Record<number, Migration> = {};

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
