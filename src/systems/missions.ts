// Daily missions (REDESIGN_V2 4): three per local day, progress counted from command events.

import type { ContentPack, MissionDef, MissionKind } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import type { GameEvent } from '../core/game.ts';
import { randomFor } from '../core/rng.ts';

const DAY_MS = 86_400_000;

/** Local day number (days since 1970 at the configured UTC offset). */
export function localDay(content: ContentPack, now: number): number {
  return Math.floor((now + content.missions.utcOffsetHours * 3_600_000) / DAY_MS);
}

/** Game time when the current local day ends. */
export function dayEndsAt(content: ContentPack, now: number): number {
  return (localDay(content, now) + 1) * DAY_MS - content.missions.utcOffsetHours * 3_600_000;
}

/** Rolls today's missions if the day changed. Returns true when a new set was rolled. */
export function ensureMissions(content: ContentPack, state: GameState, now: number): boolean {
  const day = localDay(content, now);
  if (state.missions.day === day) return false;
  const pool = content.missions.pool.filter((m) => m.minLevel <= state.player.level);
  // Weighted shuffle without replacement, deterministic per (save, day).
  const picked = pool
    .map((m) => ({ m, k: randomFor(state.seed, 'mission', day, m.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, content.missions.perDay)
    .map(({ m }) => ({ id: m.id, progress: 0, claimed: false }));
  state.missions = { day, list: picked, bonusClaimed: false };
  return true;
}

export function missionDef(content: ContentPack, id: string): MissionDef | undefined {
  return content.missions.pool.find((m) => m.id === id);
}

function amountFor(e: GameEvent): [MissionKind, number] | null {
  switch (e.type) {
    case 'planted':
      return ['plant', 1];
    case 'watered':
      return ['water', 1];
    case 'bugCaught':
      return ['catchBug', 1];
    case 'harvested':
      return ['harvest', 1];
    case 'orderDelivered':
      return ['deliverOrder', 1];
    case 'sold':
      return ['sell', e.qty];
    case 'neighborHelped':
      return ['helpNeighbor', 1];
    // Chỉ thị 10 M8: the new systems.
    case 'birdFed':
      return ['feedBird', 1];
    case 'goodsMade':
      return ['makeGoods', e.qty];
    case 'cloudBlown':
      return ['blowCloud', 1];
    case 'fishReeled':
      return e.landed ? ['catchFish', 1] : null;
    default:
      return null;
  }
}

/** Adds the events of one command to today's missions; returns indexes that just completed. */
export function recordMissions(content: ContentPack, state: GameState, events: GameEvent[]): number[] {
  const done: number[] = [];
  for (const e of events) {
    const a = amountFor(e);
    if (!a) continue;
    state.missions.list.forEach((m, i) => {
      const def = missionDef(content, m.id);
      if (!def || def.kind !== a[0] || m.progress >= def.target) return;
      m.progress = Math.min(def.target, m.progress + a[1]);
      if (m.progress >= def.target) done.push(i);
    });
  }
  return done;
}

export function allMissionsClaimed(state: GameState): boolean {
  return state.missions.list.length > 0 && state.missions.list.every((m) => m.claimed);
}

/** Missions with a reward waiting (for the HUD dot). */
export function missionsReady(content: ContentPack, state: GameState): number {
  let n = state.missions.list.filter((m) => !m.claimed && m.progress >= (missionDef(content, m.id)?.target ?? Infinity)).length;
  if (allMissionsClaimed(state) && !state.missions.bonusClaimed) n += 1;
  return n;
}
