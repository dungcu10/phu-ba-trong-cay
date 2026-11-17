// Neighbour BOTs (owner decision 2026-11-16, part 4; QUALITY_STANDARDS 5).
//
// Each neighbour has saved state (level, coins, garden, friendship) and lives in fixed sessions
// of game time. In each session it scores its options from its personality and the world as it
// is now (what the player's stall offers and at what price, its own coins) and does the best
// one, recording why. Actions have real effects: buying from the stall pays the player and
// removes the goods; gifts add items. Sessions are keyed by absolute time, so simulating eight
// hours at once or minute by minute gives the same result, and it all runs without drawing.

import type { BotDef, ContentPack } from '../core/content.ts';
import type { BotListing, BotState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { xpToNextLevel } from './economy.ts';

export type NeighborEvent =
  | { type: 'stallSold'; botId: string; itemId: string; qty: number; coins: number }
  | { type: 'neighborGift'; botId: string; kind: 'coins' | 'bug'; amount: number };

const MAX_NOTICES = 30;

/** What a neighbour is willing to pay per item: more for traders and for crops it likes. */
export function valuation(content: ContentPack, bot: BotDef, itemId: string): number {
  const item = content.items.get(itemId);
  if (!item || item.sellPrice === null) return 0;
  const baseId = item.baseItem ?? itemId;
  const crop = content.cropList.find((c) => c.produce.id === baseId);
  const likes = crop?.family === bot.likes ? 0.3 : 0;
  const collector = item.mutation ? bot.traits.collector * 0.8 : 0;
  return item.sellPrice * (1.15 + 0.85 * bot.traits.trader + likes + collector);
}

export function addNotice(state: GameState, at: number, text: string): void {
  state.notices.unshift({ at, text, read: false });
  if (state.notices.length > MAX_NOTICES) state.notices.length = MAX_NOTICES;
}

function botLevelUps(content: ContentPack, s: BotState): void {
  // Neighbours level more slowly than the player (×3 XP per level). No cap, like the player.
  while (s.xp >= xpToNextLevel(content, s.level) * 3) {
    s.xp -= xpToNextLevel(content, s.level) * 3;
    s.level += 1;
  }
}

/** One session of one neighbour. */
function session(content: ContentPack, state: GameState, bot: BotDef, s: BotState, index: number, at: number, events: NeighborEvent[]): void {
  const r = (k: string) => randomFor(state.seed, 'bot', bot.id, index, k);
  const t = bot.traits;
  if (r('active') > 0.35 + 0.5 * t.diligence) {
    s.lastAction = { kind: 'rest', reason: 'Nghỉ ngơi phiên này (ít chăm chỉ)', at };
    return;
  }

  // Score each option from personality and the current world.
  const options: Array<{ kind: string; score: number; run: () => string }> = [];
  options.push({
    kind: 'farm',
    score: t.diligence * (0.6 + r('farm')),
    run: () => {
      const income = Math.round(s.level * (15 + 30 * t.diligence) * (0.7 + 0.6 * r('income')));
      s.coins += income;
      s.xp += Math.round(income * 0.4);
      botLevelUps(content, s);
      return `Chăm vườn, kiếm ${income} xu`;
    },
  });
  let best: { i: number; deal: number; qty: number } | null = null;
  state.stall.forEach((l, i) => {
    const worth = valuation(content, bot, l.itemId);
    const deal = (worth - l.price) / worth;
    const qty = Math.min(l.qty, Math.floor(s.coins / l.price), 10);
    if (deal > 0 && qty > 0 && (!best || deal > best.deal)) best = { i, deal, qty };
  });
  if (best) {
    const b = best as { i: number; deal: number; qty: number };
    options.push({
      kind: 'shop',
      score: t.trader * (0.8 + b.deal * 2) + r('shop') * 0.3,
      run: () => {
        const l = state.stall[b.i]!;
        const coins = b.qty * l.price;
        s.coins -= coins;
        s.gardenValue += Math.round(coins * 0.5);
        state.player.coins += coins;
        state.stats.coinsEarned += coins;
        l.qty -= b.qty;
        if (l.qty === 0) state.stall.splice(b.i, 1);
        const name = content.items.get(l.itemId)?.name.vi ?? l.itemId;
        events.push({ type: 'stallSold', botId: bot.id, itemId: l.itemId, qty: b.qty, coins });
        addNotice(state, at, `${bot.name.vi} mua ${b.qty} ${name} ở Sạp của bạn: +${coins} xu`);
        return `Mua ${b.qty} ${name} giá ${l.price} xu vì rẻ hơn mức sẵn lòng trả ${Math.round(valuation(content, bot, l.itemId))} xu`;
      },
    });
  }
  if (s.coins > 400 * s.level) {
    options.push({
      kind: 'invest',
      score: t.collector * 0.8 + r('invest') * 0.3,
      run: () => {
        const spent = Math.round(s.coins * 0.4);
        s.coins -= spent;
        s.gardenValue += spent;
        return `Đầu tư ${spent} xu vào vườn vì đang dư tiền`;
      },
    });
  }
  options.sort((a, b) => b.score - a.score);
  const chosen = options[0]!;
  s.lastAction = { kind: chosen.kind, reason: chosen.run(), at };
  restock(content, bot, s, r);

  // Independently: drop by the player's garden with a small gift (more often when friends).
  if (r('visit') < content.neighbors.giftChance * (1 + s.friendship * 0.05)) {
    s.friendship += content.neighbors.visitFriendship;
    state.stats.gifts += 1;
    if (r('giftKind') < 0.4 && content.bugList[0]) {
      const bug = content.bugList[0];
      state.inventory[bug.id] = (state.inventory[bug.id] ?? 0) + 1;
      events.push({ type: 'neighborGift', botId: bot.id, kind: 'bug', amount: 1 });
      addNotice(state, at, `${bot.name.vi} ghé vườn, bắt giúp 1 ${bug.name.vi} tặng bạn`);
    } else {
      const amount = 5 * s.level;
      state.player.coins += amount;
      events.push({ type: 'neighborGift', botId: bot.id, kind: 'coins', amount });
      addNotice(state, at, `${bot.name.vi} ghé vườn, để lại ${amount} xu làm quà`);
    }
  }
}

// ------------------------------------------------------------------ Chợ Mây (chỉ thị 07) ---

/** Reference value of an item: what the shop pays, or the configured value for bugs/materials. */
export function marketValue(content: ContentPack, itemId: string): number {
  const item = content.items.get(itemId);
  if (item && item.sellPrice !== null) return item.sellPrice;
  return content.neighbors.market.values[itemId] ?? 0;
}

/** A neighbour's asking price: never below markup × value, cheaper from traders. */
export function askingPrice(content: ContentPack, bot: BotDef, itemId: string): number {
  const m = content.neighbors.market;
  const item = content.items.get(itemId);
  const collector = item?.mutation ? 0.5 * bot.traits.collector : 0;
  return Math.max(1, Math.ceil(marketValue(content, itemId) * m.markup * (1 + 0.35 * (1 - bot.traits.trader) + collector)));
}

/** True when the item is a crop the player cannot grow yet (costs more at the market). */
export function lockedForPlayer(content: ContentPack, state: GameState, itemId: string): boolean {
  const base = content.items.get(itemId)?.baseItem ?? itemId;
  const crop = content.cropList.find((c) => c.produce.id === base);
  return !!crop && crop.unlockLevel > state.player.level;
}

/** What the player pays per item for a listing right now. */
export function playerPrice(content: ContentPack, state: GameState, listing: BotListing): number {
  return lockedForPlayer(content, state, listing.itemId) ? Math.ceil(listing.price * content.neighbors.market.lockedMarkup) : listing.price;
}

/** Things a neighbour may lay out: crops it can grow (favourite family first), bugs, clay, seals. */
function marketPool(content: ContentPack, bot: BotDef, s: BotState): Array<{ id: string; w: number; max: number }> {
  const pool: Array<{ id: string; w: number; max: number }> = [];
  const m = content.neighbors.market;
  for (const crop of content.cropList) {
    if (crop.unlockLevel > s.level) continue;
    pool.push({ id: crop.produce.id, w: crop.family === bot.likes ? 3 : 1, max: m.maxQty });
    if (bot.traits.collector > 0.5) {
      for (const it of content.items.values()) {
        if (it.baseItem === crop.produce.id) pool.push({ id: it.id, w: 0.25 * bot.traits.collector, max: 2 });
      }
    }
  }
  for (const id of Object.keys(m.values)) {
    if (!content.items.has(id)) continue;
    const seal = id.includes('merit');
    pool.push({ id, w: seal ? 0.15 * bot.traits.collector : 0.8, max: seal ? 1 : 4 });
  }
  return pool;
}

/** After its main action, a neighbour may refresh its stall. Deterministic per (save, bot, session). */
function restock(content: ContentPack, bot: BotDef, s: BotState, r: (k: string) => number): void {
  const m = content.neighbors.market;
  if (!Array.isArray(s.stall)) s.stall = [];
  // Unsold goods are sometimes taken back (keeps stalls changing).
  if (s.stall.length > 0 && r('unlist') < 0.2) s.stall.shift();
  if (r('restock') > m.restockChance * (0.5 + bot.traits.trader)) return;
  const want = Math.max(1, Math.min(m.perSession, Math.round(m.perSession * (0.3 + 0.7 * bot.traits.trader) * (0.5 + 0.5 * bot.traits.diligence))));
  const pool = marketPool(content, bot, s).filter((p) => !s.stall.some((l) => l.itemId === p.id));
  let k = 0;
  while (s.stall.length < want && pool.length > 0) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let pick = r(`pick${k}`) * total;
    let i = 0;
    while (i < pool.length - 1 && pick > pool[i]!.w) pick -= pool[i++]!.w;
    const p = pool.splice(i, 1)[0]!;
    const qty = Math.max(1, Math.round(p.max * (0.3 + 0.7 * r(`qty${k}`))));
    s.stall.push({ itemId: p.id, qty, price: askingPrice(content, bot, p.id) });
    k += 1;
  }
}

/** Everyone on the Phú Bà board, richest first. The player's id is "". */
export function rankings(content: ContentPack, state: GameState): Array<{ id: string; wealth: number }> {
  const rows = [{ id: '', wealth: playerWealth(content, state) }];
  for (const bot of content.bots.values()) {
    const s = state.neighbors[bot.id];
    if (s) rows.push({ id: bot.id, wealth: botWealth(s) });
  }
  return rows.sort((a, b) => b.wealth - a.wealth || a.id.localeCompare(b.id));
}

/** Keeps yesterday's ranks for the board's up/down arrows (taken at the first update of a day). */
export function snapshotRanks(content: ContentPack, state: GameState, day: number): void {
  if (state.ranks.day === day) return;
  state.ranks = { day, prev: Object.fromEntries(rankings(content, state).map((r, i) => [r.id, i + 1])) };
}

/**
 * Brings every neighbour up to `now`. Sessions run in global time order (all neighbours at
 * 10:00, then all at 10:30…), so neighbours share the stall fairly and the result does not
 * depend on how the time span is split. Very long absences are compressed (farming income only).
 */
export function simulateNeighbors(content: ContentPack, state: GameState, now: number): NeighborEvent[] {
  const cfg = content.neighbors;
  const step = cfg.sessionMinutes * 60_000;
  const cap = cfg.catchUpDays * 86_400_000;
  const events: NeighborEvent[] = [];
  const active: Array<{ bot: BotDef; s: BotState }> = [];
  for (const bot of content.bots.values()) {
    const s = state.neighbors[bot.id];
    if (!s) continue;
    if (now - s.simulatedTo > cap) {
      const skipped = Math.floor((now - cap - s.simulatedTo) / step);
      const avg = s.level * (15 + 30 * bot.traits.diligence) * (0.35 + 0.5 * bot.traits.diligence);
      s.coins += Math.round(avg * skipped * 0.5);
      s.gardenValue += Math.round(avg * skipped * 0.5);
      s.simulatedTo += skipped * step;
    }
    active.push({ bot, s });
  }
  if (active.length === 0) return events;
  let index = Math.min(...active.map((a) => Math.floor(a.s.simulatedTo / step) + 1));
  while (index * step <= now) {
    const at = index * step;
    for (const { bot, s } of active) {
      if (s.simulatedTo >= at) continue;
      session(content, state, bot, s, index, at, events);
      s.simulatedTo = at;
    }
    index += 1;
  }
  return events;
}

/** Assets for the "Bảng Phú Bà" leaderboard. */
export function playerWealth(content: ContentPack, state: GameState): number {
  let pots = 0;
  for (const p of Object.values(state.pots)) pots += (content.pots.get(p.potId)?.price ?? 25) * p.level;
  return state.player.coins + pots + state.player.gems * 50 + state.player.level * 200;
}

export function botWealth(s: BotState): number {
  return s.coins + s.gardenValue + s.level * 200;
}
