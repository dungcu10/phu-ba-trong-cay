// Checks a loaded save against the current content pack (CTO review 01, R5).
//
// - Content that no longer exists (crop, pot type, floor, item, bug) is cleaned up: the pot is
//   emptied and the seed refunded, unknown items are removed, and a warning is recorded.
// - Impossible numbers (negative, NaN, non-integer counts, pot or player level out of range):
//   a backup file being imported is REJECTED; the save already on the device is REPAIRED to the
//   nearest valid value (refusing it would lock the player out of their own game).
// The result is always a state the simulation can run without throwing.

import { adoptQuestsForOldSave, emptyQuestState } from '../systems/quests.ts';
import type { ContentPack } from '../core/content.ts';
import { genFloorNumber } from '../core/floorgen.ts';
import { orderSlotsFor } from '../systems/orders.ts';
import { emptyV12Parts, emptyV13Parts, newNeighbors, type GameState, type Planting, type SlotState } from '../core/state.ts';
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

  state.seed = c.num('hạt giống', state.seed, { min: 0, int: true, fallback: 1 });
  state.player.level = c.num('cấp người chơi', state.player.level, { min: 1, int: true, fallback: 1 });
  state.player.coins = c.num('số xu', state.player.coins, { min: 0, int: true, fallback: 0 });
  state.player.gems = c.num('Ngọc Mây', state.player.gems, { min: 0, int: true, fallback: 0 });
  if (!state.upgrades || typeof state.upgrades !== 'object') state.upgrades = { storage: 0 };
  state.upgrades.storage = c.num('bậc Rương Mây', state.upgrades.storage, { min: 0, int: true, fallback: 0 });
  // Save 10: quests and tutorials. A save without them comes from before quests existed.
  if (!state.quests || typeof state.quests !== 'object' || !Array.isArray(state.tutorials)) {
    state.quests = emptyQuestState();
    state.tutorials = [];
    adoptQuestsForOldSave(content, state);
  }
  for (const k of ['progress', 'claims', 'periods'] as const) if (!state.quests[k] || typeof state.quests[k] !== 'object') state.quests[k] = {};
  for (const id of Object.keys(state.quests.progress)) if (!content.quests.has(id) || !(Number(state.quests.progress[id]) >= 0)) delete state.quests.progress[id];
  for (const id of Object.keys(state.quests.claims)) if (!content.quests.has(id) || !(Number(state.quests.claims[id]) >= 0)) delete state.quests.claims[id];
  state.tutorials = state.tutorials.filter((t) => typeof t === 'string');
  // Bản thử 9ef65c4 wrote save 9 without the gift budget: fill it in.
  if (!state.budget || typeof state.budget !== 'object') state.budget = { day: -1, giftGems: 0 };
  state.budget.day = c.num('ngày ngân sách quà', state.budget.day, { min: -1, int: true, fallback: -1 });
  state.budget.giftGems = c.num('ngọc quà trong ngày', state.budget.giftGems, { min: 0, int: true, fallback: 0 });
  state.player.xp = c.num('kinh nghiệm', state.player.xp, { min: 0, int: true, fallback: 0 });
  state.maxSeenAt = c.num('mốc thời gian', state.maxSeenAt, { min: 0, fallback: state.createdAt || 0 });
  state.clockOffsetMs = c.num('độ lệch đồng hồ', state.clockOffsetMs, { fallback: 0 });
  state.nextId = c.num('bộ đếm id', state.nextId, { min: 1, int: true, fallback: 1 });
  for (const key of ['harvests', 'coinsEarned', 'bugsCaught', 'ordersDone', 'gifts'] as const) {
    state.stats[key] = c.num(`thống kê ${key}`, state.stats?.[key], { min: 0, int: true, fallback: 0 });
  }

  reconcileInventory(state, content, c);
  reconcilePots(state, content, c);
  reconcileFloors(state, content, c);
  reconcileStock(state);
  reconcileWorld(state, content, c);
  reconcileV12(state, content, c);
  reconcileV13(state, content);

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
    if (pot.stars !== undefined) pot.stars = c.num(`sao ${def.name.vi} (${id})`, pot.stars, { min: 0, max: 5, int: true, fallback: 0 });
  }
}

function reconcileFloors(state: GameState, content: ContentPack, c: Checker): void {
  // Chỉ thị 10: a generated floor whose position became a hand-made floor (Tầng 4 → Vườn Trăng
  // Lơ Lửng) keeps its slots, pots and plants under the new floor id.
  state.floors.forEach((floor, i) => {
    const n = genFloorNumber(floor.floorId);
    const hand = n !== null ? content.floorList[n - 1] : undefined;
    if (hand && n === i + 1 && !content.floors.has(floor.floorId)) {
      c.warnings.push(`Tầng ${n} nay là ${hand.name.vi}, giữ nguyên chậu và cây`);
      floor.floorId = hand.id;
    }
  });
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
    // Chỉ thị 10: floors now start at 4 slots and expand to 6, but a floor the player already
    // opened further keeps every slot it has (nothing is taken away; it just cannot grow more).
    floor.stars = c.num(`sao ${def.name.vi}`, floor.stars, { min: 0, max: def.stars.length, int: true, fallback: 0 });
    floor.slots.forEach((slot, i) => {
      if (!state.pots[slot.potInstanceId]) {
        c.warnings.push(`Chậu ${slot.potInstanceId} bị thiếu, đã đặt chậu mới`);
        state.pots[slot.potInstanceId] = { potId: def.startingPot, level: 1 };
      }
      reconcilePlanting(state, content, slot, `chậu ${i + 1}`, c);
    });
  }
}

/** Order board, journal, neighbours, stall and letters: match the content pack. */
function reconcileWorld(state: GameState, content: ContentPack, c: Checker): void {
  const now = state.maxSeenAt;
  if (!state.orders || !Array.isArray(state.orders.slots)) state.orders = { slots: [], counter: 0 };
  state.orders.counter = c.num('bộ đếm đơn hàng', state.orders.counter, { min: 0, int: true, fallback: 0 });
  // Chỉ thị 10 § 3.6: up to the player's slot count (6, more by level), and a balloon on its way keeps
  // what it will pay (it is the player's: never dropped).
  // + 4: the Trạm Khinh Khí Cầu (chỉ thị 11) adds up to 4 slots; refillOrders never fills beyond the real number.
  const maxSlots = orderSlotsFor(content, state.player?.level ?? 1) + 4;
  state.orders.slots = state.orders.slots.slice(0, maxSlots).map((sl) => {
    const order = sl?.order && Object.keys(sl.order.items ?? {}).every((id) => content.items.has(id)) ? sl.order : null;
    const f = sl?.flight;
    const flight =
      f && typeof f === 'object'
        ? {
            coins: c.num('xu khinh khí cầu', f.coins, { min: 0, int: true, fallback: 0 }),
            xp: c.num('XP khinh khí cầu', f.xp, { min: 0, int: true, fallback: 0 }),
            gems: c.num('ngọc khinh khí cầu', f.gems, { min: 0, int: true, fallback: 0 }),
            items: Object.fromEntries(Object.entries(f.items ?? {}).filter(([id, q]) => content.items.has(id) && Number.isInteger(q) && q > 0)),
            customer: typeof f.customer === 'string' ? f.customer : '',
            rare: !!f.rare,
            bird: typeof f.bird === 'string' && content.birds?.has(f.bird) ? f.bird : null,
          }
        : null;
    return { order, readyAt: typeof sl?.readyAt === 'number' ? sl.readyAt : now, ...(flight ? { flight } : {}) };
  });
  while (state.orders.slots.length < content.orders.slots) state.orders.slots.push({ order: null, readyAt: now });
  if (state.orders.helpDay !== undefined && typeof state.orders.helpDay !== 'number') delete state.orders.helpDay;

  const journal: GameState['journal'] = {};
  for (const [id, e] of Object.entries(state.journal ?? {})) {
    if (!content.crops.has(id) || !e) continue;
    journal[id] = { harvests: Math.max(0, Math.floor(e.harvests) || 0), mutations: e.mutations ?? {}, claimed: Math.max(0, Math.floor(e.claimed) || 0) };
  }
  state.journal = journal;

  const fresh = newNeighbors(content, now);
  const neighbors: GameState['neighbors'] = {};
  for (const id of content.bots.keys()) {
    const bot = state.neighbors?.[id] ?? fresh[id]!;
    if (!bot.help || typeof bot.help.day !== 'number' || !Array.isArray(bot.help.pots)) bot.help = { day: -1, pots: [] };
    bot.stall = (Array.isArray(bot.stall) ? bot.stall : [])
      .filter((l) => l && content.items.has(l.itemId) && Number.isInteger(l.qty) && l.qty > 0 && Number.isFinite(l.price) && l.price > 0)
      .slice(0, content.neighbors.market.perSession);
    neighbors[id] = bot;
  }
  state.neighbors = neighbors;
  if (!state.market || typeof state.market.day !== 'number' || typeof state.market.buys !== 'number') state.market = { day: -1, buys: 0 };
  // Chỉ thị 10 § 3.11: Xu Xu's gift clock.
  if (state.xuxu !== undefined) {
    const x = state.xuxu as Partial<NonNullable<GameState['xuxu']>> | null;
    if (!x || typeof x !== 'object' || !Number.isFinite(x.giftAt) || !Number.isInteger(x.taps) || x.taps! < 0) delete state.xuxu;
  }
  // Chỉ thị 12 B2: the Sạp Săn Hàng board. A broken board is dropped (a new one is laid on next look);
  // slots of things no longer in the content are dropped, and Vận May counters kept when they are sane.
  if (state.bazaar !== undefined) {
    const z = state.bazaar as Partial<NonNullable<GameState['bazaar']>> | null;
    if (!z || typeof z !== 'object' || !Number.isInteger(z.window) || !Number.isInteger(z.roll) || !Array.isArray(z.slots)) delete state.bazaar;
    else {
      z.slots = z.slots.filter(
        (sl) => sl && (sl.kind === 'pot' ? content.pots.has(sl.id) : sl.kind === 'item' && content.items.has(sl.id)) && Number.isInteger(sl.qty) && sl.qty > 0 && Number.isFinite(sl.price) && sl.price > 0 && (sl.currency === 'coins' || sl.currency === 'gems'),
      );
      if (!Number.isInteger(z.day)) z.day = -1;
      if (!Number.isInteger(z.rerolls) || z.rerolls! < 0) z.rerolls = 0;
      const luck: Record<string, number> = {};
      for (const [k, v] of Object.entries(z.luck && typeof z.luck === 'object' ? z.luck : {})) if (Number.isInteger(v) && v >= 0) luck[k] = v;
      z.luck = luck;
    }
  }
  if (!state.ranks || typeof state.ranks.day !== 'number' || typeof state.ranks.prev !== 'object' || state.ranks.prev === null) state.ranks = { day: -1, prev: {} };

  // Pot collection and event progress (POT_SYSTEM 8).
  if (!state.potBook || typeof state.potBook !== 'object') state.potBook = {};
  for (const p of Object.values(state.pots)) {
    if (!Array.isArray(p.history)) p.history = [];
    const e = state.potBook[p.potId];
    if (!e) state.potBook[p.potId] = { firstAt: p.obtainedAt ?? state.createdAt, bestLevel: p.level };
    else e.bestLevel = Math.max(e.bestLevel || 1, p.level);
  }
  state.potBookClaimed = c.num('thưởng bộ sưu tập', state.potBookClaimed, { min: 0, max: content.config.collectionRewards?.length ?? 0, int: true, fallback: 0 });
  const events: GameState['events'] = {};
  for (const ev of content.events) {
    const e = state.events?.[ev.id];
    if (e) events[ev.id] = { points: Math.max(0, Math.floor(Number(e.points)) || 0), claimed: Math.max(0, Math.min(ev.milestones.length, Math.floor(Number(e.claimed)) || 0)) };
  }
  state.events = events;

  const m = state.missions;
  const valid = m && typeof m.day === 'number' && Array.isArray(m.list) && m.list.every((x) => x && content.missions.pool.some((d) => d.id === x.id));
  if (!valid) state.missions = { day: -1, list: [], bonusClaimed: false };
  else for (const x of m.list) x.progress = Math.max(0, Math.floor(Number(x.progress)) || 0);

  state.stall = (Array.isArray(state.stall) ? state.stall : []).filter((l) => {
    if (l && content.items.has(l.itemId) && l.qty > 0 && l.price > 0) return true;
    if (l) c.warnings.push(`Đã gỡ món không còn trong game khỏi Sạp: ${String(l.itemId)}`);
    return false;
  });
  state.notices = Array.isArray(state.notices) ? state.notices.slice(0, 30) : [];
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

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Birds as stored: unknown species dropped, every number clamped, a perch past the last floor cleared. */
function cleanBirds(content: ContentPack, input: unknown, floors: number, at: number, c: Checker): GameState['birds'] {
  const birdSpecies = content.birds;
  const list = (Array.isArray(input) ? input : []).filter((b) => obj(b) && typeof b.id === 'string' && (!birdSpecies || (typeof b.species === 'string' && birdSpecies.has(b.species)))) as GameState['birds'];
  for (const b of list) {
    b.level = c.num('cấp chim', b.level, { min: 1, max: 10, int: true, fallback: 1 });
    b.caught = c.num('số bọ chim đã bắt', b.caught, { min: 0, int: true, fallback: 0 });
    b.food = c.num('độ no của chim', b.food, { min: 0, max: 100, fallback: 0 });
    b.fedAt = c.num('lúc cho chim ăn', b.fedAt, { min: 0, fallback: at });
    b.simulatedTo = c.num('mốc chim', b.simulatedTo, { min: 0, fallback: at });
    b.branch = c.num('cành đậu', b.branch, { min: 0, max: 1, int: true, fallback: 0 });
    if (b.floor !== null && !(Number.isInteger(b.floor) && b.floor >= 0 && b.floor < floors)) b.floor = null;
    if (b.rentUntil !== null && typeof b.rentUntil !== 'number') b.rentUntil = null;
    if (!obj(b.today) || typeof b.today.day !== 'number' || typeof b.today.count !== 'number') b.today = { day: -1, count: 0 };
    if (b.escort !== null && !(obj(b.escort) && typeof b.escort.slot === 'number' && typeof b.escort.until === 'number')) b.escort = null;
  }
  return list;
}

/** Save 13 (chỉ thị 11): houses of the content only, levels 1–5, sane timers; village lists of numbers. */
function reconcileV13(state: GameState, content: ContentPack): void {
  const d = emptyV13Parts();
  const known = new Set((content.village?.houses ?? []).map((h) => h.id));
  const b = obj(state.buildings) ? state.buildings : d.buildings;
  const out: GameState['buildings'] = {};
  for (const [id, v] of Object.entries(b)) {
    if (!known.has(id) || !obj(v)) continue;
    const level = Number.isInteger(v.level) ? Math.min(5, Math.max(1, v.level)) : 1;
    const ends = typeof v.upgradeEndsAt === 'number' && Number.isFinite(v.upgradeEndsAt) && level < 5 ? v.upgradeEndsAt : null;
    out[id] = { level, upgradeEndsAt: ends };
  }
  state.buildings = out;
  const v = obj(state.village) ? state.village : d.village;
  const nums = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((n) => Number.isInteger(n) && n >= 0))] : []);
  const ci = obj(v.checkIn) && Number.isInteger(v.checkIn.day) && Number.isInteger(v.checkIn.count) && v.checkIn.count >= 0 ? v.checkIn : d.village.checkIn;
  state.village = { seenZones: nums(v.seenZones), medals: nums(v.medals), checkIn: { day: ci.day, count: ci.count } };
}

/**
 * Save 12 (chỉ thị 10): birds, Xưởng Bọ, Biển Mây, energy, fishing, collections, floor decor.
 * Missing parts get their defaults; unknown ids are dropped; numbers are clamped.
 */
function reconcileV12(state: GameState, content: ContentPack, c: Checker): void {
  const d = emptyV12Parts(state.maxSeenAt || state.createdAt || 0);
  for (const f of state.floors) {
    const decor = Array.isArray(f.decor) ? f.decor : [];
    f.decor = [0, 1].map((i) => {
      const id = decor[i];
      return typeof id === 'string' && content.items.has(id) ? id : null;
    });
  }
  state.birds = cleanBirds(content, state.birds, state.floors.length, state.maxSeenAt, c);
  // Chỉ thị 11 D1: neighbours' birds and bugs (saves from before have none).
  for (const bot of Object.values(state.neighbors)) {
    bot.birds = cleanBirds(content, bot.birds, Math.max(1, content.floorList.length), state.maxSeenAt, c);
    bot.bugs = obj(bot.bugs) ? Object.fromEntries(Object.entries(bot.bugs).filter(([id, q]) => content.bugs.has(id) && Number.isInteger(q) && q > 0)) : {};
  }
  if (!obj(state.workshop)) state.workshop = d.workshop;
  for (const [id, m] of Object.entries(state.workshop)) {
    if ((content.machines && !content.machines.has(id)) || !obj(m)) {
      delete state.workshop[id];
      continue;
    }
    m.stars = c.num('sao máy', m.stars, { min: 1, max: 5, int: true, fallback: 1 });
    m.slots = c.num('khe máy', m.slots, { min: 2, max: 4, int: true, fallback: 2 });
    m.queue = (Array.isArray(m.queue) ? m.queue : []).filter((j) => obj(j) && typeof j.recipe === 'string' && typeof j.endsAt === 'number').slice(0, m.slots);
  }
  const sm = state.seaMap;
  if (!obj(sm) || typeof sm.day !== 'number' || !Array.isArray(sm.open) || !Array.isArray(sm.chests)) state.seaMap = d.seaMap;
  else {
    sm.open = [...new Set(sm.open.filter((i) => Number.isInteger(i) && i >= 0 && i < 48))];
    sm.chests = [...new Set(sm.chests.filter((i) => Number.isInteger(i) && i >= 0 && i < 48))];
    sm.index = c.num('bản đồ Biển Mây', sm.index, { min: 0, int: true, fallback: 0 });
    sm.cleared = sm.cleared === true;
  }
  if (!obj(state.energy)) state.energy = d.energy;
  state.energy.value = c.num('Năng Lượng Gió', state.energy.value, { min: 0, max: 30 + 10, fallback: 30 });
  state.energy.at = c.num('mốc Năng Lượng Gió', state.energy.at, { min: 0, fallback: state.maxSeenAt });
  state.energy.dailyDay = c.num('ngày năng lượng', state.energy.dailyDay, { min: -1, int: true, fallback: -1 });
  if (!obj(state.fishing) || typeof state.fishing.freeBaitDay !== 'number') state.fishing = d.fishing;
  if (state.fishing.casts !== undefined) state.fishing.casts = c.num('lần thả câu', state.fishing.casts, { min: 0, int: true, fallback: 0 });
  const hk = state.fishing.hooked;
  if (hk !== undefined && hk !== null && !(obj(hk) && typeof hk.fishId === 'string' && content.fish.has(hk.fishId) && typeof hk.bait === 'string')) delete state.fishing.hooked;
  if (!obj(state.collections)) state.collections = d.collections;
  const col = state.collections;
  for (const k of ['bugs', 'fish'] as const) {
    if (!obj(col[k])) col[k] = {};
    for (const [id, e] of Object.entries(col[k])) {
      if (!obj(e)) delete col[k][id];
      else {
        e.firstAt = c.num('sổ sưu tầm', e.firstAt, { min: 0, fallback: 0 });
        e.count = c.num('sổ sưu tầm', e.count, { min: 0, int: true, fallback: 0 });
      }
    }
  }
  for (const id of Object.keys(col.bugs)) if (!content.bugs.has(id)) delete col.bugs[id];
  if (!Array.isArray(col.claimed)) col.claimed = [];
  col.claimed = col.claimed.filter((x) => typeof x === 'string');
  // A save from before the Sổ Sâu Bọ: bugs already in the bag (or ever caught) count as seen.
  for (const b of content.bugList) {
    const have = (state.inventory[b.id] ?? 0) > 0;
    if (have && !col.bugs[b.id]) col.bugs[b.id] = { firstAt: state.maxSeenAt, count: state.inventory[b.id] ?? 0 };
  }
}
