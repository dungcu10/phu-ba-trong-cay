// Time-limited events (POT_SYSTEM 3): points from ordinary play while the event runs, milestone
// rewards (the top ones are exclusive pots). Pots won stay forever and keep levelling after.

import type { ContentPack, EventDef, EventPointSource } from '../core/content.ts';
import type { GameEvent } from '../core/game.ts';
import type { GameState } from '../core/state.ts';

export function activeEvents(content: ContentPack, now: number): EventDef[] {
  return content.events.filter((e) => now >= e.start && now < e.end);
}

const SOURCE: Partial<Record<GameEvent['type'], EventPointSource>> = {
  harvested: 'harvest',
  orderDelivered: 'deliverOrder',
  missionClaimed: 'missionClaimed',
  neighborHelped: 'neighborHelped',
  // Chỉ thị 12 A5: points for the rotating events.
  bugCaught: 'catchBug',
  birdCaught: 'catchBug',
  petCaught: 'catchBug',
  fishReeled: 'catchFish',
  stallSold: 'stallSold',
  bazaarBought: 'bazaarBuy',
  jobStarted: 'makeGoods',
  cropStolen: 'steal',
  luckClaimed: 'luck',
  friendGift: 'friend',
};

export function eventPointsFor(ev: EventDef, events: GameEvent[]): number {
  let n = 0;
  for (const e of events) {
    const src = SOURCE[e.type];
    if (src) n += ev.points[src] ?? 0;
  }
  return n;
}

/** Events to show: running ones, and ended ones with an unclaimed earned milestone. */
export function visibleEvents(content: ContentPack, state: GameState, now: number): EventDef[] {
  return content.events.filter((e) => (now >= e.start && now < e.end) || claimableMilestones(state, e) > 0);
}

export function claimableMilestones(state: GameState, ev: EventDef): number {
  const p = state.events[ev.id];
  if (!p) return 0;
  return ev.milestones.slice(p.claimed).filter((m) => p.points >= m.points).length;
}
