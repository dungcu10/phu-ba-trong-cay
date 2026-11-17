// Chỉ thị 10 § 3.3: bug-catching birds.
//
// A bird perches on a floor and, while it is not hungry, catches one fitting bug on its floor every
// cycle (6 minutes at level 1 down to 3 at level 10). Catching uses the very same catchBug command
// the player uses (passed in as `catcher`): there is no second catching path. Birds never make bugs.
//
// Offline exactness: every bird has a fixed schedule (simulatedTo + k × cycle). advanceBirds()
// processes the attempts of all birds in time order up to `now`, so playing continuously or opening
// the game after 8 hours gives the same result. A hungry bird sleeps: its schedule restarts when fed.
// Nothing is ever lost: a hungry bird does not die, a rented bird flies away with its catches kept.

import type { BirdDef, BugDef, BugRarity, ContentPack } from '../core/content.ts';
import type { BirdState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { cropStatus, isNight } from './growth.ts';
import { addItem, removeItem } from './economy.ts';
import { localDay } from './missions.ts';

const HOUR = 3_600_000;
const MIN = 60_000;
const RARITY: BugRarity[] = ['common', 'good', 'rare', 'epic'];

export type Catcher = (floor: number, slot: number, at: number) => { ok: boolean; itemId?: string };

export type BirdEvent =
  | { type: 'birdCaught'; birdId: string; floor: number; slot: number; itemId: string; at: number; better: boolean }
  | { type: 'birdLevelUp'; birdId: string; level: number }
  | { type: 'birdLeft'; birdId: string; species: string };

function rules(content: ContentPack) {
  const r = content.birdRules;
  if (!r) throw new Error('Thiếu birds.json');
  return r;
}

/** Catch cycle in ms at a bird level (linear from level 1 to level 10). */
export function cycleMs(content: ContentPack, level: number): number {
  const c = rules(content).cycleMinutes;
  return Math.round((c.level1 + ((c.level10 - c.level1) * (level - 1)) / 9) * MIN);
}

/** Fullness lost per ms; higher levels stay full longer. */
function drainPerMs(content: ContentPack, level: number): number {
  const r = rules(content);
  return (r.foodPerHour * (1 - r.lastsLongerPerLevel * (level - 1))) / HOUR;
}

/** Fullness at time t (0 = hungry, asleep). */
export function foodAt(content: ContentPack, b: BirdState, t: number): number {
  return Math.max(0, b.food - drainPerMs(content, b.level) * Math.max(0, t - b.fedAt));
}

/** Time the bird becomes hungry (food reaches 0). */
export function hungryAt(content: ContentPack, b: BirdState): number {
  return b.fedAt + b.food / drainPerMs(content, b.level);
}

export function levelFor(content: ContentPack, caught: number): number {
  const at = rules(content).levelAt;
  let lv = 1;
  for (let i = 0; i < at.length; i++) if (caught >= at[i]!) lv = i + 1;
  return lv;
}

/** Highest bug rarity a bird can catch. */
function maxRarity(content: ContentPack, def: BirdDef): number {
  const r = rules(content).maxRarity;
  return RARITY.indexOf(def.nightOnly ? r.nightOnly : r.default);
}

/** Perches open on a floor at a player level (1, and 2 from the second-branch level). */
export function perchesPerFloor(content: ContentPack, playerLevel: number): number {
  return playerLevel >= rules(content).secondBranchLevel ? 2 : 1;
}

/** Is this bird working at time t (placed, fed, not escorting a balloon, not gone, right time of day)? */
function works(content: ContentPack, b: BirdState, def: BirdDef, t: number): boolean {
  if (b.floor === null) return false;
  if (b.escort && t < b.escort.until) return false;
  if (b.rentUntil !== null && t >= b.rentUntil) return false;
  if (foodAt(content, b, t) <= 0) return false;
  if (def.nightOnly && !isNight(content, t)) return false;
  return true;
}

/** Is a caught bug's kind within what this bird may catch (family checked by the owner)? */
export function birdCanTake(content: ContentPack, def: BirdDef, bug: BugDef): boolean {
  return RARITY.indexOf(bug.rarity) <= maxRarity(content, def);
}

/** First slot on the bird's floor of the player's garden with a bug it can catch at time t. */
function playerTarget(content: ContentPack, state: GameState, b: BirdState, def: BirdDef, t: number): number {
  const floor = state.floors[b.floor!];
  if (!floor) return -1;
  for (let i = 0; i < floor.slots.length; i++) {
    const slot = floor.slots[i]!;
    if (!slot.planting) continue;
    const st = cropStatus(content, state, slot, t);
    if (!st?.bug) continue;
    if (def.families.length > 0 && !def.families.includes(st.crop.family)) continue;
    if (!birdCanTake(content, def, st.bug.bug)) continue;
    return i;
  }
  return -1;
}

/** A bug one rarity higher (deterministic). */
function betterBug(content: ContentPack, seed: number, caught: BugDef, b: BirdState): BugDef | null {
  const next = RARITY[RARITY.indexOf(caught.rarity) + 1];
  if (!next) return null;
  const pool = content.bugList.filter((x) => x.rarity === next);
  if (pool.length === 0) return null;
  return pool[Math.floor(randomFor(seed, 'birdBetterKind', b.id, b.caught) * pool.length)]!;
}

/**
 * Whose birds these are (chỉ thị 11 D1: the player and every BOT run the same bird rules).
 * Only "which bug, and take it" differs: the player's garden is real (catchBug), a BOT's garden is
 * the generated one. Everything else — schedule, hunger, levels, rent, the 5% better bug — is shared.
 */
export interface BirdOwner {
  birds: BirdState[];
  seed: number;
  /** Slot on the bird's floor with a bug this bird can catch at `at`, or -1. */
  target(b: BirdState, def: BirdDef, at: number): number;
  /** Takes the bug (the player: catchBug). Returns the bug's item id, or null. */
  take(floor: number, slot: number, at: number): string | null;
  /** Swaps one caught bug for a rarer one ("better bug"); false when it cannot. */
  swap(from: string, to: string): boolean;
  /** A rented bird leaving. */
  remove(b: BirdState): void;
}

/** The player's side of the bird rules. */
export function playerBirds(content: ContentPack, state: GameState, catcher: Catcher): BirdOwner {
  return {
    birds: state.birds,
    seed: state.seed,
    target: (b, def, at) => playerTarget(content, state, b, def, at),
    take: (floor, slot, at) => {
      const r = catcher(floor, slot, at);
      return r.ok && r.itemId ? r.itemId : null;
    },
    swap: (from, to) => {
      if ((state.inventory[from] ?? 0) < 1) return false;
      removeItem(state, from, 1);
      addItem(state, to, 1);
      return true;
    },
    remove: (b) => {
      state.birds = state.birds.filter((x) => x !== b);
    },
  };
}

/** Runs the player's birds up to `now` with the player's own catchBug. */
export function advanceBirds(content: ContentPack, state: GameState, now: number, catcher: Catcher): BirdEvent[] {
  return runBirds(content, playerBirds(content, state, catcher), now);
}

/**
 * Runs every bird of one owner up to `now`, in time order across its birds. Also sends rented birds
 * home when their time is up, and brings escorting birds back.
 */
export function runBirds(content: ContentPack, owner: BirdOwner, now: number): BirdEvent[] {
  const events: BirdEvent[] = [];
  if (!content.birds || !content.birdRules || owner.birds.length === 0) return events;
  const rr = rules(content);
  // Next attempt time of each bird.
  const next = new Map<string, number>();
  for (const b of owner.birds) next.set(b.id, b.simulatedTo + cycleMs(content, b.level));
  for (;;) {
    let pick: BirdState | null = null;
    let at = Infinity;
    for (const b of owner.birds) {
      const t = next.get(b.id)!;
      if (t <= now && (t < at || (t === at && pick && b.id < pick.id))) {
        pick = b;
        at = t;
      }
    }
    if (!pick) break;
    const b = pick;
    const def = content.birds.get(b.species);
    // Past its hunger or its rent, the schedule stops here (restarts when fed / it is gone).
    const stop = Math.min(hungryAt(content, b), b.rentUntil ?? Infinity);
    if (!def || at > stop) {
      next.set(b.id, Infinity);
      continue;
    }
    b.simulatedTo = at;
    next.set(b.id, at + cycleMs(content, b.level));
    if (!works(content, b, def, at)) continue;
    const slot = owner.target(b, def, at);
    if (slot < 0) continue;
    let itemId = owner.take(b.floor!, slot, at);
    if (!itemId) continue;
    let better = false;
    if (b.level >= rr.betterBugFromLevel && randomFor(owner.seed, 'birdBetter', b.id, b.caught) < rr.betterBugChance) {
      const up = betterBug(content, owner.seed, content.bugs.get(itemId)!, b);
      if (up && owner.swap(itemId, up.id)) {
        itemId = up.id;
        better = true;
      }
    }
    b.caught += 1;
    const day = localDay(content, at);
    b.today = b.today.day === day ? { day, count: b.today.count + 1 } : { day, count: 1 };
    events.push({ type: 'birdCaught', birdId: b.id, floor: b.floor!, slot, itemId, at, better });
    const lv = levelFor(content, b.caught);
    if (lv > b.level) {
      // Fullness is carried over at the moment of the level-up, then drains at the new rate.
      b.food = foodAt(content, b, at);
      b.fedAt = at;
      b.level = lv;
      events.push({ type: 'birdLevelUp', birdId: b.id, level: lv });
      next.set(b.id, at + cycleMs(content, b.level));
    }
  }
  // Rented birds whose time is up fly away; escorts that came back are at home again.
  for (const b of [...owner.birds]) {
    if (b.rentUntil !== null && now >= b.rentUntil) {
      owner.remove(b);
      events.push({ type: 'birdLeft', birdId: b.id, species: b.species });
      continue;
    }
    if (b.escort && now >= b.escort.until) b.escort = null;
    // Asleep from hunger: keep the schedule anchored so it does not "catch up" after feeding.
    if (foodAt(content, b, now) <= 0) b.simulatedTo = Math.max(b.simulatedTo, Math.min(now, hungryAt(content, b)));
  }
  return events;
}

/** Free perch (floor, branch) for a new bird, or null. */
export function freePerch(content: ContentPack, state: GameState): { floor: number; branch: number } | null {
  const per = perchesPerFloor(content, state.player.level);
  for (let f = 0; f < state.floors.length; f++) {
    for (let br = 0; br < per; br++) if (!state.birds.some((b) => b.floor === f && b.branch === br)) return { floor: f, branch: br };
  }
  return null;
}

export type BirdError = 'no_bird' | 'level_too_low' | 'not_enough_coins' | 'not_enough_gems' | 'cannot_rent' | 'no_perch' | 'not_enough_items' | 'wrong_food' | 'already_full' | 'bad_perch';

/** Gets a bird: rent (coins, 3 days) or buy (gems). It perches on the first free branch. */
export function obtainBird(content: ContentPack, state: GameState, species: string, how: 'rent' | 'buy', now: number): BirdError | BirdState {
  const def = content.birds?.get(species);
  if (!def) return 'no_bird';
  if (state.player.level < def.unlockLevel) return 'level_too_low';
  if (how === 'rent' && !def.rent) return 'cannot_rent';
  const perch = freePerch(content, state);
  if (!perch) return 'no_perch';
  if (how === 'rent') {
    if (state.player.coins < def.rent!.coins) return 'not_enough_coins';
    state.player.coins -= def.rent!.coins;
  } else {
    if (state.player.gems < def.gems) return 'not_enough_gems';
    state.player.gems -= def.gems;
  }
  const bird = newBird(content, `bird-${state.nextId++}`, def, how, now, perch);
  state.birds.push(bird);
  return bird;
}

/** A new bird, full, on a perch (shared by the player and the BOTs). */
export function newBird(content: ContentPack, id: string, def: BirdDef, how: 'rent' | 'buy', now: number, perch: { floor: number; branch: number }): BirdState {
  return {
    id,
    species: def.id,
    level: 1,
    caught: 0,
    food: rules(content).foodMax,
    fedAt: now,
    floor: perch.floor,
    branch: perch.branch,
    rentUntil: how === 'rent' && def.rent ? now + def.rent.days * 24 * HOUR : null,
    simulatedTo: now,
    today: { day: localDay(content, now), count: 0 },
    escort: null,
  };
}

/** Adds food to a bird (shared by the player and the BOTs). A sleeping bird starts a new schedule
 *  from now: no catch-up for the time it slept. */
export function addFood(content: ContentPack, b: BirdState, gain: number, now: number): number {
  const cur = foodAt(content, b, now);
  if (cur <= 0) b.simulatedTo = now;
  b.food = Math.min(rules(content).foodMax, cur + gain);
  b.fedAt = now;
  return b.food;
}

/** Feeds a bird with Hạt Kê Mây, or with produce of its own family (more friendship). */
export function feedBird(content: ContentPack, state: GameState, birdId: string, itemId: string, now: number): BirdError | { food: number } {
  const b = state.birds.find((x) => x.id === birdId);
  const def = b && content.birds?.get(b.species);
  if (!b || !def) return 'no_bird';
  const r = rules(content);
  let gain: number;
  if (itemId === r.millet.item) gain = r.millet.food;
  else {
    const crop = content.cropList.find((c) => c.produce.id === itemId);
    if (!crop || (def.families.length > 0 && !def.families.includes(crop.family))) return 'wrong_food';
    gain = r.produceFood;
  }
  const cur = foodAt(content, b, now);
  if (cur >= r.foodMax - 0.5) return 'already_full';
  if ((state.inventory[itemId] ?? 0) < 1) return 'not_enough_items';
  removeItem(state, itemId, 1);
  return { food: addFood(content, b, gain, now) };
}

/** Moves a bird to a floor's branch (it works only there). */
export function placeBird(content: ContentPack, state: GameState, birdId: string, floor: number, branch: number): BirdError | null {
  const b = state.birds.find((x) => x.id === birdId);
  if (!b) return 'no_bird';
  if (floor < 0 || floor >= state.floors.length || branch < 0 || branch >= perchesPerFloor(content, state.player.level)) return 'bad_perch';
  const other = state.birds.find((x) => x !== b && x.floor === floor && x.branch === branch);
  if (other) {
    other.floor = b.floor;
    other.branch = b.branch;
  }
  b.floor = floor;
  b.branch = branch;
  return null;
}

/** Buys Hạt Kê Mây. */
export function buyMillet(content: ContentPack, state: GameState, qty: number): BirdError | null {
  const r = rules(content);
  const cost = r.millet.coins * qty;
  if (qty < 1) return 'not_enough_items';
  if (state.player.coins < cost) return 'not_enough_coins';
  state.player.coins -= cost;
  addItem(state, r.millet.item, qty);
  return null;
}

/** Shows a "flying away soon" note within the warning window (§ 3.3: báo trước 1 giờ). */
export function rentEndsSoon(content: ContentPack, b: BirdState, now: number): boolean {
  return b.rentUntil !== null && b.rentUntil - now <= rules(content).rentWarnMinutes * MIN && b.rentUntil > now;
}

/** "Cho ăn hết": Hạt Kê Mây to every bird that is not full, until full or out of millet. */
export function feedAll(content: ContentPack, state: GameState, now: number): BirdError | { fed: number } {
  const r = rules(content);
  let fed = 0;
  for (const b of state.birds) {
    while (foodAt(content, b, now) < r.foodMax - 0.5 && (state.inventory[r.millet.item] ?? 0) > 0) {
      if (typeof feedBird(content, state, b.id, r.millet.item, now) === 'string') break;
      fed += 1;
    }
  }
  if (fed === 0) return state.birds.every((b) => foodAt(content, b, now) >= r.foodMax - 0.5) ? 'already_full' : 'not_enough_items';
  return { fed };
}
