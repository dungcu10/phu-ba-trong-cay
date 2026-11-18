// Hot-air balloon orders (owner decision 2026-11-16, part 2; chỉ thị 10 § 3.6 in M6). Six slots
// (more at higher levels); each order asks for a few kinds of produce — and, once the Xưởng Bọ is open,
// often a processed good — and pays more than the shop. Orders are generated from the seed and a
// counter, so they are reproducible, and only from what the player can already make.
//
// Sending an order: the items leave now, the balloon flies off (refillSeconds) with an optional
// escorting bird, and pays coins, XP, gems and items when it comes back, then brings the next order.
// A rare order (gold border) pays double and an extra Sợi Mây Kết / Giọt Sương Trời, and leaves after
// rareHours. Once a day the player can ask the neighbours to chip in for an order.

import type { ContentPack, CropDef, GoodDef } from '../core/content.ts';
import type { GameState, Order, OrderFlight } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { addItem, addXp } from './economy.ts';
import { machineOrderBonus } from './workshop.ts';
import { localDay } from './missions.ts';
import { hotCrop } from './cropExtras.ts';
import { houseBonus } from './village.ts';

const HOUR = 3_600_000;

/** Goods the player can make now: machine open and every produce input already unlocked. */
function makeableGoods(content: ContentPack, level: number): GoodDef[] {
  if (!content.goods || !content.recipes) return [];
  const out: GoodDef[] = [];
  for (const g of content.goods.values()) {
    const ok = [...content.recipes.values()].some(
      ({ machine, recipe }) =>
        recipe.output === g.id &&
        machine.unlockLevel <= level &&
        Object.keys(recipe.inputs).every((id) => {
          const crop = content.cropList.find((c) => c.produce.id === id);
          return !crop || crop.unlockLevel <= level;
        }),
    );
    if (ok) out.push(g);
  }
  return out;
}

const REGULAR_LINES = ['Như mọi khi nhé cưng!', 'Hàng nhà bạn là nhất!', 'Để dành cho chị mấy món này nha.', 'Mai có khách, nhờ bạn nhé!', 'Lần trước ngon quá, cho thêm nữa!'];

/**
 * Chỉ thị 12 A4: index of the crop for an order line. With recentWeight 0 every crop is alike (as
 * before); otherwise newer crops weigh more, and Cúc Bông Gòn (the first crop) fades from daisyFadeFrom.
 */
function pickCrop(content: ContentPack, pool: CropDef[], level: number, roll: number): number {
  const cfg = content.orders;
  const k = cfg.recentWeight ?? 0;
  const first = content.cropList[0]?.id;
  const weights = pool.map((c) => {
    let w = 1 + k * Math.max(0, c.unlockLevel) / Math.max(1, level);
    if (c.id === first && cfg.daisyFadeFrom !== undefined && level >= cfg.daisyFadeFrom) w *= Math.max(0.1, 1 - (level - cfg.daisyFadeFrom + 1) * 0.15);
    return w;
  });
  const total = weights.reduce((a, w) => a + w, 0);
  let x = roll * total;
  for (let i = 0; i < weights.length; i++) if ((x -= weights[i]!) < 0) return i;
  return weights.length - 1;
}

export function generateOrder(content: ContentPack, state: GameState): Order {
  const cfg = content.orders;
  const id = ++state.orders.counter;
  const r = (...k: Array<string | number>) => randomFor(state.seed, 'order', id, ...k);
  const level = state.player.level;
  const crops = content.cropList.filter((c) => c.unlockLevel <= level);
  const lineCount = Math.min(crops.length, 1 + Math.floor(r('lines') * cfg.maxLines));
  const pool = [...crops];
  const items: Record<string, number> = {};
  let value = 0;
  // Chỉ thị 10 § 3.6 / 12 A4: with the Xưởng open, part of the orders carry a processed good.
  const goods = makeableGoods(content, level);
  const withGood = goods.length > 0 && r('goods') < (cfg.goodsShare ?? 0);
  for (let i = 0; i < lineCount; i++) {
    if (withGood && i === 0) {
      const g = goods[Math.floor(r('good') * goods.length)]!;
      const qty = 1 + Math.floor(r('goodQty') * 2);
      items[g.id] = qty;
      value += qty * g.sellPrice;
      continue;
    }
    const crop = pool.splice(pickCrop(content, pool, level, r('crop', i)), 1)[0]!;
    const qty = Math.max(1, Math.round(crop.yield * (1 + r('qty', i) * 2) * (1 + level * 0.05)));
    items[crop.produce.id] = qty;
    value += qty * crop.sellPrice;
  }
  const rare = level >= 3 && r('rare') < cfg.rareChance + houseBonus(content, state, 'balloon', 'rareShare');
  const [lo, hi] = cfg.rewardMultiplier;
  const mult = (lo + (hi - lo) * r('mult')) * (rare ? cfg.rareMultiplier : 1);
  // Named neighbours only (generated ones belong to one save; chỉ thị 12 B3).
  const bots = [...content.bots.keys()].filter((id) => !id.startsWith('gen:'));
  const extras = cfg.rareItems ?? [];
  // Chỉ thị 12 A4: a friendly neighbour (khách quen) sometimes places the order, with a line and a bonus.
  const friends = Object.keys(state.neighbors)
    .filter((b) => (state.neighbors[b]!.friendship ?? 0) >= (cfg.regularFriendship ?? Infinity))
    .sort();
  const regular = friends.length > 0 && r('regular') < (cfg.regularChance ?? 0) ? friends[Math.floor(r('regularWho') * friends.length)]! : null;
  const bonus = regular ? 1 + (cfg.regularBonus ?? 0) : 1;
  return {
    id,
    customer: regular ?? bots[Math.floor(r('customer') * bots.length)] ?? '',
    ...(regular ? { regular: REGULAR_LINES[Math.floor(r('regularLine') * REGULAR_LINES.length)]! } : {}),
    items,
    coins: Math.max(1, Math.round(value * mult * bonus)),
    xp: Math.max(1, Math.round(value * cfg.xpPerCoin * (rare ? 1.5 : 1))),
    gems: rare ? cfg.rareGems : 0,
    rare,
    ...(rare && extras.length > 0 ? { bonusItem: extras[Math.floor(r('bonusItem') * extras.length)]! } : {}),
  };
}

/** Order slots open at a level (6, more from the extraSlots levels). */
export function orderSlotsFor(content: ContentPack, level: number): number {
  let n = content.orders.slots;
  for (const e of content.orders.extraSlots ?? []) if (level >= e.level) n = Math.max(n, e.slots);
  return n;
}

export type OrderWorldEvent =
  | { type: 'balloonBack'; slot: number; coins: number; xp: number; gems: number; items: Record<string, number>; bird: string | null; customer: string; rare: boolean }
  | { type: 'rareOrderLeft'; slot: number }
  | { type: 'levelUp'; level: number };

/**
 * Time passing for the balloons: new slots open with the level, balloons that come back pay what they
 * carry (then bring a new order), rare orders past their time leave. Returns the slots that got an order.
 */
export function refillOrders(content: ContentPack, state: GameState, now: number, events: OrderWorldEvent[] = []): number[] {
  const want = orderSlotsFor(content, state.player.level) + houseBonus(content, state, 'balloon', 'orderSlots');
  while (state.orders.slots.length < want) state.orders.slots.push({ order: null, readyAt: now });
  const filled: number[] = [];
  state.orders.slots.forEach((slot, i) => {
    if (slot.order?.expiresAt !== undefined && slot.order.expiresAt <= now) {
      slot.order = null;
      slot.readyAt = Math.min(now, slot.readyAt);
      events.push({ type: 'rareOrderLeft', slot: i });
    }
    if (!slot.order && slot.readyAt <= now) {
      if (slot.flight) {
        const f = slot.flight;
        slot.flight = null;
        state.player.coins += f.coins;
        state.player.gems += f.gems;
        state.stats.coinsEarned += f.coins;
        for (const [id, q] of Object.entries(f.items)) addItem(state, id, q);
        events.push({ type: 'balloonBack', slot: i, ...f });
        for (const level of addXp(content, state, f.xp)) events.push({ type: 'levelUp', level });
      }
      slot.order = generateOrder(content, state);
      if (slot.order.rare && content.orders.rareHours) slot.order.expiresAt = now + content.orders.rareHours * HOUR;
      filled.push(i);
    }
  });
  return filled;
}

/** What an order still needs from the player's own stock (neighbours' help taken off). */
export function stillNeeded(order: Order): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, qty] of Object.entries(order.items)) {
    const left = qty - (order.given?.[id] ?? 0);
    if (left > 0) out[id] = left;
  }
  return out;
}

export function canDeliver(state: GameState, order: Order): boolean {
  return Object.entries(stillNeeded(order)).every(([id, qty]) => (state.inventory[id] ?? 0) >= qty);
}

/**
 * What the balloon will pay for an order when it comes back: the order's coins and XP, plus the
 * Xưởng machine star bonus for its goods (best machine among its lines), plus the escort's bonus.
 */
export function flightFor(content: ContentPack, state: GameState, order: Order, birdSpecies: string | null, now: number): OrderFlight {
  let bonusCoins = 0;
  // Bổ sung A6.5: an order carrying today's hot crop pays more coins.
  const hot = hotCrop(content, state, state.player.level, now);
  if (hot && order.items[hot.produce.id]) bonusCoins += content.cropExtras?.hot.orderBonus ?? 0;
  let bonusXp = 0;
  let machine = 0;
  for (const id of Object.keys(order.items)) {
    const g = content.goods?.get(id);
    if (g) machine = Math.max(machine, machineOrderBonus(content, state, g.machine));
  }
  bonusCoins += machine;
  bonusXp += machine;
  const escort = birdSpecies ? content.birds?.get(birdSpecies)?.escort : undefined;
  if (escort) {
    bonusCoins += escort.coins;
    bonusXp += escort.xp;
  }
  return {
    coins: Math.round(order.coins * (1 + bonusCoins)),
    xp: Math.round(order.xp * (1 + bonusXp)),
    gems: order.gems,
    items: order.bonusItem ? { [order.bonusItem]: 1 } : {},
    customer: order.customer,
    rare: order.rare,
    bird: birdSpecies,
  };
}

export type HelpResult = { botId: string; itemId: string; qty: number };

/**
 * "Nhờ hàng xóm góp hàng" (once a day): for each line still missing, the closest friend who can make
 * it may chip in the missing amount (chance grows with friendship). Deterministic per order and day.
 */
export function askNeighborsHelp(content: ContentPack, state: GameState, order: Order, now: number): HelpResult[] {
  const cfg = content.orders;
  const day = localDay(content, now);
  const friends = Object.entries(state.neighbors).sort((a, b) => b[1].friendship - a[1].friendship || (a[0] < b[0] ? -1 : 1));
  const out: HelpResult[] = [];
  for (const [itemId, need] of Object.entries(stillNeeded(order))) {
    const have = state.inventory[itemId] ?? 0;
    const missing = need - have;
    if (missing <= 0) continue;
    const crop = content.cropList.find((c) => c.produce.id === itemId);
    const good = content.goods?.get(itemId);
    const unlock = crop?.unlockLevel ?? (good ? (content.machines?.get(good.machine)?.unlockLevel ?? 1) : 1);
    for (const [botId, bot] of friends) {
      if (bot.level < unlock) continue;
      const chance = (cfg.helpChance ?? 0) + (cfg.helpFriendshipBonus ?? 0) * bot.friendship;
      if (randomFor(state.seed, 'orderHelp', order.id, day, botId, itemId) >= chance) continue;
      order.given = { ...order.given, [itemId]: (order.given?.[itemId] ?? 0) + missing };
      out.push({ botId, itemId, qty: missing });
      break;
    }
  }
  return out;
}
