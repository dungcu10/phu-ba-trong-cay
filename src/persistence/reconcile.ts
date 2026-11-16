// Checks a loaded save against the current content pack (CTO review 01, R5).
//
// - Content that no longer exists (crop, pot type, floor, item, bug) is cleaned up: the pot is
//   emptied and the seed refunded, unknown items are removed, and a warning is recorded.
// - Impossible numbers (negative, NaN, non-integer counts, pot or player level out of range):
//   a backup file being imported is REJECTED; the save already on the device is REPAIRED to the
//   nearest valid value (refusing it would lock the player out of their own game).
// The result is always a state the simulation can run without throwing.

import type { ContentPack } from '../core/content.ts';
import type { GameState, Planting, SlotState } from '../core/state.ts';
import { SaveFormatError } from './serializer.ts';

export type ReconcileMode = 'import' | 'local';

export interface Reconciled {
  state: GameState;
  /** Player-readable notes about what was repaired or removed. */
  warnings: string[];
}

class Checker {
  readonly problems: string[] = [];
  readonly warnings: string[] = [];
  constructor(private readonly mode: ReconcileMode) {}

  /** Returns a valid number for `value`, repairing (local) or recording a problem (import). */
  num(where: string, value: unknown, opts: { min?: number; max?: number; int?: boolean; fallback: number }): number {
    const n = typeof value === 'number' ? value : NaN;
    let fixed = Number.isFinite(n) ? n : opts.fallback;
    if (opts.int && Number.isFinite(fixed)) fixed = Math.floor(fixed);
    if (opts.min !== undefined && fixed < opts.min) fixed = opts.min;
    if (opts.max !== undefined && fixed > opts.max) fixed = opts.max;
    if (fixed !== n) {
      if (this.mode === 'import') this.problems.push(`${where} không hợp lệ (${String(value)})`);
      else this.warnings.push(`Đã sửa ${where}: ${String(value)} → ${fixed}`);
    }
    return fixed;
  }
}

export function reconcile(input: GameState, content: ContentPack, mode: ReconcileMode): Reconciled {
  const state = structuredClone(input);
  const c = new Checker(mode);
  const maxLevel = content.config.levels.maxLevel;

  state.seed = c.num('hạt giống', state.seed, { min: 0, int: true, fallback: 1 });
  state.player.level = c.num('cấp người chơi', state.player.level, { min: 1, max: maxLevel, int: true, fallback: 1 });
  state.player.coins = c.num('số xu', state.player.coins, { min: 0, int: true, fallback: 0 });
  state.player.xp = c.num('kinh nghiệm', state.player.xp, { min: 0, int: true, fallback: 0 });
  state.maxSeenAt = c.num('mốc thời gian', state.maxSeenAt, { min: 0, fallback: state.createdAt || 0 });
  state.clockOffsetMs = c.num('độ lệch đồng hồ', state.clockOffsetMs, { fallback: 0 });
  state.nextId = c.num('bộ đếm id', state.nextId, { min: 1, int: true, fallback: 1 });
  for (const key of ['harvests', 'coinsEarned', 'bugsCaught'] as const) {
    state.stats[key] = c.num(`thống kê ${key}`, state.stats?.[key], { min: 0, int: true, fallback: 0 });
  }

  reconcileInventory(state, content, c);
  reconcilePots(state, content, c);
  reconcileFloors(state, content, c);
  reconcileStock(state);

  // nextId must stay above every planting id so new plantings never reuse random keys.
  for (const f of state.floors) for (const s of f.slots) if (s.planting) state.nextId = Math.max(state.nextId, s.planting.id + 1);

  if (c.problems.length > 0) throw new SaveFormatError(`Bản sao lưu có số liệu không hợp lệ: ${c.problems.join('; ')}`);
  return { state, warnings: c.warnings };
}

function reconcileInventory(state: GameState, content: ContentPack, c: Checker): void {
  for (const [id, qty] of Object.entries(state.inventory)) {
    if (!content.items.has(id)) {
      delete state.inventory[id];
      c.warnings.push(`Đã bỏ vật phẩm không còn trong game: ${id} ×${String(qty)}`);
      continue;
    }
    const fixed = c.num(`số lượng ${content.items.get(id)!.name.vi}`, qty, { min: 0, int: true, fallback: 0 });
    if (fixed === 0) delete state.inventory[id];
    else state.inventory[id] = fixed;
  }
}

function reconcilePots(state: GameState, content: ContentPack, c: Checker): void {
  const fallbackPot = content.floors.get(content.config.startFloor)!.startingPot;
  for (const [id, pot] of Object.entries(state.pots)) {
    const def = content.pots.get(pot.potId);
    if (!def) {
      c.warnings.push(`Loại chậu ${pot.potId} không còn trong game, đã thay bằng chậu mặc định`);
      state.pots[id] = { potId: fallbackPot, level: 1 };
      continue;
    }
    pot.level = c.num(`cấp ${def.name.vi} (${id})`, pot.level, { min: 1, max: def.levels.length, int: true, fallback: 1 });
  }
}

function reconcileFloors(state: GameState, content: ContentPack, c: Checker): void {
  state.floors = state.floors.filter((floor, i) => {
    if (content.floors.has(floor.floorId)) return true;
    if (i === 0) {
      c.warnings.push(`Tầng ${floor.floorId} không còn trong game, đã đổi thành tầng khởi đầu`);
      floor.floorId = content.config.startFloor;
      return true;
    }
    c.warnings.push(`Tầng ${floor.floorId} không còn trong game, đã bỏ`);
    return false;
  });
  for (const [fi, floor] of state.floors.entries()) {
    const def = content.floors.get(floor.floorId)!;
    // A floor that gained slots in a content update gets the new positions with starting pots.
    for (let i = floor.slots.length; i < def.slotCount; i++) {
      const id = fi === 0 ? `pot-${i + 1}` : `pot-f${fi + 1}-${i + 1}`;
      const potInstanceId = state.pots[id] ? `${id}-n` : id;
      state.pots[potInstanceId] = { potId: def.startingPot, level: 1 };
      floor.slots.push({ potInstanceId, planting: null });
      if (i === def.slotCount - 1) c.warnings.push(`${def.name.vi} có thêm vị trí chậu mới`);
    }
    floor.slots.forEach((slot, i) => {
      if (!state.pots[slot.potInstanceId]) {
        c.warnings.push(`Chậu ${slot.potInstanceId} bị thiếu, đã đặt chậu mới`);
        state.pots[slot.potInstanceId] = { potId: def.startingPot, level: 1 };
      }
      reconcilePlanting(state, content, slot, `chậu ${i + 1}`, c);
    });
  }
}

/** Pot stock holds only existing pots that are not placed on a slot, each once. */
function reconcileStock(state: GameState): void {
  const placed = new Set(state.floors.flatMap((f) => f.slots.map((s) => s.potInstanceId)));
  const stock = Array.isArray(state.potStock) ? state.potStock : [];
  state.potStock = [...new Set(stock)].filter((id) => typeof id === 'string' && state.pots[id] && !placed.has(id));
}

function clearAndRefund(state: GameState, slot: SlotState, refund: number, note: string, c: Checker): void {
  slot.planting = null;
  state.player.coins += refund;
  c.warnings.push(`${note}; đã dọn chậu${refund > 0 ? ` và hoàn ${refund} xu tiền hạt` : ''}`);
}

function reconcilePlanting(state: GameState, content: ContentPack, slot: SlotState, where: string, c: Checker): void {
  const p = slot.planting as (Planting & { seedCost?: unknown }) | null;
  if (!p) return;
  if (typeof p.cropId !== 'string') {
    clearAndRefund(state, slot, 0, `Cây ở ${where} không đọc được`, c);
    return;
  }
  const crop = content.crops.get(p.cropId);
  const paid = typeof p.seedCost === 'number' && Number.isFinite(p.seedCost) && p.seedCost >= 0 ? p.seedCost : null;
  if (!crop) {
    clearAndRefund(state, slot, paid ?? 0, `Cây ${p.cropId} ở ${where} không còn trong game`, c);
    return;
  }
  p.seedCost = paid ?? crop.seedPrice;
  p.id = c.num(`mã cây ở ${where}`, p.id, { min: 0, int: true, fallback: state.nextId });
  p.cycleStartedAt = c.num(`thời điểm gieo ở ${where}`, p.cycleStartedAt, { min: 0, fallback: state.maxSeenAt });
  p.harvestsDone = c.num(`số lần đã thu ở ${where}`, p.harvestsDone, { min: 0, max: crop.harvests - 1, int: true, fallback: 0 });
  p.bonusMs = c.num(`thời gian tưới ở ${where}`, p.bonusMs, { min: 0, fallback: 0 });
  const stages = Array.isArray(p.wateredStages) ? p.wateredStages : [];
  p.wateredStages = stages.filter((s) => Number.isInteger(s) && s >= 0 && s < crop.stages);
  const caught: Record<string, number> = {};
  for (const [bugId, n] of Object.entries(p.caughtBugs ?? {})) {
    if (!content.bugs.has(bugId)) continue;
    caught[bugId] = c.num(`số bọ đã bắt ở ${where}`, n, { min: 0, int: true, fallback: 0 });
  }
  p.caughtBugs = caught;
}
