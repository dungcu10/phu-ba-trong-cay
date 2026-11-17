// Chỉ thị 11 đính chính D1: neighbours (BOT) keep birds under the player's rules.
//
// Everything about a bird — schedule, hunger and sleep, levels, rent running out, the 5% better
// bug, feeding with Hạt Kê Mây — is the shared code in birds.ts (runBirds, newBird, addFood). A
// neighbour's garden is the generated one (visit.ts botGarden), so the only BOT-specific part is
// "is there a bug here now": the bugs its growing crops attract, at the count rule's rate (the first
// bug, Bọ Rùa Mây: one per growSecondsPerBug), for the share of time a crop is growing. The kind is
// picked from the crop's own bug list with the same eligibility as on the player's plants.

import type { BirdDef, BotDef, BugDef, ContentPack } from '../core/content.ts';
import type { BotState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { addFood, birdCanTake, cycleMs, foodAt, newBird, runBirds, type BirdEvent, type BirdOwner } from './birds.ts';
import { isNight } from './growth.ts';
import { localDay } from './missions.ts';
import { botGarden, type VisitFloor } from './visit.ts';

const DAY_MS = 86_400_000;

/** Generated gardens per neighbour and day (they change once a day). Small, bounded memo. */
const gardens = new Map<string, VisitFloor[]>();

function gardenOn(content: ContentPack, state: GameState, botId: string, at: number): VisitFloor[] {
  const day = localDay(content, at);
  // The generated garden depends on the seed, the neighbour, the day and the neighbour's level.
  const key = `${state.seed}:${botId}:${day}:${state.neighbors[botId]?.level ?? 0}`;
  let g = gardens.get(key);
  if (!g) {
    if (gardens.size > 512) gardens.clear();
    const start = day * DAY_MS - content.missions.utcOffsetHours * 3_600_000;
    g = botGarden(content, state, botId, start);
    gardens.set(key, g);
  }
  return g;
}

type Kinds = { list: Array<{ id: string; w: number }>; total: number };
type Plan = { spots: Array<{ slot: number; day: Kinds; night: Kinds }> };

/** What a bird can find on a neighbour's floor today: fitting pots and, per pot, the bug kinds it
 *  may catch by day and by night. Fixed for a day, a bird species and the neighbour's level. */
const plans = new Map<string, Plan | null>();

function planFor(content: ContentPack, state: GameState, botId: string, level: number, b: BirdState, def: BirdDef, at: number): Plan | null {
  const key = `${state.seed}:${botId}:${localDay(content, at)}:${b.floor ?? 0}:${def.id}:${level}`;
  const hit = plans.get(key);
  if (hit !== undefined) return hit;
  if (plans.size > 2048) plans.clear();
  const floor = gardenOn(content, state, botId, at)[b.floor ?? 0];
  let plan: Plan | null = null;
  if (floor) {
    const kinds = (bugs: Array<{ id: string; weight: number }>, night: boolean): Kinds => {
      const list = bugs
        .map((x) => ({ bug: content.bugs.get(x.id), w: x.weight }))
        .filter((x): x is { bug: BugDef; w: number } => !!x.bug && x.bug.unlockLevel <= level && (!x.bug.nightOnly || night) && birdCanTake(content, def, x.bug))
        .map((x) => ({ id: x.bug.id, w: x.w }));
      return { list, total: list.reduce((a, k) => a + k.w, 0) };
    };
    plan = {
      spots: floor.pots
        .map((p, slot) => ({ p, slot }))
        .filter((x) => def.families.length === 0 || def.families.includes(x.p.crop.family))
        .map((x) => ({ slot: x.slot, day: kinds(x.p.crop.bugs, false), night: kinds(x.p.crop.bugs, true) })),
    };
  }
  plans.set(key, plan);
  return plan;
}

/** Small deterministic generator (mulberry32) for the draws that follow one keyed draw. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The neighbour's side of the bird rules. */
export function botBirdOwner(content: ContentPack, state: GameState, bot: BotDef, s: BotState): BirdOwner {
  const share = content.birdRules?.bots?.growingShare ?? 0;
  const perBugMs = (content.bugList[0]?.growSecondsPerBug ?? 1800) * 1000;
  let pending: string | null = null;
  const memos = new Map<string, { day: number; plan: Plan | null }>();
  const owner: BirdOwner = {
    birds: s.birds,
    seed: state.seed,
    target(b: BirdState, def: BirdDef, at: number): number {
      const day = localDay(content, at);
      let memo = memos.get(b.id);
      if (!memo || memo.day !== day) {
        memo = { day, plan: planFor(content, state, bot.id, s.level, b, def, at) };
        memos.set(b.id, memo);
      }
      const plan = memo.plan;
      if (!plan || plan.spots.length === 0) return -1;
      // One keyed draw per look; the pot and the kind come from a small generator seeded by it.
      const u = randomFor(state.seed, 'botBird', bot.id, b.id, at);
      // Bugs that landed since the bird's last look: fitting crops × rate × time × growing share.
      const chance = Math.min(1, (plan.spots.length * share * cycleMs(content, b.level)) / perBugMs);
      if (u >= chance) return -1;
      const next = mulberry(Math.floor(u * 4294967296));
      const spot = plan.spots[Math.floor(next() * plan.spots.length)]!;
      const kinds = isNight(content, at) ? spot.night : spot.day;
      if (kinds.total <= 0) return -1;
      let r = next() * kinds.total;
      pending = (kinds.list.find((k) => (r -= k.w) < 0) ?? kinds.list[kinds.list.length - 1]!).id;
      return spot.slot;
    },
    take(): string | null {
      const id = pending;
      pending = null;
      if (!id) return null;
      s.bugs[id] = (s.bugs[id] ?? 0) + 1;
      return id;
    },
    swap(from: string, to: string): boolean {
      if ((s.bugs[from] ?? 0) < 1) return false;
      const left = (s.bugs[from] ?? 0) - 1;
      if (left === 0) delete s.bugs[from];
      else s.bugs[from] = left;
      s.bugs[to] = (s.bugs[to] ?? 0) + 1;
      return true;
    },
    remove(b: BirdState): void {
      s.birds = s.birds.filter((x) => x !== b);
      owner.birds = s.birds;
    },
  };
  return owner;
}

/** Runs a neighbour's birds up to `at` (shared runBirds). */
export function advanceBotBirds(content: ContentPack, state: GameState, bot: BotDef, s: BotState, at: number): BirdEvent[] {
  if (!content.birds || !content.birdRules || s.birds.length === 0) return [];
  return runBirds(content, botBirdOwner(content, state, bot, s), at);
}

/**
 * The neighbour's own bug catching for one session window (from → to), like a player tapping the
 * bugs on their plants: the bugs that landed on every growing crop of its garden in that window, at
 * the count rule's rate, minus the ones its birds already took in the window (the bird and the hand
 * share one pool, as for the player). Kinds come from each crop's bug list (same eligibility).
 */
export function botCatchBugs(content: ContentPack, state: GameState, bot: BotDef, s: BotState, from: number, to: number, birdTook: number): number {
  const share = content.birdRules?.bots?.growingShare ?? 0;
  const perBugMs = (content.bugList[0]?.growSecondsPerBug ?? 1800) * 1000;
  if (share <= 0 || to <= from) return 0;
  const garden = gardenOn(content, state, bot.id, from);
  const pots = garden.flatMap((f) => f.pots);
  if (pots.length === 0) return 0;
  const landed = (pots.length * share * (to - from)) / perBugMs - birdTook;
  if (landed <= 0) return 0;
  const u = randomFor(state.seed, 'botHand', bot.id, to);
  const n = Math.floor(landed) + (u < landed - Math.floor(landed) ? 1 : 0);
  if (n === 0) return 0;
  const next = mulberry(Math.floor(u * 4294967296));
  const night = isNight(content, to);
  let caught = 0;
  for (let k = 0; k < n; k++) {
    const crop = pots[Math.floor(next() * pots.length)]!.crop;
    const kinds = crop.bugs.filter((x) => {
      const b = content.bugs.get(x.id);
      return !!b && b.unlockLevel <= s.level && (!b.nightOnly || night);
    });
    const total = kinds.reduce((a, x) => a + x.weight, 0);
    if (total <= 0) continue;
    let r = next() * total;
    const id = (kinds.find((x) => (r -= x.weight) < 0) ?? kinds[kinds.length - 1]!).id;
    s.bugs[id] = (s.bugs[id] ?? 0) + 1;
    caught += 1;
  }
  return caught;
}

/**
 * A neighbour's bird care in one of its sessions: rents a bird of the family it likes once it can
 * afford it comfortably, and feeds Hạt Kê Mây (bought for the same price as the player) when low.
 */
export function botKeepBirds(content: ContentPack, bot: BotDef, s: BotState, at: number): void {
  const cfg = content.birdRules?.bots;
  const rules = content.birdRules;
  if (!cfg || !rules || !content.birds) return;
  if (s.birds.length === 0) {
    const options = [...content.birds.values()].filter((d) => d.rent && d.unlockLevel <= s.level && s.coins >= d.rent.coins * cfg.rentWhenCoinsTimes);
    const def = options.find((d) => d.families.includes(bot.likes)) ?? options[0];
    if (def?.rent) {
      s.coins -= def.rent.coins;
      s.birds.push(newBird(content, `${bot.id}-bird-${at}`, def, 'rent', at, { floor: 0, branch: 0 }));
    }
  }
  for (const b of s.birds) {
    if (foodAt(content, b, at) >= cfg.feedBelow) continue;
    while (foodAt(content, b, at) < rules.foodMax - 0.5 && s.coins >= rules.millet.coins) {
      s.coins -= rules.millet.coins;
      addFood(content, b, rules.millet.food, at);
    }
  }
}

type BirdState = BotState['birds'][number];
