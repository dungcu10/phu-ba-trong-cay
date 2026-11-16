// Save file format: an envelope with format tag, saveVersion, timestamp and checksum.
// A corrupted or truncated save is detected here and never loaded.

import { hashString } from '../core/rng.ts';
import { SAVE_VERSION, type GameState } from '../core/state.ts';
import { migrate, MigrationError } from './migrations.ts';

export const SAVE_FORMAT = 'phu-ba-trong-cay/save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  savedAt: number;
  checksum: string;
  data: unknown;
}

export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

export function checksumOf(json: string): string {
  return hashString(json).toString(16).padStart(8, '0');
}

export function serialize(state: GameState, savedAt: number): string {
  const data = JSON.stringify(state);
  return `{"format":"${SAVE_FORMAT}","saveVersion":${state.saveVersion},"savedAt":${savedAt},"checksum":"${checksumOf(data)}","data":${data}}`;
}

function assertState(value: unknown): asserts value is GameState {
  const s = value as GameState;
  const ok =
    typeof s === 'object' && s !== null &&
    typeof s.seed === 'number' && typeof s.maxSeenAt === 'number' &&
    typeof s.player?.coins === 'number' && typeof s.player?.level === 'number' && typeof s.player?.xp === 'number' &&
    typeof s.inventory === 'object' && Array.isArray(s.floors) && typeof s.pots === 'object';
  if (!ok) throw new SaveFormatError('Cấu trúc save không hợp lệ');
}

/** Parses, verifies checksum, migrates to the current version and validates the result. */
export function deserialize(text: string): { state: GameState; savedAt: number; migratedFrom: number | null } {
  let envelope: SaveEnvelope;
  try {
    envelope = JSON.parse(text) as SaveEnvelope;
  } catch {
    throw new SaveFormatError('Save không phải JSON hợp lệ (có thể bị cắt ngang)');
  }
  if (envelope?.format !== SAVE_FORMAT) throw new SaveFormatError('Không phải file save của Phú Bà Trồng Cây');
  if (typeof envelope.saveVersion !== 'number') throw new SaveFormatError('Thiếu saveVersion');
  if (envelope.saveVersion > SAVE_VERSION) throw new SaveFormatError(`Save từ phiên bản mới hơn (${envelope.saveVersion})`);
  const dataJson = JSON.stringify(envelope.data);
  if (checksumOf(dataJson) !== envelope.checksum) throw new SaveFormatError('Sai checksum: save bị hỏng');
  let data: unknown;
  try {
    data = migrate(envelope.data, envelope.saveVersion);
  } catch (e) {
    if (e instanceof MigrationError) throw new SaveFormatError(e.message);
    throw e;
  }
  assertState(data);
  return {
    state: data,
    savedAt: envelope.savedAt,
    migratedFrom: envelope.saveVersion === SAVE_VERSION ? null : envelope.saveVersion,
  };
}
