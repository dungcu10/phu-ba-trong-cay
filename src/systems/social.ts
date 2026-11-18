// Chỉ thị 12 B4/B5: what you do in a neighbour's garden — steal a few ripe crops, catch their bugs
// (the bug is yours), water — and what neighbours do to yours while the game is closed.
//
// Extends the existing visit (visit.ts botGarden: the neighbour's pots are derived, not simulated),
// with the same deterministic randomness (randomFor on the save seed), so nothing depends on timing.
//
// Rules (numbers in neighbors.json › steal / botSteal / friendMilestones):
// - Steal turns: turnsMax, one back every regenHours (kept while away). Only ripe pots; one steal per
//   pot a day (footprints); 1–2 produce and no more than maxShare of the pot's yield.
// - Caught: a guarded garden (the neighbour's pet at home) or a strict neighbour catches you 20–35 %
//   of the time; your walked Cáo Lửa Con lowers it. Caught = the turn is lost, nothing else.
// - Rare finds: mutationChance for a Vàng / Ngọc produce, seedChance for a seed of a crop above the
//   player's level (a trial seed: one planting).
// - Enemies: a neighbour who stole from you is an enemy for enemyHours; stealing back costs no turn,
//   is never caught and gives enemyMultiplier ×. Catching bugs for an enemy gives nothing.
// - Streak: `streak` successful steals in different gardens in a row → the next one is doubled and
//   surely a mutation (Cú Đúp).
// - Neighbours steal from you only while the game is closed (gaps longer than awayMinutes), at most
//   perDay times a day, `share` of one ripe pot, never mutations, never friends (friendlyAt); the
//   Mèo Mây Con walked on that floor halves the chance.

import type { BotDef, ContentPack, CropDef } from '../core/content.ts';
import type { BotState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';
import { botGarden, type VisitPot } from './visit.ts';
import { activeSkill, petOf, petWorking } from './pets.ts';
import { cropStatus, isNight } from './growth.ts';
import { addItem, storageFree } from './economy.ts';

const HOUR = 3_600_000;

/** Settles turn regeneration; returns the turns available now. */
export function stealTurns(content: ContentPack, state: GameState, now: number): number {
  const r = content.neighbors.steal;
  if (!r) return 0;
  const st = state.social.steal;
  const step = r.regenHours * HOUR;
  if (st.tokens >= r.turnsMax) st.at = now;
  else if (now > st.at) {
    const gained = Math.floor((now - st.at) / step);
    st.tokens = Math.min(r.turnsMax, st.tokens + gained);
    st.at = st.tokens >= r.turnsMax ? now : st.at + gained * step;
  }
  return st.tokens;
}

/** When the next steal turn comes back (null when full). */
export function nextStealTurnAt(content: ContentPack, state: GameState, now: number): number | null {
  const r = content.neighbors.steal;
  if (!r || stealTurns(content, state, now) >= r.turnsMax) return null;
  return state.social.steal.at + r.regenHours * HOUR;
}

export function isEnemy(state: GameState, botId: string, now: number): boolean {
  return (state.social.enemies[botId] ?? 0) > now;
}

/** Pot keys stolen today in a neighbour's garden (footprints). */
export function stolenToday(content: ContentPack, state: GameState, botId: string, now: number): Set<string> {
  const st = state.social.steal;
  return new Set(st.day === localDay(content, now) ? (st.pots[botId] ?? []) : []);
}

/** Chance of being caught in this garden (0 when stealing back from an enemy). */
export function catchChance(content: ContentPack, state: GameState, botId: string, now: number): number {
  const r = content.neighbors.steal;
  const def = content.bots.get(botId);
  const bot = state.neighbors[botId];
  if (!r || !def || !bot || isEnemy(state, botId, now)) return 0;
  const guarded = (bot.pets ?? []).some((p) => (p.awayUntil ?? 0) <= now && petWorking(content, { ...p, active: true }, now));
  const strict = def.traits.diligence >= r.strictDiligence;
  const base = guarded && strict ? r.bothCatch : guarded ? r.guardCatch : strict ? r.strictCatch : 0;
  if (base <= 0) return 0;
  const fox = activeSkill(content, state, 'pounce', now) ? r.foxReduce : 0;
  return Math.max(0, base - fox);
}

/** Helps left today (water or catch a bug, all gardens together). */
export function helpsLeftToday(content: ContentPack, state: GameState, now: number): number {
  const per = content.neighbors.help.perDay ?? Infinity;
  const h = state.social.help;
  return Math.max(0, per - (h.day === localDay(content, now) ? h.used : 0));
}

export function useHelp(content: ContentPack, state: GameState, now: number): void {
  const day = localDay(content, now);
  const h = state.social.help;
  if (h.day !== day) state.social.help = { day, used: 0 };
  state.social.help.used += 1;
}

/** The bug on a neighbour's pot (from that crop's own bug list, at the neighbour's level; night bugs at night). */
export function visitBug(content: ContentPack, state: GameState, botId: string, pot: VisitPot, now: number): string {
  const bot = state.neighbors[botId];
  const night = isNight(content, now);
  const pool = pot.crop.bugs.map((b) => ({ def: content.bugs.get(b.id), w: b.weight })).filter((x) => x.def && x.def.unlockLevel <= (bot?.level ?? 1) && (!x.def.nightOnly || night));
  if (pool.length === 0) return content.bugList[0]!.id;
  const total = pool.reduce((a, x) => a + x.w, 0);
  let r = randomFor(state.seed, 'visitBug', botId, pot.key, localDay(content, now)) * total;
  for (const x of pool) if ((r -= x.w) < 0) return x.def!.id;
  return pool.at(-1)!.def!.id;
}

/** "Vườn này đang có: Châu Chấu Sương ×3" — the bugs waiting in a neighbour's garden now. */
export function gardenBugs(content: ContentPack, state: GameState, botId: string, now: number): Array<{ bugId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const f of botGarden(content, state, botId, now)) for (const p of f.pots) if (p.need === 'bug') counts.set(visitBug(content, state, botId, p, now), (counts.get(visitBug(content, state, botId, p, now)) ?? 0) + 1);
  return [...counts].map(([bugId, count]) => ({ bugId, count })).sort((a, b) => b.count - a.count);
}

export interface StealResult {
  caught: boolean;
  itemId: string | null;
  qty: number;
  mutation: string | null;
  seed: string | null;
  enemy: boolean;
  double: boolean;
}

/** A crop above the player's level to find a seed of: the next ones up (up to 10 levels higher). */
function trialSeedCrop(content: ContentPack, state: GameState, r: number): CropDef | null {
  const lv = state.player.level;
  const list = content.cropList.filter((c) => c.unlockLevel > lv && c.unlockLevel <= lv + 10);
  return list.length ? list[Math.floor(r * list.length)]! : null;
}

/** Steals from one ripe pot of a neighbour. Errors are strings (no change made). */
export function steal(content: ContentPack, state: GameState, botId: string, floor: number, slot: number, now: number): StealResult | string {
  const r = content.neighbors.steal;
  const bot = state.neighbors[botId];
  if (!r) return 'not_available';
  if (!bot || !content.bots.has(botId)) return 'unknown_neighbor';
  const pot = botGarden(content, state, botId, now)[floor]?.pots[slot];
  if (!pot) return 'bad_slot';
  if (!pot.ripe) return 'not_ripe';
  if (stolenToday(content, state, botId, now).has(pot.key)) return 'already_stolen';
  const enemy = isEnemy(state, botId, now);
  if (!enemy && stealTurns(content, state, now) < 1) return 'no_steal_turns';
  const st = state.social.steal;
  const day = localDay(content, now);
  if (st.day !== day) ((st.day = day), (st.pots = {}));
  const key = (k: string) => randomFor(state.seed, k, botId, pot.key, day, state.nextId);
  // Quantity first (to check room in storage before anything is used).
  const cap = Math.max(1, Math.floor(pot.crop.yield * r.maxShare));
  const base = Math.min(cap, r.takeMin + Math.floor(key('stealQty') * (r.takeMax - r.takeMin + 1)));
  const double = !enemy && st.double;
  const qty = base * (enemy ? r.enemyMultiplier : 1) * (double ? 2 : 1);
  if (storageFree(content, state) < qty) return 'storage_full';
  if (!enemy) st.tokens -= 1;
  state.nextId += 1;
  // Caught: the turn is lost, nothing else (never on an enemy's garden).
  if (!enemy && key('stealCaught') < catchChance(content, state, botId, now)) {
    st.streak = [];
    return { caught: true, itemId: null, qty: 0, mutation: null, seed: null, enemy, double: false };
  }
  (st.pots[botId] ??= []).push(pot.key);
  const muts = content.surprises.mutations ?? [];
  let mutation: string | null = null;
  if (muts.length && (double || key('stealMut') < r.mutationChance)) mutation = (key('stealJade') < r.jadeShare ? muts.find((m) => m.id === 'jade') : null)?.id ?? muts[0]!.id;
  const produce = pot.crop.produce;
  const itemId = mutation && content.items.has(`${produce.id}~${mutation}`) ? `${produce.id}~${mutation}` : produce.id;
  addItem(state, itemId, qty);
  let seed: string | null = null;
  if (key('stealSeed') < r.seedChance) {
    const c = trialSeedCrop(content, state, key('stealSeedKind'));
    if (c) ((seed = c.id), (state.social.trialSeeds[c.id] = (state.social.trialSeeds[c.id] ?? 0) + 1));
  }
  // Streak of different gardens without being caught → Cú Đúp on the next steal.
  if (double) st.double = false;
  else if (!enemy) {
    if (!st.streak.includes(botId)) st.streak.push(botId);
    if (st.streak.length >= r.streak) ((st.double = true), (st.streak = []));
  }
  return { caught: false, itemId, qty, mutation, seed, enemy, double };
}

/** Friendship gifts at 3, 6, 10 (once each). Returns the gifts given now. */
export function friendGifts(content: ContentPack, state: GameState, botId: string): Array<{ at: number; coins: number; items: Record<string, number> }> {
  const bot = state.neighbors[botId];
  const marks = content.neighbors.friendMilestones ?? [];
  const out: Array<{ at: number; coins: number; items: Record<string, number> }> = [];
  if (!bot) return out;
  let n = bot.friendGifts ?? 0;
  while (n < marks.length && bot.friendship >= marks[n]!.at) {
    const m = marks[n]!;
    const coins = Math.round(m.coinsU * content.income.unit(state.player.level));
    state.player.coins += coins;
    state.stats.coinsEarned += coins;
    for (const [id, q] of Object.entries(m.items ?? {})) addItem(state, id, q);
    out.push({ at: m.at, coins, items: m.items ?? {} });
    n += 1;
  }
  bot.friendGifts = n;
  return out;
}

/**
 * Neighbours visit while the game is closed (§ B4.2.3): for each whole hour of the gap (after the
 * first awayMinutes, at most maxHours), one neighbour may take `share` of a pot that is ripe at that
 * hour. Never while playing, never more than perDay a day, never a friend, never a mutation; the
 * Mèo Mây Con walked on the pot's floor halves the chance. The thief becomes an enemy.
 */
export function stealWhileAway(content: ContentPack, state: GameState, from: number, to: number): Array<{ botId: string; itemId: string; qty: number; at: number }> {
  const r = content.neighbors.botSteal;
  const sr = content.neighbors.steal;
  if (!r || !sr || to - from < r.awayMinutes * 60_000) return [];
  const start = Math.max(from + r.awayMinutes * 60_000, to - r.maxHours * HOUR);
  const thieves = [...content.bots.values()].filter((b) => (state.neighbors[b.id]?.friendship ?? 0) < r.friendlyAt && (state.neighbors[b.id]?.level ?? 0) >= 4);
  if (thieves.length === 0) return [];
  const out: Array<{ botId: string; itemId: string; qty: number; at: number }> = [];
  const tk = state.social.taken;
  for (let at = Math.ceil(start / HOUR) * HOUR; at <= to; at += HOUR) {
    const day = localDay(content, at);
    if (tk.day !== day) ((tk.day = day), (tk.count = 0));
    if (tk.count >= r.perDay) continue;
    if (randomFor(state.seed, 'botSteal', at) >= r.chancePerHour) continue;
    // A ripe pot at that hour, chosen deterministically; skip pots already taken from this cycle.
    const ripe: Array<{ f: number; i: number }> = [];
    state.floors.forEach((fl, f) =>
      fl.slots.forEach((s, i) => {
        if (s.planting && !(s.planting.stolen ?? 0) && cropStatus(content, state, s, at)?.ripe) ripe.push({ f, i });
      }),
    );
    if (ripe.length === 0) continue;
    const pick = ripe[Math.floor(randomFor(state.seed, 'botStealPot', at) * ripe.length)]!;
    const kitten = petOf(state, 'pet.cloud-kitten');
    if (kitten && kitten.floor === pick.f && petWorking(content, kitten, at) && randomFor(state.seed, 'botStealCat', at) < r.kittenReduce) continue;
    const slot = state.floors[pick.f]!.slots[pick.i]!;
    const crop = content.crops.get(slot.planting!.cropId)!;
    const qty = Math.max(1, Math.floor(crop.yield * r.share));
    if (crop.yield - qty < 1) continue;
    const thief: BotDef = thieves[Math.floor(randomFor(state.seed, 'botStealWho', at) * thieves.length)]!;
    slot.planting!.stolen = qty;
    tk.count += 1;
    state.social.enemies[thief.id] = at + sr.enemyHours * HOUR;
    const e = { botId: thief.id, itemId: crop.produce.id, qty, at };
    tk.log.push(e);
    if (tk.log.length > 20) tk.log.splice(0, tk.log.length - 20);
    out.push(e);
  }
  return out;
}

/** The neighbour's record, for typing. */
export type Neighbour = BotState;
