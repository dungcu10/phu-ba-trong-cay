// Chỉ thị 12 B3: Phú Bà động — about 60 neighbours around the player, growing with the player.
//
// - The named neighbours of neighbors.json stay; the ones marked `famous` (8, Bà Tám among them)
//   never leave. Others who have had nothing to do with the player (friendship 0, not an enemy, not
//   in the player's league group) for `moveOutDays` may "move house" (a few a day) and a new
//   neighbour moves in, so there are always `town.target` neighbours.
// - New neighbours are generated from the save seed and a counter (gen:<seed>:<n>): a name made of a
//   form of address, a name and a nickname, a random personality and favourite crop family; the
//   picture comes from avatar.ts (by id). The definition is rebuilt from the id, so the save only
//   keeps the counter and the neighbour's own state.
// - Levels follow the player: each day a neighbour below its own spot in its band (player −4 … +6,
//   the 3 "đại gia" +8 … +12) is lifted (a third of the gap, at least one level) with its garden value;
//   one above the band drifts back (level and wealth) a little each day.
//
// Generated definitions are registered in content.bots (the map every system reads), keyed by the
// save seed, so all the existing rules apply to them unchanged.

import type { BotDef, ContentPack } from '../core/content.ts';
import type { BotState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';
import { isEnemy } from './social.ts';

export const GEN_PREFIX = 'gen:';

export function isGenerated(id: string): boolean {
  return id.startsWith(GEN_PREFIX);
}

/** The definition of generated neighbour n of a save (deterministic). */
export function genBotDef(content: ContentPack, seed: number, n: number): BotDef {
  const t = content.neighbors.town!;
  const r = (k: string) => randomFor(seed, 'genBot', n, k);
  const pick = <T>(list: T[], k: string): T => list[Math.floor(r(k) * list.length)]!;
  const families = [...new Set(content.cropList.map((c) => c.family))].sort();
  const name = `${pick(t.forms, 'form')} ${pick(t.names, 'name')} ${pick(t.nicknames, 'nick')}`;
  return {
    id: `${GEN_PREFIX}${seed}:${n}`,
    name: { vi: name },
    title: { vi: pick(t.titles, 'title') },
    portrait: 'gen',
    traits: { diligence: 0.3 + 0.6 * r('dil'), trader: 0.2 + 0.7 * r('trade'), collector: 0.1 + 0.8 * r('col') },
    likes: pick(families, 'likes'),
    startLevel: 1,
    startCoins: 0,
  };
}

/** Puts the definitions of a save's generated neighbours in content.bots (idempotent). */
export function registerTown(content: ContentPack, state: GameState): void {
  for (const id of Object.keys(state.neighbors)) {
    if (!isGenerated(id) || content.bots.has(id)) continue;
    const n = Number(id.slice(id.lastIndexOf(':') + 1));
    if (Number.isInteger(n)) content.bots.set(id, genBotDef(content, state.seed, n));
  }
}

/** The neighbours of this save, named first (content order), then generated (by number). */
export function townBots(content: ContentPack, state: GameState): BotDef[] {
  const named = [...content.bots.values()].filter((b) => !isGenerated(b.id) && state.neighbors[b.id]);
  const gen = Object.keys(state.neighbors)
    .filter(isGenerated)
    .sort((a, b) => Number(a.slice(a.lastIndexOf(':') + 1)) - Number(b.slice(b.lastIndexOf(':') + 1)))
    .map((id) => content.bots.get(id))
    .filter((b): b is BotDef => !!b);
  return [...named, ...gen];
}

/** The 3 "đại gia" (ahead of the player): fixed per save, among the neighbours present. */
export function isTycoon(content: ContentPack, state: GameState, id: string): boolean {
  const t = content.neighbors.town;
  if (!t) return false;
  const ids = townBots(content, state)
    .map((b) => b.id)
    .sort((a, b) => randomFor(state.seed, 'tycoon', a) - randomFor(state.seed, 'tycoon', b));
  return ids.slice(0, t.tycoons).includes(id);
}

/** Level band of a neighbour for a player level. */
export function levelBand(content: ContentPack, state: GameState, id: string): [number, number] {
  const t = content.neighbors.town!;
  const p = state.player.level;
  const [lo, hi] = isTycoon(content, state, id) ? t.tycoonBand : t.band;
  return [Math.max(1, p + lo), Math.max(1, p + hi)];
}

function newBotState(content: ContentPack, state: GameState, def: BotDef, now: number): BotState {
  const [lo, hi] = levelBand(content, state, def.id);
  const level = lo + Math.floor(randomFor(state.seed, 'genLevel', def.id) * (hi - lo + 1));
  const value = Math.round(content.income.unit(level) * (8 + 8 * def.traits.diligence));
  return { level, xp: 0, coins: Math.round(value / 2), gardenValue: value, friendship: 0, simulatedTo: now, lastAction: null, help: { day: -1, pots: [] }, stall: [], birds: [], bugs: {} };
}

/**
 * Adds generated neighbours until there are `target` (new games and old saves alike). They have lived
 * since `since` (the start of the save, or the start of the day they move in), so the result does not
 * depend on when the game happened to be opened.
 */
export function fillTown(content: ContentPack, state: GameState, now: number, since = now): string[] {
  const t = content.neighbors.town;
  if (!t) return [];
  registerTown(content, state);
  const added: string[] = [];
  while (Object.keys(state.neighbors).length < t.target) {
    const def = genBotDef(content, state.seed, state.town.next++);
    content.bots.set(def.id, def);
    state.neighbors[def.id] = newBotState(content, state, def, Math.min(now, since));
    added.push(def.id);
  }
  return added;
}

/**
 * Once a day: neighbours follow the player's level (one step a day), and a few who have had nothing
 * to do with the player move house and are replaced. Returns who left and who came.
 */
export function townDaily(content: ContentPack, state: GameState, now: number): { left: string[]; came: string[] } {
  const t = content.neighbors.town;
  const out = { left: [] as string[], came: [] as string[] };
  if (!t) return out;
  registerTown(content, state);
  const day = localDay(content, now);
  if (state.town.day === day) return out;
  const first = state.town.day < 0;
  state.town.day = day;
  for (const def of townBots(content, state)) {
    const s = state.neighbors[def.id]!;
    const [lo, hi] = levelBand(content, state, def.id);
    // Each neighbour has its own place in the band (so the board is spread, not bunched at the edge),
    // and catches up a third of the gap a day (at least one level).
    const target = lo + Math.floor(randomFor(state.seed, 'bandSpot', def.id) * (hi - lo + 1));
    if (s.level < target) {
      s.level += Math.max(1, Math.ceil((target - s.level) / 3));
      s.xp = 0;
      s.gardenValue = Math.max(s.gardenValue, Math.round(content.income.unit(s.level) * (8 + 8 * def.traits.diligence)));
    } else if (s.level > hi) {
      // Far ahead of the band (e.g. a named neighbour who started high): drifts back a little each day
      // (level and wealth), so the board stays a close race.
      const drop = Math.max(1, Math.ceil((s.level - hi) / 4));
      s.level -= drop;
      s.xp = 0;
      const k = Math.pow(0.88, drop);
      s.coins = Math.round(s.coins * k);
      s.gardenValue = Math.round(s.gardenValue * k);
    }
  }
  const dayStart = (day * 86_400_000) - content.missions.utcOffsetHours * 3_600_000;
  if (first) {
    out.came = fillTown(content, state, now, Math.max(state.createdAt || dayStart, now - content.neighbors.catchUpDays * 86_400_000));
    return out;
  }
  const group = new Set(state.league.group);
  const quiet = townBots(content, state).filter((b) => {
    const s = state.neighbors[b.id]!;
    return !t.famous.includes(b.id) && s.friendship <= 0 && !isEnemy(state, b.id, now) && !group.has(b.id) && s.stall.length === 0;
  });
  for (const b of quiet) {
    if (out.left.length >= t.moveOutPerDay) break;
    if (randomFor(state.seed, 'moveOut', b.id, day) >= 1 / t.moveOutDays) continue;
    delete state.neighbors[b.id];
    if (!isGenerated(b.id)) state.town.movedOut.push(b.id);
    out.left.push(b.id);
  }
  out.came = fillTown(content, state, now, dayStart);
  return out;
}
