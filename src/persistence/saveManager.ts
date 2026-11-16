// Two rotating save slots. Each save goes to the slot NOT holding the newest valid save, so a
// write interrupted half-way can only damage the older copy. Loading picks the newest valid slot.
// A read error never results in the player's save being overwritten with a new game.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { reconcile } from './reconcile.ts';
import type { SaveStore } from './store.ts';
import { deserialize, serialize, SaveFormatError } from './serializer.ts';

export const SLOT_KEYS = ['slot-a', 'slot-b'] as const;
/** Key of the untouched copy of a save made by an older version, kept before upgrading it. */
export const upgradeBackupKey = (version: number) => `pre-upgrade-v${version}`;
const BACKUP_INDEX = 'pre-upgrade-index';

export interface UpgradeBackup {
  key: string;
  fromVersion: number;
  /** Real time the copy was made. */
  copiedAt: number;
  /** When the copied save was written by the old version (game time). */
  savedAt: number;
}
type SlotKey = (typeof SLOT_KEYS)[number];

export type LoadResult =
  | { kind: 'empty' }
  | {
      kind: 'loaded';
      state: GameState;
      slot: SlotKey;
      savedAt: number;
      recoveredFromBackup: boolean;
      migratedFrom: number | null;
      /** What reconcile() repaired or removed to match the current content. */
      warnings: string[];
    }
  | { kind: 'unreadable'; errors: string[] };

interface SlotRead {
  slot: SlotKey;
  raw: string | null;
  parsed: (ReturnType<typeof deserialize> & { warnings: string[] }) | null;
  error: string | null;
}

export class SaveManager {
  private lastSlot: SlotKey | null = null;
  private lastSavedAt = 0;

  constructor(
    private readonly store: SaveStore,
    private readonly content: ContentPack,
  ) {}

  private async readSlot(slot: SlotKey): Promise<SlotRead> {
    const raw = await this.store.get(slot);
    if (raw === null) return { slot, raw, parsed: null, error: null };
    try {
      const parsed = deserialize(raw);
      const fixed = reconcile(parsed.state, this.content, 'local');
      return { slot, raw, parsed: { ...parsed, state: fixed.state, warnings: fixed.warnings }, error: null };
    } catch (e) {
      const msg = e instanceof SaveFormatError ? e.message : String(e);
      return { slot, raw, parsed: null, error: `${slot}: ${msg}` };
    }
  }

  async load(): Promise<LoadResult> {
    const reads = await Promise.all(SLOT_KEYS.map((s) => this.readSlot(s)));
    const valid = reads.filter((r) => r.parsed).sort((a, b) => b.parsed!.savedAt - a.parsed!.savedAt);
    const newestRaw = reads.filter((r) => r.raw !== null);
    if (valid.length === 0) {
      if (newestRaw.length === 0) return { kind: 'empty' };
      return { kind: 'unreadable', errors: reads.map((r) => r.error).filter((e): e is string => e !== null) };
    }
    const best = valid[0]!;
    // REVIEW 02 #1: an older version's save is copied, word for word, before this version upgrades
    // it and before anything is written. The first copy per version is kept and never overwritten.
    if (best.parsed!.migratedFrom !== null) await this.keepUpgradeBackup(best.raw!, best.parsed!.migratedFrom, best.parsed!.savedAt);
    // "Recovered" when another slot exists but is broken (the newer write failed).
    const recoveredFromBackup = reads.some((r) => r.error !== null);
    this.lastSlot = best.slot;
    this.lastSavedAt = best.parsed!.savedAt;
    return {
      kind: 'loaded',
      state: best.parsed!.state,
      slot: best.slot,
      savedAt: best.parsed!.savedAt,
      recoveredFromBackup,
      migratedFrom: best.parsed!.migratedFrom,
      warnings: best.parsed!.warnings,
    };
  }

  private async keepUpgradeBackup(raw: string, fromVersion: number, savedAt: number): Promise<void> {
    const key = upgradeBackupKey(fromVersion);
    if ((await this.store.get(key)) !== null) return;
    await this.store.put(key, raw);
    const list = await this.upgradeBackups();
    list.push({ key, fromVersion, copiedAt: Date.now(), savedAt });
    await this.store.put(BACKUP_INDEX, JSON.stringify(list));
  }

  /** Copies made before upgrades, oldest first. */
  async upgradeBackups(): Promise<UpgradeBackup[]> {
    try {
      const v = JSON.parse((await this.store.get(BACKUP_INDEX)) ?? '[]') as UpgradeBackup[];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  /** The raw text of a copy (for download, or to restore through the normal import path). */
  async upgradeBackupText(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  /** Writes to the other slot. savedAt never decreases, even if the device clock moved back. */
  async save(state: GameState, now: number): Promise<SlotKey> {
    const target: SlotKey = this.lastSlot === 'slot-a' ? 'slot-b' : 'slot-a';
    const savedAt = Math.max(now, this.lastSavedAt + 1);
    await this.store.put(target, serialize(state, savedAt));
    this.lastSlot = target;
    this.lastSavedAt = savedAt;
    return target;
  }

  /** Text for a manual backup file. */
  exportText(state: GameState, now: number): string {
    return serialize(state, now);
  }

  /**
   * Validates a backup file against the format and the current content, without touching
   * stored saves. Throws SaveFormatError if invalid (impossible numbers are rejected here).
   */
  parseImport(text: string): { state: GameState; warnings: string[] } {
    return reconcile(deserialize(text).state, this.content, 'import');
  }
}
