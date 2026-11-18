// Chỉ thị 12 TỔNG B2: the Sạp Săn Hàng at Chợ Mây — eight slots laid out by Phú Bà, each with a
// rarity, each bought once. The board refreshes for free every few hours; the player may "đặt lại"
// (reroll) at once for coins, U(level) × baseU × growth^n where n is today's rerolls — the main coin
// sink. Vận May: each paid reroll that shows nothing of a rarity or better adds one to that rarity's
// counter; at its mark the next reroll is sure to show one. Slots the player lacks for a pot upgrade
// come up more often. Everything is keyed on the save's seed and a roll counter (deterministic,
// offline-exact). All numbers live in market.json.

import { BAZAAR_RARITIES, type BazaarEntry, type BazaarRarity, type BazaarRules, type ContentPack } from '../core/content.ts';
import type { BazaarSlot, BazaarState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { tidy } from '../core/income.ts';
import { localDay } from './missions.ts';
import { addItem, storageFree } from './economy.ts';
import { nextUpgradeCost } from './pots.ts';
import { obtainPot } from './potStars.ts';
import { addNotice, bugTraderPrice } from './neighbors.ts';

export type BazaarError = 'locked' | 'bad_slot' | 'already_bought' | 'not_enough_coins' | 'not_enough_gems' | 'storage_full';

const HOUR = 3_600_000;
const rank = (r: BazaarRarity) => BAZAAR_RARITIES.indexOf(r);

export function bazaarRules(content: ContentPack): BazaarRules | null {
  return content.market?.bazaar ?? null;
}

export function bazaarOpen(content: ContentPack, state: GameState): boolean {
  const b = bazaarRules(content);
  return !!b && state.player.level >= b.unlockLevel;
}

/** Index of the free-refresh window (local time, so windows start at local midnight). */
export function bazaarWindow(content: ContentPack, now: number): number {
  const b = bazaarRules(content)!;
  return Math.floor((now + content.missions.utcOffsetHours * HOUR) / (b.refreshHours * HOUR));
}

/** Game time of the next free refresh. */
export function nextFreeRefreshAt(content: ContentPack, now: number): number {
  const b = bazaarRules(content)!;
  return (bazaarWindow(content, now) + 1) * b.refreshHours * HOUR - content.missions.utcOffsetHours * HOUR;
}

/** Rerolls made today (0 when the day changed). */
export function rerollsToday(content: ContentPack, state: GameState, now: number): number {
  const z = state.bazaar;
  return z && z.day === localDay(content, now) ? z.rerolls : 0;
}

/** Coins for the next reroll: U(level) × baseU × growth^n, never below minCoins. */
export function rerollCost(content: ContentPack, state: GameState, now: number): number {
  const r = bazaarRules(content)!.reroll;
  const n = rerollsToday(content, state, now);
  return Math.max(r.minCoins, tidy(content.income.unit(state.player.level) * r.baseU * Math.pow(r.growth, n)));
}

/** Vận May: for each pity mark, how far the counter is. */
export function luckBars(content: ContentPack, state: GameState): Array<{ rarity: BazaarRarity; have: number; at: number }> {
  const b = bazaarRules(content);
  if (!b) return [];
  return b.pity.map((p) => ({ rarity: p.rarity, have: Math.min(p.at, state.bazaar?.luck[p.rarity] ?? 0), at: p.at }));
}

/** Bugs and materials the player is short of for some pot's next upgrade (chỉ thị 12 B2 "đồ đang thiếu"). */
export function wantedItems(content: ContentPack, state: GameState): Set<string> {
  const want = new Set<string>();
  for (const pot of Object.values(state.pots)) {
    const cost = nextUpgradeCost(content, pot);
    if (!cost) continue;
    for (const [id, q] of Object.entries(cost.items)) if ((state.inventory[id] ?? 0) < q) want.add(id);
  }
  return want;
}

/** What one pool entry could put on a slot for a player of this level. */
function candidates(content: ContentPack, e: BazaarEntry, level: number): Array<{ kind: 'item' | 'pot'; id: string }> {
  switch (e.pick) {
    case 'produce':
      return content.cropList.filter((c) => c.unlockLevel <= level + (e.levelAhead ?? 0)).map((c) => ({ kind: 'item' as const, id: c.produce.id }));
    case 'bug':
      return content.bugList.filter((b) => b.rarity === e.rarity && b.unlockLevel <= level).map((b) => ({ kind: 'item' as const, id: b.id }));
    case 'item':
      return e.id && content.items.has(e.id) ? [{ kind: 'item', id: e.id }] : [];
    case 'pot':
      return content.potList
        .filter((p) => (e.rarities ?? []).includes(p.rarity) && p.unlockLevel <= level && (!e.signature || p.sprite.startsWith('pots/sig/')))
        .map((p) => ({ kind: 'pot' as const, id: p.id }));
  }
}

/** The least a slot may cost: what it sells for again × the market markup, so nothing resells at a profit. */
function resaleFloor(content: ContentPack, kind: 'item' | 'pot', id: string, qty: number): number {
  const v = kind === 'pot' ? (content.pots.get(id)?.price ?? 0) : (content.items.get(id)?.sellPrice ?? bugTraderPrice(content, id) ?? 0);
  return Math.ceil(v * qty * content.neighbors.market.markup);
}

function weighted<T extends { weight: number }>(list: T[], roll: number): T {
  const total = list.reduce((a, x) => a + x.weight, 0);
  let pick = roll * total;
  for (const x of list) {
    if (pick < x.weight) return x;
    pick -= x.weight;
  }
  return list[list.length - 1]!;
}

/** Fills one slot of this rarity (falls to a lower rarity when nothing of it fits the player yet). */
function makeSlot(content: ContentPack, state: GameState, rarity: BazaarRarity, r: (k: string) => number, taken: Set<string>, wanted: Set<string>): BazaarSlot | null {
  const b = bazaarRules(content)!;
  const level = state.player.level;
  for (let k = rank(rarity); k >= 0; k--) {
    const rar = BAZAAR_RARITIES[k]!;
    const options = (b.pools[rar] ?? []).map((e) => ({ e, ids: candidates(content, e, level).filter((c) => !taken.has(c.id)), weight: e.weight })).filter((o) => o.ids.length > 0);
    if (options.length === 0) continue;
    let pickE = weighted(options, r('entry'));
    let pickC = pickE.ids[Math.floor(r('id') * pickE.ids.length)]!;
    if (rar === b.wantedRarity && r('want') < b.wantedChance) {
      const hits = options.flatMap((o) => o.ids.filter((c) => wanted.has(c.id)).map((c) => ({ o, c })));
      if (hits.length > 0) {
        const hit = hits[Math.floor(r('wantId') * hits.length)]!;
        pickE = hit.o;
        pickC = hit.c;
      }
    }
    const e = pickE.e;
    const qty = pickC.kind === 'pot' ? 1 : e.qty ? e.qty[0] + Math.floor(r('qty') * (e.qty[1] - e.qty[0] + 1)) : 1;
    const rarDef = b.rarities.find((x) => x.id === rar);
    const gems = e.currency === 'gems';
    const price = gems ? e.gems! : Math.max(1, tidy(content.income.unit(level) * (rarDef?.priceU ?? 0) * (e.priceFactor ?? 1)), resaleFloor(content, pickC.kind, pickC.id, qty));
    const bots = [...content.bots.keys()].sort();
    const seller = bots.length ? bots[Math.floor(r('seller') * bots.length)]! : '';
    taken.add(pickC.id);
    return { rarity: rar, kind: pickC.kind, id: pickC.id, qty, currency: gems ? 'gems' : 'coins', price, seller };
  }
  return null;
}

/** Lays out a new board. `sure` is a rarity at least one slot must reach (Vận May). */
function lay(content: ContentPack, state: GameState, z: BazaarState, sure: BazaarRarity | null): void {
  const b = bazaarRules(content)!;
  const roll = (z.roll += 1);
  const rarities: BazaarRarity[] = [];
  const odds = b.rarities.map((x) => ({ id: x.id, weight: x.weight })).filter((x) => x.weight > 0);
  for (let i = 0; i < b.slots; i++) rarities.push(odds.length ? weighted(odds, randomFor(state.seed, 'bazaar', roll, i, 'rarity')).id : 'common');
  if (sure && !rarities.some((x) => rank(x) >= rank(sure))) rarities[Math.floor(randomFor(state.seed, 'bazaar', roll, 'sure') * b.slots)] = sure;
  const taken = new Set<string>();
  const wanted = wantedItems(content, state);
  z.slots = [];
  rarities.forEach((rar, i) => {
    const slot = makeSlot(content, state, rar, (k) => randomFor(state.seed, 'bazaar', roll, i, k), taken, wanted);
    if (slot) z.slots.push(slot);
  });
}

/** Rolls a free board when the refresh window changed (or there is none yet). Returns true if it did. */
export function ensureBazaar(content: ContentPack, state: GameState, now: number): boolean {
  if (!bazaarOpen(content, state)) return false;
  const w = bazaarWindow(content, now);
  if (state.bazaar && state.bazaar.window === w) return false;
  const z: BazaarState = state.bazaar ?? { window: w, roll: 0, slots: [], day: localDay(content, now), rerolls: 0, luck: {} };
  z.window = w;
  lay(content, state, z, null);
  state.bazaar = z;
  return true;
}

/** Paid reroll. Returns the coins paid and the best rarity that showed up. */
export function rerollBazaar(content: ContentPack, state: GameState, now: number): BazaarError | { coins: number; best: BazaarRarity; sure: BazaarRarity | null } {
  if (!bazaarOpen(content, state)) return 'locked';
  ensureBazaar(content, state, now);
  const b = bazaarRules(content)!;
  const z = state.bazaar!;
  const cost = rerollCost(content, state, now);
  if (state.player.coins < cost) return 'not_enough_coins';
  state.player.coins -= cost;
  const day = localDay(content, now);
  if (z.day !== day) ((z.day = day), (z.rerolls = 0));
  z.rerolls += 1;
  // The highest pity mark reached decides what is sure to show.
  const due = b.pity.filter((p) => (z.luck[p.rarity] ?? 0) >= p.at).sort((x, y) => rank(y.rarity) - rank(x.rarity))[0];
  const sure = due?.rarity ?? null;
  lay(content, state, z, sure);
  const best = z.slots.reduce<BazaarRarity>((m, s) => (rank(s.rarity) > rank(m) ? s.rarity : m), 'common');
  for (const p of b.pity) z.luck[p.rarity] = rank(best) >= rank(p.rarity) ? 0 : (z.luck[p.rarity] ?? 0) + 1;
  return { coins: cost, best, sure };
}

/** Buys one slot (once). Coins go to the Phú Bà who laid it out. */
export function buyBazaar(content: ContentPack, state: GameState, index: number, now: number): BazaarError | { slot: BazaarSlot; potInstanceId?: string; shards?: { itemId: string; qty: number } } {
  if (!bazaarOpen(content, state)) return 'locked';
  ensureBazaar(content, state, now);
  const slot = state.bazaar?.slots[index];
  if (!slot) return 'bad_slot';
  if (slot.sold) return 'already_bought';
  if (slot.currency === 'gems' ? state.player.gems < slot.price : state.player.coins < slot.price) return slot.currency === 'gems' ? 'not_enough_gems' : 'not_enough_coins';
  if (slot.kind === 'item' && content.items.get(slot.id)?.countsTowardStorage && storageFree(content, state) < slot.qty) return 'storage_full';
  if (slot.currency === 'gems') state.player.gems -= slot.price;
  else {
    state.player.coins -= slot.price;
    const seller = state.neighbors[slot.seller];
    if (seller) seller.coins += slot.price;
  }
  slot.sold = true;
  let potInstanceId: string | undefined;
  let shards: { itemId: string; qty: number } | undefined;
  if (slot.kind === 'pot') {
    const got = obtainPot(content, state, slot.id, 'bazaar', now);
    if ('potInstanceId' in got) potInstanceId = got.potInstanceId;
    else shards = got.shards;
  } else addItem(state, slot.id, slot.qty);
  if (slot.rarity === 'legendary') {
    const name = slot.kind === 'pot' ? content.pots.get(slot.id)?.name.vi : content.items.get(slot.id)?.name.vi;
    addNotice(state, now, `Bạn vừa săn được ${name ?? 'món Huyền Thoại'} ở Chợ Mây!`);
  }
  return { slot, ...(potInstanceId ? { potInstanceId } : {}), ...(shards ? { shards } : {}) };
}
