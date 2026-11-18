// Chỉ thị 12 B1.1: Lộc Phiên — a small gift at the Đình up to 3 times a day, at least 2 hours apart,
// growing each time (coins → a free Sạp Săn Hàng reroll → an extra steal turn, or a gem when the
// turns are full). Meant to bring the player back 3 times a day without forcing it.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { localDay } from './missions.ts';
import { ensureBazaar } from './bazaar.ts';
import { stealTurns } from './social.ts';

const HOUR = 3_600_000;

export interface LuckStatus {
  /** Taken today. */
  count: number;
  perDay: number;
  /** When the next one can be taken (null: none left today). */
  nextAt: number | null;
}

export function luckStatus(content: ContentPack, state: GameState, now: number): LuckStatus | null {
  const r = content.village?.sessionLuck;
  if (!r) return null;
  const day = localDay(content, now);
  const l = state.sessionLuck;
  const count = l && l.day === day ? l.count : 0;
  if (count >= r.perDay) return { count, perDay: r.perDay, nextAt: null };
  const after = l && l.day === day ? l.at + r.gapHours * HOUR : now;
  return { count, perDay: r.perDay, nextAt: Math.max(now, after) };
}

export function luckReady(content: ContentPack, state: GameState, now: number): boolean {
  const s = luckStatus(content, state, now);
  return !!s && s.nextAt !== null && s.nextAt <= now;
}

export interface LuckGift {
  index: number;
  coins: number;
  gems: number;
  bazaarReroll: number;
  stealTurn: number;
}

export function claimLuck(content: ContentPack, state: GameState, now: number): LuckGift | 'not_ready' | 'locked' {
  const r = content.village?.sessionLuck;
  if (!r) return 'locked';
  if (!luckReady(content, state, now)) return 'not_ready';
  const day = localDay(content, now);
  const index = state.sessionLuck && state.sessionLuck.day === day ? state.sessionLuck.count : 0;
  const g = r.rewards[Math.min(index, r.rewards.length - 1)]!;
  state.sessionLuck = { day, count: index + 1, at: now };
  const coins = Math.round((g.coinsU ?? 0) * content.income.unit(state.player.level));
  state.player.coins += coins;
  state.stats.coinsEarned += coins;
  let gems = g.gems ?? 0;
  let bazaarReroll = 0;
  if (g.bazaarReroll) {
    if (ensureBazaar(content, state, now) || state.bazaar) {
      state.bazaar!.free = (state.bazaar!.free ?? 0) + g.bazaarReroll;
      bazaarReroll = g.bazaarReroll;
    } else gems += 1;
  }
  let stealTurn = 0;
  if (g.stealTurn) {
    const max = content.neighbors.steal?.turnsMax ?? 0;
    if (max > 0 && stealTurns(content, state, now) < max) {
      state.social.steal.tokens = Math.min(max, state.social.steal.tokens + g.stealTurn);
      stealTurn = g.stealTurn;
    } else gems += g.gemsIfFull ?? 0;
  }
  state.player.gems += gems;
  return { index, coins, gems, bazaarReroll, stealTurn };
}
