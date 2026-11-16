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

/** Structure only. Numbers are checked against the content pack by reconcile() (R5). */
function assertState(value: unknown): asserts value is GameState {
  const s = value as GameState;
  const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
  const ok =
    isObj(s) && isObj(s.player) && isObj(s.inventory) && isObj(s.pots) && isObj(s.stats) &&
    Array.isArray(s.floors) &&
    s.floors.every((f) => isObj(f) && typeof f.floorId === 'string' && Array.isArray(f.slots) &&
      f.slots.every((sl) => isObj(sl) && typeof sl.potInstanceId === 'string' && (sl.planting === null || isObj(sl.planting)))) &&
    Object.values(s.pots).every((p) => isObj(p) && typeof p.potId === 'string');
  if (!ok) throw new SaveFormatError('Cấu trúc save không hợp lệ');
}

/** Parses, verifies checksum, migrates and checks structure. Numbers and content references are
 * checked by reconcile(), which SaveManager runs on every load and import. */
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
