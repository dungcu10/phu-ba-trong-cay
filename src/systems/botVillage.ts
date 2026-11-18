// Chỉ thị 11 TỔNG § I: neighbours (BOT) have a village and pets, under the player's rules.
//
// Everything is the shared code: houses go up with village.ts (upgradeHouse / settleBuildings, the
// same costs and build times), pets with pets.ts (giftKitten, obtainPet, feedPet, ensureErrands,
// sendErrand, claimErrand). Those functions read a GameState, so a neighbour is shown to them as a
// small view of the save with its own coins, level, houses, pets and errands (`botView`). The only
// BOT-specific parts are its choices and two shortcuts: the materials a house needs from other
// systems are bought at market value (the neighbour has no such systems), and the gem-priced pets
// hatch at the pet's unlock level + 3 (neighbours have no gems).
//
// House upgrades come out of the coins a neighbour already puts into its garden ("invest"), so the
// neighbour's spending at the player's stall is unchanged.

import type { BotDef, ContentPack } from '../core/content.ts';
import type { BotState, GameState } from '../core/state.ts';
import { claimErrand, ensureErrands, feedPet, foodAt, giftKitten, newPet, obtainPet, petOf, sendErrand } from './pets.ts';
import { houseOpen, houseLevel, nextHouseCost, settleBuildings, upgradeHouse } from './village.ts';
import { marketValue } from './neighbors.ts';
import { randomFor } from '../core/rng.ts';

/** A view of the save as one neighbour (shared rules read and write through it). */
function botView(state: GameState, s: BotState): GameState {
  // Only what the shared village and pet rules read or write (kept small: 40 BOT, every session).
  return {
    seed: state.seed,
    player: { level: s.level, coins: s.coins, gems: 0, xp: 0 },
    buildings: (s.buildings ??= {}),
    pets: (s.pets ??= []),
    errands: (s.errands ??= { day: -1, rerolls: 0, list: [] }),
    inventory: {},
    neighbors: {},
    energy: { value: 0, at: 0 },
    stats: { coinsEarned: 0 },
  } as unknown as GameState;
}

/** Plans the next house: the lowest-level open house, in plot order. Null when none can go up. */
export function botNextHouse(content: ContentPack, view: GameState): string | null {
  const v = content.village;
  if (!v || view.player.level < v.upgradeFromLevel) return null;
  const list = v.houses.filter((h) => houseOpen(content, view, h.id) && nextHouseCost(content, view, h.id)).sort((a, b) => houseLevel(view, a.id) - houseLevel(view, b.id) || a.plot - b.plot);
  return list[0]?.id ?? null;
}

/**
 * A neighbour's village step when it invests in its garden: if the next house fits in `budget`,
 * it buys the materials at market value and starts the upgrade (shared upgradeHouse). Returns the
 * coins spent (0 when it did not build).
 */
export function botBuild(content: ContentPack, state: GameState, s: BotState, budget: number, at: number): number {
  const view = botView(state, s);
  settleBuildings(content, view, at);
  const id = botNextHouse(content, view);
  if (!id) return 0;
  const cost = nextHouseCost(content, view, id)!;
  const materials = Object.entries(cost.items).reduce((a, [it, q]) => a + Math.ceil(marketValue(content, it) * q), 0);
  if (cost.coins + materials > budget) return 0;
  view.inventory = { ...cost.items };
  view.player.coins = s.coins - materials;
  const r = upgradeHouse(content, view, id, at);
  if (typeof r === 'string') return 0;
  const spent = s.coins - view.player.coins;
  s.coins = view.player.coins;
  return spent;
}

/** A neighbour looks after its pets in an active session: gets them, feeds them, runs errands. */
export function botKeepPets(content: ContentPack, state: GameState, bot: BotDef, s: BotState, at: number): void {
  const rules = content.pets;
  if (!rules) return;
  const view = botView(state, s);
  settleBuildings(content, view, at);
  giftKitten(content, view, at);
  for (const sp of rules.species) {
    if (petOf(view, sp.id) || s.level < sp.unlockLevel) continue;
    if (sp.price.coins && s.coins >= sp.price.coins * 3) obtainPet(content, view, sp.id, 'coins', at);
    else if (!sp.price.coins && !sp.price.free && s.level >= sp.unlockLevel + 3) view.pets.push(newPet(sp.id, at, false));
  }
  // Feed with a crop the pet likes, else any crop the neighbour grows (from its own garden).
  const crops = content.cropList.filter((c) => c.unlockLevel <= s.level);
  for (const p of view.pets) {
    if (foodAt(content, p, at) >= 60) continue;
    const sp = rules.species.find((x) => x.id === p.species);
    const crop = crops.find((c) => sp?.likes.kinds.includes(c.family)) ?? crops[0];
    if (!crop) continue;
    view.inventory = { [crop.produce.id]: 1 };
    feedPet(content, view, p.species, crop.produce.id, at);
  }
  // Errands: collect the bags that are back, send the pets that are not walked.
  ensureErrands(content, view, at);
  view.errands.list.forEach((e, i) => {
    if (e.pet && !e.done && (e.endsAt ?? Infinity) <= at) claimErrand(content, view, i, at);
  });
  const idle = view.pets.filter((p) => !p.active && (p.awayUntil ?? 0) <= at && !view.errands.list.some((e) => e.pet === p.species && !e.done));
  for (const p of idle) {
    const open = view.errands.list.map((e, i) => ({ e, i })).filter(({ e }) => !e.pet && !e.done);
    if (open.length === 0) break;
    const fit = open.find(({ e }) => rules.errands?.list.find((d) => d.id === e.errand)?.fit.includes(p.species));
    const pick = fit ?? open[Math.floor(randomFor(state.seed, 'botErrand', bot.id, at) * open.length)]!;
    sendErrand(content, view, pick.i, p.species, at);
  }
  s.coins = view.player.coins;
  // ensureErrands lays out a new board object: keep it.
  s.errands = view.errands;
  s.pets = view.pets;
}
