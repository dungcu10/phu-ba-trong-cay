// A running game: content + state + clock + saving. The only place the browser app changes the
// game is GameSession.run(), which goes through the core command processor.

import type { Clock } from '../core/clock.ts';
import type { ContentPack } from '../core/content.ts';
import { currentGameTime, dispatch, type Command, type GameEvent, type Result } from '../core/game.ts';
import type { GameState } from '../core/state.ts';
import type { SaveManager } from '../persistence/saveManager.ts';

export interface SessionTiming {
  /** Wait after the last change before saving, so a burst of taps is one write. */
  saveDebounceMs: number;
  /** Safety net: save at least this often while playing. */
  periodicSaveMs: number;
}

export const DEFAULT_TIMING: SessionTiming = { saveDebounceMs: 1500, periodicSaveMs: 30_000 };

type Listener = (events: GameEvent[]) => void;

export class GameSession {
  private listeners: Listener[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();
  /** Set once the stored save is being replaced (import/reset); no more writes from this session. */
  private locked = false;
  /** Last save error, shown to the player; cleared by the next successful save. */
  saveError: string | null = null;

  constructor(
    readonly content: ContentPack,
    readonly state: GameState,
    readonly clock: Clock,
    private readonly saves: SaveManager,
    private readonly timing: SessionTiming = DEFAULT_TIMING,
  ) {}

  /** Game time (device clock + stored offset, never behind the latest time seen). */
  now(): number {
    return currentGameTime(this.state, this.clock.now());
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener);
  }

  run(cmd: Command): Result {
    if (cmd.type !== 'tick') this.run({ type: 'tick' });
    const result = dispatch(this.content, this.state, cmd, this.clock.now());
    if (result.ok && (cmd.type !== 'tick' || result.events.length > 0)) {
      this.markDirty();
      for (const l of this.listeners) l(result.events);
    }
    return result;
  }

  /** Notifies views without a command (time passed, dev fast-forward). */
  refresh(): void {
    for (const l of this.listeners) l([]);
  }

  markDirty(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveNow(), this.timing.saveDebounceMs);
  }

  /** Saves now if anything changed. Writes are serialized so two saves never overlap. */
  saveNow(force = false): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.locked || (!this.dirty && !force)) return this.saving;
    this.dirty = false;
    this.saving = this.saving.then(async () => {
      try {
        await this.saves.save(this.state, this.now());
        this.saveError = null;
      } catch (e) {
        this.dirty = true;
        this.saveError = e instanceof Error ? e.message : String(e);
      }
    });
    return this.saving;
  }

  get periodicSaveMs(): number {
    return this.timing.periodicSaveMs;
  }

  /** Validates a backup file. Throws SaveFormatError when it is not a valid save. */
  parseBackup(text: string): { state: GameState; warnings: string[] } {
    return this.saves.parseImport(text);
  }

  /** Stops all further writes from this session (before a reset or an import + reload). */
  async stopSaving(): Promise<void> {
    this.locked = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.saving;
  }

  async replaceStoredSave(next: GameState): Promise<void> {
    this.locked = true;
    await this.saving;
    await this.saves.save(next, this.now());
  }

  exportText(): string {
    return this.saves.exportText(this.state, this.now());
  }
}
