// Chỉ thị 11 TỔNG § D: the village. Eight houses, each a feature, each levels 1–5 with materials taken
// from other systems (§ D2) and a timer that runs while the game is closed. A house stays usable while
// it is being upgraded. Cấp Làng = the sum of the house levels; its milestones shorten upgrades, open a
// second build slot, add a help request and order EXP. Opening floor 5, 10, 15 and 20 for the first time
// brings a Huy Chương Độ Cao with a big reward. A 7-day check-in pays every day the player comes (a day
// missed does not reset anything — no penalty for being away).

import type { ContentPack, HouseDef, HouseEffect, Reward } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { tidy } from '../core/income.ts';
import { addItem, removeItem } from './economy.ts';
import { canAfford } from './pots.ts';
import { localDay } from './missions.ts';
import { obtainPot } from './potStars.ts';

export type VillageError = 'locked' | 'unknown_house' | 'house_max_level' | 'busy' | 'no_build_slot' | 'not_enough_coins' | 'not_enough_items' | 'already_claimed';

const MIN = 60_000;

export function houseDef(content: ContentPack, id: string): HouseDef | undefined {
  return content.village?.houses.find((h) => h.id === id);
}

export function houseLevel(state: GameState, id: string): number {
  return state.buildings[id]?.level ?? 1;
}

export function houseOpen(content: ContentPack, state: GameState, id: string): boolean {
  const h = houseDef(content, id);
  return !!h && state.player.level >= h.unlockLevel;
}

/** What a house adds at its level for one effect (0 at level 1). */
export function houseBonus(content: ContentPack, state: GameState, id: string, effect: HouseEffect): number {
  const h = houseDef(content, id);
  if (!h || !houseOpen(content, state, id)) return 0;
  return (h.effects[effect] ?? 0) * (houseLevel(state, id) - 1);
}

/** Cấp Làng: the sum of the levels of the houses the player has opened. */
export function villageLevel(content: ContentPack, state: GameState): number {
  return (content.village?.houses ?? []).filter((h) => houseOpen(content, state, h.id)).reduce((a, h) => a + houseLevel(state, h.id), 0);
}

/** Sum of a Cấp Làng milestone value reached. */
export function villagePerk(content: ContentPack, state: GameState, key: 'upgradeTime' | 'buildSlots' | 'helpPerDay' | 'orderXp'): number {
  const lv = villageLevel(content, state);
  return (content.village?.villageLevels ?? []).filter((m) => lv >= m.level).reduce((a, m) => a + (m[key] ?? 0), 0);
}

export function buildSlots(content: ContentPack, state: GameState): number {
  return (content.village?.buildSlots ?? 1) + villagePerk(content, state, 'buildSlots');
}

/** Houses being upgraded now. */
export function upgrading(state: GameState, now: number): string[] {
  return Object.entries(state.buildings)
    .filter(([, b]) => b.upgradeEndsAt !== null && b.upgradeEndsAt > now)
    .map(([id]) => id);
}

/** The cost and time of the next level, or null at level 5. */
export function nextHouseCost(content: ContentPack, state: GameState, id: string): { coins: number; items: Record<string, number>; ms: number } | null {
  const h = houseDef(content, id);
  const lv = houseLevel(state, id);
  const c = h?.costs[lv - 1];
  if (!h || !c) return null;
  const minutes = content.village!.minutes[lv - 1]! * (1 + villagePerk(content, state, 'upgradeTime'));
  return { coins: c.coins + (c.coinsU > 0 ? tidy(c.coinsU * content.income.unit(state.player.level)) : 0), items: c.items, ms: Math.round(minutes * MIN) };
}

export function upgradeHouse(content: ContentPack, state: GameState, id: string, now: number): VillageError | { level: number; endsAt: number; coins: number } {
  const v = content.village;
  const h = houseDef(content, id);
  if (!v || !h) return 'unknown_house';
  if (!houseOpen(content, state, id) || state.player.level < v.upgradeFromLevel) return 'locked';
  settleBuildings(content, state, now);
  const b = state.buildings[id];
  if (b && b.upgradeEndsAt !== null && b.upgradeEndsAt > now) return 'busy';
  const cost = nextHouseCost(content, state, id);
  if (!cost) return 'house_max_level';
  if (upgrading(state, now).length >= buildSlots(content, state)) return 'no_build_slot';
  if (state.player.coins < cost.coins) return 'not_enough_coins';
  if (!canAfford(state, { coins: 0, items: cost.items })) return 'not_enough_items';
  state.player.coins -= cost.coins;
  for (const [it, q] of Object.entries(cost.items)) removeItem(state, it, q);
  const endsAt = now + cost.ms;
  state.buildings[id] = { level: houseLevel(state, id), upgradeEndsAt: endsAt };
  return { level: houseLevel(state, id) + 1, endsAt, coins: cost.coins };
}

/** Finishes upgrades whose time has come (offline-exact). Returns the houses that went up. */
export function settleBuildings(content: ContentPack, state: GameState, now: number): Array<{ house: string; level: number }> {
  const done: Array<{ house: string; level: number }> = [];
  for (const [id, b] of Object.entries(state.buildings)) {
    if (b.upgradeEndsAt !== null && b.upgradeEndsAt <= now) {
      b.level = Math.min(5, b.level + 1);
      b.upgradeEndsAt = null;
      done.push({ house: id, level: b.level });
    }
  }
  return done;
}

function grant(state: GameState, r: Reward): void {
  state.player.coins += r.coins ?? 0;
  state.player.gems += r.gems ?? 0;
  for (const [id, q] of Object.entries(r.items ?? {})) addItem(state, id, q);
}

/** Huy Chương Độ Cao for floors the player has opened (first time only). Returns the new ones. */
export function awardMedals(content: ContentPack, state: GameState, now: number, silent = false): Array<{ floor: number; potInstanceId?: string }> {
  const out: Array<{ floor: number; potInstanceId?: string }> = [];
  for (const m of content.village?.medals ?? []) {
    if (state.floors.length < m.floor || state.village.medals.includes(m.floor)) continue;
    state.village.medals.push(m.floor);
    if (silent) continue;
    grant(state, m);
    let potInstanceId: string | undefined;
    if (m.potRarity) {
      const pots = content.potList.filter((p) => p.rarity === m.potRarity && p.sprite.startsWith('pots/sig/')).sort((a, b) => a.id.localeCompare(b.id));
      const pot = pots[Math.floor(randomFor(state.seed, 'medal', m.floor) * pots.length)];
      if (pot) {
        const got = obtainPot(content, state, pot.id, 'event', now);
        if ('potInstanceId' in got) potInstanceId = got.potInstanceId;
      }
    }
    out.push(potInstanceId ? { floor: m.floor, potInstanceId } : { floor: m.floor });
  }
  return out;
}

export function checkInReady(content: ContentPack, state: GameState, now: number): boolean {
  return !!content.village && state.village.checkIn.day !== localDay(content, now);
}

/** Today's check-in (day k of the 7-day round, counting only days the player came). */
export function claimCheckIn(content: ContentPack, state: GameState, now: number): VillageError | { day: number; reward: Reward } {
  if (!content.village) return 'locked';
  if (!checkInReady(content, state, now)) return 'already_claimed';
  const ci = state.village.checkIn;
  const k = ci.count % 7;
  const reward = content.village.checkIn[k]!;
  grant(state, reward);
  ci.count += 1;
  ci.day = localDay(content, now);
  return { day: k + 1, reward };
}

/** Lò Gốm price of a pot after the kiln's discount (whole coins). */
export function potBuyPrice(content: ContentPack, state: GameState, price: number): number {
  return Math.round(price * (1 - houseBonus(content, state, 'kiln', 'potDiscount')));
}
