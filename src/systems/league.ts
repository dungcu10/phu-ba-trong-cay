// Chỉ thị 12 B3: Giải Phú Bà theo tuần. The player plays in a group of 30 (29 neighbours) of the same
// tier; points come from coins earned (in units of the player's level income U, so a week means the
// same at every level), orders delivered, gardens helped and gardens stolen from. At the end of the
// week (Monday 00:00 local) the top `promote` go up a tier, the last `demote` go down, and everyone
// gets the reward of their tier and place. Five tiers: Đồng → Bạc → Vàng → Ngọc → Phú Bà Huyền Thoại.
//
// Neighbours' weekly points are drawn, not simulated: each neighbour of the group has a pace for the
// week around the tier's median (league.tiers[t].medianPerDay), with a little noise each day, so the
// race is close at every tier. Deterministic from the save seed, the week and the neighbour.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';
import { addItem } from './economy.ts';
import { townBots } from './town.ts';

const DAY = 86_400_000;

/** Week number (weeks start on Monday, local time). */
export function weekOf(content: ContentPack, now: number): number {
  return Math.floor((localDay(content, now) + 3) / 7);
}

/** Start of a week (local Monday 00:00) in game time. */
export function weekStart(content: ContentPack, week: number): number {
  return (week * 7 - 3) * DAY - content.missions.utcOffsetHours * 3_600_000;
}

/** The player's points this week so far. */
export function playerPoints(content: ContentPack, state: GameState): number {
  const L = content.neighbors.league;
  if (!L) return 0;
  const g = state.league;
  const coins = Math.max(0, state.stats.coinsEarned - g.base.coins) / Math.max(1, content.income.unit(state.player.level));
  const orders = Math.max(0, state.stats.ordersDone - g.base.orders);
  return Math.round(coins * L.points.perU + orders * L.points.order + g.helps * L.points.help + g.steals * L.points.steal);
}

/** A neighbour's points this week at time `at` (paced, noisy per day, never down). */
export function botPoints(content: ContentPack, state: GameState, botId: string, at: number): number {
  const L = content.neighbors.league;
  if (!L) return 0;
  const g = state.league;
  const median = L.tiers[g.tier]?.medianPerDay ?? 0;
  const [lo, hi] = L.pace;
  const pace = lo + (hi - lo) * randomFor(state.seed, 'leaguePace', g.week, botId);
  const days = Math.min(7, Math.max(0, (at - weekStart(content, g.week)) / DAY));
  let total = 0;
  for (let d = 0; d < Math.ceil(days); d++) {
    const part = Math.min(1, days - d);
    total += median * pace * (0.7 + 0.6 * randomFor(state.seed, 'leagueDay', g.week, botId, d)) * part;
  }
  return Math.round(total);
}

export interface LeagueRow {
  id: string;
  points: number;
  rank: number;
}

/** The group's table now (the player's id is ''). */
export function leagueTable(content: ContentPack, state: GameState, at: number): LeagueRow[] {
  const rows = [{ id: '', points: playerPoints(content, state) }, ...state.league.group.map((id) => ({ id, points: botPoints(content, state, id, at) }))];
  return rows.sort((a, b) => b.points - a.points || (a.id === '' ? -1 : b.id === '' ? 1 : a.id.localeCompare(b.id))).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Picks the 29 neighbours of a new week's group (deterministic shuffle of the town). */
function formGroup(content: ContentPack, state: GameState, week: number): string[] {
  const L = content.neighbors.league!;
  return townBots(content, state)
    .map((b) => b.id)
    .sort((a, b) => randomFor(state.seed, 'leagueGroup', week, a) - randomFor(state.seed, 'leagueGroup', week, b))
    .slice(0, L.groupSize - 1);
}

export interface LeagueResult {
  week: number;
  points: number;
  tier: number;
  rank: number;
  newTier: number;
  coins: number;
  gems: number;
  items: Record<string, number>;
  pot: string | null;
}

/**
 * At a new week: settles the last one (place, up/down, reward) and opens the new group.
 * `grantPot` gives a pot reward through the player's own pot rules (duplicates become shards).
 */
export function settleLeague(content: ContentPack, state: GameState, now: number, grantPot: (potId: string) => void): LeagueResult | null {
  const L = content.neighbors.league;
  if (!L || state.player.level < L.unlockLevel) return null;
  const week = weekOf(content, now);
  const g = state.league;
  if (g.week === week) return null;
  let result: LeagueResult | null = null;
  if (g.week >= 0 && g.group.length > 0) {
    const end = weekStart(content, g.week + 1);
    const table = leagueTable(content, state, end);
    const me = table.find((r) => r.id === '')!;
    const rank = me.rank;
    const size = table.length;
    const up = rank <= L.promote && g.tier < L.tiers.length - 1;
    const down = rank > size - L.demote && g.tier > 0;
    const tier = L.tiers[g.tier]!;
    const top = rank <= L.promote;
    const reward = top ? tier.top : rank > size - L.demote ? tier.bottom : tier.middle;
    const coins = Math.round((reward.coinsU ?? 0) * content.income.unit(state.player.level));
    state.player.coins += coins;
    state.stats.coinsEarned += coins;
    state.player.gems += reward.gems ?? 0;
    for (const [id, q] of Object.entries(reward.items ?? {})) addItem(state, id, q);
    if (reward.pot) grantPot(reward.pot);
    const newTier = g.tier + (up ? 1 : down ? -1 : 0);
    result = { week: g.week, points: me.points, tier: g.tier, rank, newTier, coins, gems: reward.gems ?? 0, items: reward.items ?? {}, pot: reward.pot ?? null };
    g.tier = newTier;
    g.last = result;
  }
  g.week = week;
  g.group = formGroup(content, state, week);
  g.base = { coins: state.stats.coinsEarned, orders: state.stats.ordersDone };
  g.helps = 0;
  g.steals = 0;
  return result;
}
