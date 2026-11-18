// Chỉ thị 10 § 3.9: fishing from the cloud's edge (chỉ thị 11: at the Bến Câu Cá in the village;
// same window). One free bait a day; more bait is made from produce and jam. Casting uses one bait
// and fixes which fish bites from the save's seed and a cast counter (deterministic). The reel
// mini-game (keep the tension mark in the green zone) is played in the window; its result is sent
// as reelFish {success}. A landed fish goes to the Túi Nguyên Liệu and adds Sổ Cá points; fish are
// traded for coins, Giọt Sương or a rare bug. Sổ Cá milestones pay once each.

import type { ContentPack, FishDef } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';
import { addItem, removeItem } from './economy.ts';

export type FishingError = 'casts_used' | 'locked' | 'no_bait' | 'not_enough_items' | 'already_claimed' | 'line_busy' | 'nothing_hooked' | 'bad_option' | 'nothing_to_claim' | 'unknown_item';

export function fishingOpen(content: ContentPack, state: GameState): boolean {
  return !!content.fishing && state.player.level >= content.fishing.unlockLevel;
}

export function freeBaitReady(content: ContentPack, state: GameState, now: number): boolean {
  return fishingOpen(content, state) && state.fishing.freeBaitDay !== localDay(content, now);
}

export function claimFreeBait(content: ContentPack, state: GameState, now: number): FishingError | { itemId: string; qty: number } {
  if (!fishingOpen(content, state)) return 'locked';
  if (!freeBaitReady(content, state, now)) return 'already_claimed';
  state.fishing.freeBaitDay = localDay(content, now);
  const itemId = content.fishing!.baits[0]!.item;
  const qty = content.fishing!.freeBaitPerDay;
  addItem(state, itemId, qty);
  return { itemId, qty };
}

/** The first recipe of this bait the player can afford (index), or -1. */
export function affordableRecipe(content: ContentPack, state: GameState, baitItem: string): number {
  const b = content.fishing?.baits.find((x) => x.item === baitItem);
  if (!b) return -1;
  return b.recipes.findIndex((r) => Object.entries(r).every(([id, q]) => (state.inventory[id] ?? 0) >= q));
}

export function craftBait(content: ContentPack, state: GameState, baitItem: string): FishingError | { itemId: string } {
  if (!fishingOpen(content, state)) return 'locked';
  const b = content.fishing!.baits.find((x) => x.item === baitItem);
  if (!b) return 'unknown_item';
  const i = affordableRecipe(content, state, baitItem);
  if (i < 0) return 'not_enough_items';
  for (const [id, q] of Object.entries(b.recipes[i]!)) removeItem(state, id, q);
  addItem(state, baitItem, 1);
  return { itemId: baitItem };
}

/** Casts left today (null = no limit). */
export function castsLeft(content: ContentPack, state: GameState, now: number): number | null {
  const max = content.fishing?.castsPerDay ?? 0;
  if (!(max > 0)) return null;
  const used = state.fishing.castDay === localDay(content, now) ? (state.fishing.castsToday ?? 0) : 0;
  return Math.max(0, max - used);
}

/** Casts with one bait; the fish that bites is fixed now. */
export function castLine(content: ContentPack, state: GameState, baitItem: string, now = state.maxSeenAt): FishingError | { fish: FishDef } {
  if (!fishingOpen(content, state)) return 'locked';
  const fr = content.fishing!;
  const b = fr.baits.find((x) => x.item === baitItem);
  if (!b) return 'unknown_item';
  if (state.fishing.hooked) return 'line_busy';
  if ((state.inventory[baitItem] ?? 0) < 1) return 'no_bait';
  const left = castsLeft(content, state, now);
  if (left !== null && left <= 0) return 'casts_used';
  if (left !== null) {
    const day = localDay(content, now);
    state.fishing.castsToday = state.fishing.castDay === day ? (state.fishing.castsToday ?? 0) + 1 : 1;
    state.fishing.castDay = day;
  }
  removeItem(state, baitItem, 1);
  const n = (state.fishing.casts ?? 0) + 1;
  state.fishing.casts = n;
  const total = b.weights.reduce((a, w) => a + w, 0);
  let x = randomFor(state.seed, 'fish', n) * total;
  let i = 0;
  while (i < b.weights.length - 1 && x >= b.weights[i]!) x -= b.weights[i++]!;
  const fish = fr.fish[i]!;
  state.fishing.hooked = { fishId: fish.id, bait: baitItem };
  return { fish };
}

/** Ends the reel: a landed fish goes to the bag and the Sổ Cá; a lost one swims off (the bait is spent). */
export function reelFish(content: ContentPack, state: GameState, success: boolean, now: number): FishingError | { fishId: string; landed: boolean; first: boolean } {
  const hk = state.fishing.hooked;
  if (!hk) return 'nothing_hooked';
  state.fishing.hooked = null;
  if (!success) return { fishId: hk.fishId, landed: false, first: false };
  addItem(state, hk.fishId, 1);
  const book = state.collections.fish;
  const first = !book[hk.fishId];
  book[hk.fishId] = { firstAt: book[hk.fishId]?.firstAt ?? now, count: (book[hk.fishId]?.count ?? 0) + 1 };
  return { fishId: hk.fishId, landed: true, first };
}

/** Sổ Cá points: every fish landed counts its points. */
export function fishBookPoints(content: ContentPack, state: GameState): number {
  let p = 0;
  for (const [id, e] of Object.entries(state.collections.fish)) p += (content.fish.get(id)?.points ?? 0) * e.count;
  return p;
}

const bookKey = (i: number) => `fishbook:${i}`;

/** Index of the next Sổ Cá milestone not yet claimed, or -1 when all are. */
export function nextFishMilestone(content: ContentPack, state: GameState): number {
  const book = content.fishing?.book ?? [];
  return book.findIndex((_, i) => !state.collections.claimed.includes(bookKey(i)));
}

export function claimFishBook(content: ContentPack, state: GameState): FishingError | { index: number; gems: number; items: Record<string, number> } {
  const i = nextFishMilestone(content, state);
  const m = i >= 0 ? content.fishing!.book[i]! : null;
  if (!m || fishBookPoints(content, state) < m.points) return 'nothing_to_claim';
  state.collections.claimed.push(bookKey(i));
  state.player.gems += m.gems ?? 0;
  for (const [id, q] of Object.entries(m.items ?? {})) addItem(state, id, q);
  return { index: i, gems: m.gems ?? 0, items: m.items ?? {} };
}

/** Trades one fish for one of its exchange options. */
export function exchangeFish(content: ContentPack, state: GameState, fishId: string, option: number): FishingError | { coins: number; items: Record<string, number> } {
  const f = content.fish.get(fishId);
  if (!f) return 'unknown_item';
  const ex = f.exchange[option];
  if (!ex) return 'bad_option';
  if ((state.inventory[fishId] ?? 0) < 1) return 'not_enough_items';
  removeItem(state, fishId, 1);
  const items: Record<string, number> = { ...(ex.items ?? {}) };
  if (ex.bug) {
    const bugs = content.bugList.filter((b) => b.rarity === ex.bug).sort((a, b) => a.id.localeCompare(b.id));
    const n = (state.fishing.casts ?? 0) + (state.collections.fish[fishId]?.count ?? 0);
    const bug = bugs[Math.floor(randomFor(state.seed, 'fishBug', fishId, n, state.inventory[fishId] ?? 0) * bugs.length)];
    if (bug) items[bug.id] = (items[bug.id] ?? 0) + (ex.qty ?? 1);
  }
  for (const [id, q] of Object.entries(items)) addItem(state, id, q);
  const coins = ex.coins ?? 0;
  state.player.coins += coins;
  state.stats.coinsEarned += coins;
  return { coins, items };
}
