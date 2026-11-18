// Chỉ thị 11 TỔNG § E: companion pets — gardeners with a trade. Each species has three skills (the
// second opens at pet level 10, the third at 20); skill strength grows with stars (1–5) and a little
// with level. A pet works when it is walked (dắt) and fed; it looks after one floor and its garden skills
// only work there (the kitten's stall skills work for the whole garden). Hungry pets just sleep — bond
// never goes down, pets never leave or die. Garden work uses the player's own commands (catchBug,
// harvest, plant) through callbacks, worked out in time order up to now so it is exact offline.

import type { ContentPack, PetSkillDef, PetSpeciesDef } from '../core/content.ts';
import type { GameState, PetState } from '../core/state.ts';
import { addItem, removeItem } from './economy.ts';
import { localDay } from './missions.ts';
import { houseLevel } from './village.ts';

export type PetError = 'locked' | 'unknown_pet' | 'have_it' | 'no_pet' | 'not_enough_coins' | 'not_enough_gems' | 'not_enough_items' | 'cannot_eat' | 'pet_full' | 'no_walk_slot' | 'bad_floor' | 'pet_max_stars' | 'pet_level_low' | 'cooldown' | 'pet_away' | 'pet_asleep';

const MIN = 60_000;
const HOUR = 3_600_000;

export function petRules(content: ContentPack) {
  return content.pets ?? null;
}

export function speciesDef(content: ContentPack, id: string): PetSpeciesDef | undefined {
  return content.pets?.species.find((s) => s.id === id);
}

export function petOf(state: GameState, species: string): PetState | undefined {
  return state.pets.find((p) => p.species === species);
}

export function newPet(species: string, now: number, active: boolean): PetState {
  return { species, level: 1, xp: 0, stars: 1, bond: 0, food: 100, fedAt: now, active, floor: 0, awayUntil: null, simulatedTo: now, skillAt: {}, bondDay: { day: -1, feeds: 0 }, patHour: { hour: -1, n: 0 }, milestones: [] };
}

/** Food now (runs down by food.perHour). */
export function foodAt(content: ContentPack, p: PetState, at: number): number {
  const r = petRules(content)!;
  return Math.max(0, p.food - (r.food.perHour * Math.max(0, at - p.fedAt)) / HOUR);
}

/** When the pet's food reaches 0. */
export function hungryFrom(content: ContentPack, p: PetState): number {
  const r = petRules(content)!;
  return r.food.perHour > 0 ? p.fedAt + (p.food / r.food.perHour) * HOUR : Infinity;
}

/** Walked, home from errands, fed: its skills work. */
export function petWorking(content: ContentPack, p: PetState, at: number): boolean {
  return p.active && (p.awayUntil === null || p.awayUntil <= at) && foodAt(content, p, at) > 0;
}

/** How many pets can be walked: base, plus one at each listed Nhà Thú Cưng level. */
export function walkSlots(content: ContentPack, state: GameState): number {
  const r = petRules(content);
  if (!r) return 0;
  const lv = houseLevel(state, 'pets');
  return r.activeSlots.base + r.activeSlots.houseLevels.filter((l) => lv >= l).length;
}

export function xpToNext(content: ContentPack, level: number): number {
  const [a, g] = petRules(content)!.xpPerLevel;
  return Math.round(a * Math.pow(g, level - 1));
}

export function addPetXp(content: ContentPack, p: PetState, xp: number): number[] {
  const r = petRules(content)!;
  const ups: number[] = [];
  p.xp += xp;
  while (p.level < r.maxLevel && p.xp >= xpToNext(content, p.level)) {
    p.xp -= xpToNext(content, p.level);
    p.level += 1;
    ups.push(p.level);
  }
  return ups;
}

/** Which skills a pet has opened (index 0, 1, 2 at pet level 1, 10, 20). */
export function skillOpen(p: PetState, index: number): boolean {
  return p.level >= [1, 10, 20][index]!;
}

/** Value of a skill at the pet's stars and level. */
export function skillValue(content: ContentPack, p: PetState, skill: PetSkillDef): number {
  const r = petRules(content)!;
  const base = skill.lo + ((skill.hi - skill.lo) * (p.stars - 1)) / 4;
  // Times (minutes, hours) get shorter with level, everything else bigger.
  const boost = 1 + r.levelBoost * (p.level - 1);
  return skill.unit === 'minutes' || skill.unit === 'hours' ? base / boost : skill.unit === 'count' ? Math.round(base * boost) : base * boost;
}

/** The value of a skill of the working pet that has it (null when none works). For floor skills, give the floor. */
export function activeSkill(content: ContentPack, state: GameState, skillId: string, at: number, floor?: number): { pet: PetState; value: number } | null {
  for (const p of state.pets) {
    const def = speciesDef(content, p.species);
    const i = def?.skills.findIndex((s) => s.id === skillId) ?? -1;
    if (!def || i < 0 || !skillOpen(p, i) || !petWorking(content, p, at)) continue;
    if (floor !== undefined && p.floor !== floor) continue;
    return { pet: p, value: skillValue(content, p, def.skills[i]!) };
  }
  return null;
}

// --- getting, feeding, patting, walking ----------------------------------------------------------

/** The kitten is a gift when the market opens (chỉ thị 11 § E1). */
export function giftKitten(content: ContentPack, state: GameState, now: number): boolean {
  const sp = content.pets?.species.find((s) => s.price.free);
  if (!sp || state.player.level < sp.unlockLevel || petOf(state, sp.id)) return false;
  state.pets.push(newPet(sp.id, now, state.pets.filter((p) => p.active).length < walkSlots(content, state)));
  return true;
}

export function obtainPet(content: ContentPack, state: GameState, species: string, pay: 'coins' | 'gems' | 'shards', now: number): PetError | { pet: PetState } {
  const sp = speciesDef(content, species);
  if (!sp) return 'unknown_pet';
  if (state.player.level < sp.unlockLevel) return 'locked';
  if (petOf(state, species)) return 'have_it';
  const pr = sp.price;
  if (pay === 'coins') {
    if (!pr.coins) return 'unknown_pet';
    if (state.player.coins < pr.coins) return 'not_enough_coins';
    state.player.coins -= pr.coins;
  } else if (pay === 'gems') {
    if (!pr.gems) return 'unknown_pet';
    if (state.player.gems < pr.gems) return 'not_enough_gems';
    state.player.gems -= pr.gems;
  } else {
    if (!pr.shards) return 'unknown_pet';
    if ((state.inventory[pr.shards.item] ?? 0) < pr.shards.qty) return 'not_enough_items';
    removeItem(state, pr.shards.item, pr.shards.qty);
  }
  const pet = newPet(species, now, state.pets.filter((p) => p.active).length < walkSlots(content, state));
  state.pets.push(pet);
  return { pet };
}

/** Whether this item is food the pet likes (×3 bond), plain food, or not food. */
export function foodKind(content: ContentPack, species: string, itemId: string): 'liked' | 'food' | null {
  const sp = speciesDef(content, species);
  const item = content.items.get(itemId);
  if (!sp || !item) return null;
  const base = item.baseItem ?? itemId;
  const crop = content.cropList.find((c) => c.produce.id === base);
  const liked = sp.likes.items.includes(base) || (!!crop && sp.likes.kinds.includes(crop.family));
  if (liked) return 'liked';
  return item.kind === 'produce' || item.kind === 'good' ? 'food' : null;
}

function bondUp(content: ContentPack, p: PetState, amount: number): number[] {
  const r = petRules(content)!;
  const before = p.bond;
  p.bond = Math.min(r.bond.max, p.bond + amount);
  return r.bond.milestones.filter((m) => before < m && p.bond >= m && !p.milestones.includes(m));
}

/** Bond milestone rewards: a badge of the species at the listed marks. */
function payMilestones(content: ContentPack, state: GameState, p: PetState, reached: number[]): void {
  const sp = speciesDef(content, p.species)!;
  for (const m of reached) {
    p.milestones.push(m);
    if (petRules(content)!.bond.badgeAt.includes(m)) addItem(state, sp.badge, 1);
  }
}

export function feedPet(content: ContentPack, state: GameState, species: string, itemId: string, now: number): PetError | { liked: boolean; bond: number; levelUps: number[]; milestones: number[] } {
  const r = petRules(content);
  const p = petOf(state, species);
  if (!r || !p) return 'no_pet';
  const kind = foodKind(content, species, itemId);
  if (!kind) return 'cannot_eat';
  if ((state.inventory[itemId] ?? 0) < 1) return 'not_enough_items';
  const food = foodAt(content, p, now);
  if (food >= r.food.max) return 'pet_full';
  removeItem(state, itemId, 1);
  p.food = Math.min(r.food.max, food + r.food.perFeed);
  p.fedAt = now;
  const day = localDay(content, now);
  if (p.bondDay.day !== day) p.bondDay = { day, feeds: 0 };
  let bond = 0;
  if (p.bondDay.feeds < r.bond.feedsPerDay) {
    p.bondDay.feeds += 1;
    bond = r.bond.perFeed * (kind === 'liked' ? r.food.likedTimes : 1);
  }
  const milestones = bondUp(content, p, bond);
  payMilestones(content, state, p, milestones);
  const levelUps = addPetXp(content, p, r.xp.perFeed);
  return { liked: kind === 'liked', bond, levelUps, milestones };
}

export function patPet(content: ContentPack, state: GameState, species: string, now: number): PetError | { bond: number; milestones: number[] } {
  const r = petRules(content);
  const p = petOf(state, species);
  if (!r || !p) return 'no_pet';
  const hour = Math.floor(now / HOUR);
  if (p.patHour.hour !== hour) p.patHour = { hour, n: 0 };
  let bond = 0;
  if (p.patHour.n < r.bond.patsPerHour) {
    p.patHour.n += 1;
    bond = r.bond.perPat;
    addPetXp(content, p, r.xp.perPat);
  }
  const milestones = bondUp(content, p, bond);
  payMilestones(content, state, p, milestones);
  return { bond, milestones };
}

export function walkPet(content: ContentPack, state: GameState, species: string, active: boolean, now: number): PetError | { active: boolean } {
  const p = petOf(state, species);
  if (!p) return 'no_pet';
  if (active && !p.active && state.pets.filter((x) => x.active).length >= walkSlots(content, state)) return 'no_walk_slot';
  p.active = active;
  p.simulatedTo = Math.max(p.simulatedTo, now);
  return { active };
}

export function guardFloor(state: GameState, species: string, floor: number, now: number): PetError | { floor: number } {
  const p = petOf(state, species);
  if (!p) return 'no_pet';
  if (!Number.isInteger(floor) || floor < 0 || floor >= state.floors.length) return 'bad_floor';
  p.floor = floor;
  p.simulatedTo = Math.max(p.simulatedTo, now);
  return { floor };
}

/** Next star's requirement, or null at 5 stars. */
export function nextPetStar(content: ContentPack, p: PetState) {
  return petRules(content)?.stars[p.stars - 1] ?? null;
}

/** Bugs of a rarity the player holds, rarest-first not needed: any bug of that rarity counts. */
function bugsOf(content: ContentPack, state: GameState, rarity: string): Array<[string, number]> {
  return content.bugList.filter((b) => b.rarity === rarity && (state.inventory[b.id] ?? 0) > 0).map((b) => [b.id, state.inventory[b.id]!]);
}

export function starUpPet(content: ContentPack, state: GameState, species: string): PetError | { stars: number } {
  const p = petOf(state, species);
  const sp = speciesDef(content, species);
  if (!p || !sp) return 'no_pet';
  const need = nextPetStar(content, p);
  if (!need) return 'pet_max_stars';
  if (p.level < need.minLevel) return 'pet_level_low';
  if (state.player.coins < need.coins) return 'not_enough_coins';
  if ((state.inventory[sp.badge] ?? 0) < need.badges) return 'not_enough_items';
  const bugs = bugsOf(content, state, need.bugRarity);
  if (bugs.reduce((a, [, q]) => a + q, 0) < need.bugs) return 'not_enough_items';
  state.player.coins -= need.coins;
  removeItem(state, sp.badge, need.badges);
  let left = need.bugs;
  for (const [id, q] of bugs) {
    const take = Math.min(q, left);
    removeItem(state, id, take);
    left -= take;
    if (left === 0) break;
  }
  p.stars += 1;
  return { stars: p.stars };
}

// --- garden work (offline-exact) ----------------------------------------------------------------

export type PetCatcher = (floor: number, slot: number, at: number) => { ok: boolean; itemId?: string };

export interface PetWorkEvent {
  type: 'petCaught';
  species: string;
  itemId: string;
  floor: number;
}

/**
 * Cáo Vồ Bọ: every (10 → 5) minutes on its floor the fox catches one bug with the player's own
 * catchBug, in time order up to now, at most `offlineHours` back. Other pets' timers just move on.
 */
export function advancePets(content: ContentPack, state: GameState, now: number, catcher: PetCatcher): PetWorkEvent[] {
  const events: PetWorkEvent[] = [];
  for (const p of state.pets) {
    const sp = speciesDef(content, p.species);
    const skill = sp?.skills.find((s) => s.id === 'pounce');
    if (!sp || !skill) {
      p.simulatedTo = Math.max(p.simulatedTo, now);
      continue;
    }
    const step = skillValue(content, p, skill) * MIN;
    let t = Math.max(p.simulatedTo, now - (skill.offlineHours ?? 8) * HOUR);
    while (t + step <= now) {
      t += step;
      if (!petWorking(content, p, t)) continue;
      const floor = state.floors[p.floor];
      if (!floor) break;
      for (let i = 0; i < floor.slots.length; i++) {
        const r = catcher(p.floor, i, t);
        if (r.ok && r.itemId) {
          events.push({ type: 'petCaught', species: p.species, itemId: r.itemId, floor: p.floor });
          addPetXp(content, p, petRules(content)!.xp.perSkill);
          break;
        }
      }
    }
    p.simulatedTo = t;
  }
  return events;
}

/** Rồng Mưa Ngọc: cooldown in hours at the dragon's stars (8 → 4). */
export function jadeRainCooldownMs(content: ContentPack, p: PetState): number {
  const sk = speciesDef(content, p.species)?.skills.find((s) => s.id === 'jadeRain');
  const [lo, hi] = sk?.cooldownHours ?? [8, 4];
  return (lo + ((hi - lo) * (p.stars - 1)) / 4) * HOUR;
}

export function jadeRainReadyAt(content: ContentPack, state: GameState): number | null {
  const p = state.pets.find((x) => speciesDef(content, x.species)?.skills.some((s) => s.id === 'jadeRain'));
  return p ? (p.skillAt.jadeRain ?? 0) : null;
}
