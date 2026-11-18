// Chỉ thị 10 § 3.7: Biển Mây Bí Ẩn — a grid of cloud clumps. Each tap costs 1 Năng Lượng Gió and
// Xu Xu blows one clump away, showing what lies under it: nothing, minerals, Sợi Mây, Giọt Sương, a rare
// bug, or part of a 2×2 chest that opens once all four of its cells are clear. Clearing the whole map
// pays a big reward and lays a new one. Energy refills one point per few minutes even while the game is
// closed (worked out from timestamps, offline-exact), plus a daily gift. A map is built from the save's
// seed + the local day it was laid + its number, so it is the same every time it is looked at.

import type { ContentPack, SeaDrop, SeaRules } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';
import { addItem } from './economy.ts';
import { obtainPot } from './potStars.ts';
import { houseBonus } from './village.ts';

export type SeaError = 'locked' | 'bad_cell' | 'already_open' | 'no_energy';

export interface SeaCell {
  kind: 'empty' | 'item' | 'chest';
  itemId?: string;
  qty?: number;
  /** For chest cells: the chest's top-left cell. */
  chest?: number;
}

export interface SeaFind {
  itemId: string;
  qty: number;
}

const MIN = 60_000;

export function seaRules(content: ContentPack): SeaRules | null {
  return content.sea ?? null;
}

/** Năng Lượng Gió cap: sea.json plus the Cổng Biển Mây house (chỉ thị 11 § D2). */
export function energyMax(content: ContentPack, state: GameState): number {
  return (content.sea?.energy.max ?? 0) + houseBonus(content, state, 'gate', 'energyMax');
}

export function seaOpen(content: ContentPack, state: GameState): boolean {
  const r = seaRules(content);
  return !!r && state.player.level >= r.unlockLevel;
}

/** Brings Năng Lượng Gió up to date: refills since the last mark, and the daily gift once a day. */
export function settleEnergy(content: ContentPack, state: GameState, now: number): void {
  const r = seaRules(content);
  if (!r) return;
  const e = state.energy;
  const step = r.energy.regenMinutes * MIN;
  if (e.value >= energyMax(content, state)) e.at = Math.max(e.at, now);
  else if (now > e.at) {
    const n = Math.floor((now - e.at) / step);
    if (n > 0) {
      e.value = Math.min(energyMax(content, state), e.value + n);
      e.at = e.value >= energyMax(content, state) ? now : e.at + n * step;
    }
  }
  const day = localDay(content, now);
  if (seaOpen(content, state) && e.dailyDay !== day) {
    e.value = Math.min(r.energy.cap, e.value + r.energy.daily);
    e.dailyDay = day;
  }
}

/** When the next energy point comes (null when full). */
export function nextEnergyAt(content: ContentPack, state: GameState): number | null {
  const r = seaRules(content)!;
  return state.energy.value >= energyMax(content, state) ? null : state.energy.at + r.energy.regenMinutes * MIN;
}

function pick<T extends { weight: number }>(list: T[], roll: number): T {
  const total = list.reduce((a, x) => a + x.weight, 0);
  let x = roll * total;
  for (const d of list) {
    if (x < d.weight) return d;
    x -= d.weight;
  }
  return list[list.length - 1]!;
}

/** One drop rolled from a table (null for an empty cell or a bug rarity with no bugs). */
function rollDrop(content: ContentPack, d: SeaDrop, r: (k: string) => number): SeaFind | null {
  const qty = d.qty ? d.qty[0] + Math.floor(r('qty') * (d.qty[1] - d.qty[0] + 1)) : 1;
  if (d.kind === 'item') return { itemId: d.id!, qty };
  if (d.kind === 'bug') {
    const bugs = content.bugList.filter((b) => b.rarity === d.rarity).sort((a, b) => a.id.localeCompare(b.id));
    return bugs.length ? { itemId: bugs[Math.floor(r('bug') * bugs.length)]!.id, qty } : null;
  }
  return null;
}

/** Makes sure there is a map (the first one is laid on first look). */
export function ensureSeaMap(content: ContentPack, state: GameState, now: number): void {
  if (state.seaMap.day < 0) state.seaMap = { day: localDay(content, now), index: 0, open: [], chests: [], cleared: false };
}

/** The current map, cell by cell (row-major). */
export function seaCells(content: ContentPack, state: GameState): SeaCell[] {
  const r = seaRules(content)!;
  const sm = state.seaMap;
  const roll = (...k: Array<string | number>) => randomFor(state.seed, 'sea', sm.day, sm.index, ...k);
  const n = r.cols * r.rows;
  const cells: SeaCell[] = Array.from({ length: n }, () => ({ kind: 'empty' }));
  const chests = r.chests[0] + Math.floor(roll('chests') * (r.chests[1] - r.chests[0] + 1));
  for (let c = 0, tries = 0; c < chests && tries < 60; tries++) {
    const col = Math.floor(roll('cc', tries) * (r.cols - 1));
    const row = Math.floor(roll('cr', tries) * (r.rows - 1));
    const at = row * r.cols + col;
    const block = [at, at + 1, at + r.cols, at + r.cols + 1];
    if (block.some((i) => cells[i]!.kind === 'chest')) continue;
    for (const i of block) cells[i] = { kind: 'chest', chest: at };
    c++;
  }
  for (let i = 0; i < n; i++) {
    if (cells[i]!.kind === 'chest') continue;
    const find = rollDrop(content, pick(r.cells, roll(i, 'drop')), (k) => roll(i, k));
    if (find) cells[i] = { kind: 'item', itemId: find.itemId, qty: find.qty };
  }
  return cells;
}

/** The four cells of the chest whose top-left cell is `at`. */
export function chestBlock(content: ContentPack, at: number): number[] {
  const cols = seaRules(content)!.cols;
  return [at, at + 1, at + cols, at + cols + 1];
}

function give(content: ContentPack, state: GameState, f: SeaFind, now: number): void {
  addItem(state, f.itemId, f.qty);
  if (content.items.get(f.itemId)?.kind === 'bug') {
    const book = state.collections.bugs;
    book[f.itemId] = { firstAt: book[f.itemId]?.firstAt ?? now, count: (book[f.itemId]?.count ?? 0) + f.qty };
  }
}

export interface BlowResult {
  cell: number;
  finds: SeaFind[];
  /** A chest opened by this tap (its top-left cell). */
  chest?: number;
  potInstanceId?: string;
  /** The map was cleared by this tap: the clear reward is in `finds` too; a new map is laid. */
  cleared?: { gems: number };
}

/** Xu Xu blows one cloud clump away. */
export function blowCloud(content: ContentPack, state: GameState, cell: number, now: number): SeaError | BlowResult {
  const r = seaRules(content);
  if (!r || !seaOpen(content, state)) return 'locked';
  const n = r.cols * r.rows;
  if (!Number.isInteger(cell) || cell < 0 || cell >= n) return 'bad_cell';
  ensureSeaMap(content, state, now);
  settleEnergy(content, state, now);
  const sm = state.seaMap;
  if (sm.open.includes(cell)) return 'already_open';
  if (state.energy.value < 1) return 'no_energy';
  const wasFull = state.energy.value >= energyMax(content, state);
  state.energy.value -= 1;
  if (wasFull) state.energy.at = now;
  sm.open.push(cell);
  const cells = seaCells(content, state);
  const here = cells[cell]!;
  const out: BlowResult = { cell, finds: [] };
  if (here.kind === 'item') {
    const f = { itemId: here.itemId!, qty: here.qty! };
    give(content, state, f, now);
    out.finds.push(f);
  } else if (here.kind === 'chest' && !sm.chests.includes(here.chest!) && chestBlock(content, here.chest!).every((i) => sm.open.includes(i))) {
    sm.chests.push(here.chest!);
    out.chest = here.chest!;
    const roll = (...k: Array<string | number>) => randomFor(state.seed, 'seaChest', sm.day, sm.index, here.chest!, ...k);
    for (let k = 0; k < r.chest.rolls; k++) {
      const f = rollDrop(content, pick(r.chest.table, roll(k, 'drop')), (x) => roll(k, x));
      if (f) (give(content, state, f, now), out.finds.push(f));
    }
    if (roll('pot') < r.chest.potChance) {
      const pots = content.potList.filter((p) => p.group === 'crafted' && r.chest.potRarities.includes(p.rarity) && p.unlockLevel <= state.player.level);
      if (pots.length) {
        const got = obtainPot(content, state, pots[Math.floor(roll('potId') * pots.length)]!.id, 'sea', now);
        if ('potInstanceId' in got) out.potInstanceId = got.potInstanceId;
        else out.finds.push(got.shards);
      }
    }
  }
  if (sm.open.length >= n) {
    for (const [itemId, qty] of Object.entries(r.clear.items)) {
      give(content, state, { itemId, qty }, now);
      out.finds.push({ itemId, qty });
    }
    state.player.gems += r.clear.gems;
    out.cleared = { gems: r.clear.gems };
    state.seaMap = { day: localDay(content, now), index: sm.index + 1, open: [], chests: [], cleared: false };
  }
  return out;
}
