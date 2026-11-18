// Chỉ thị 10 § 3.5: Xưởng Bọ. Each machine (worked by one of the bugs) turns produce into a
// processed good. Jobs wait in a queue (2 slots, up to 4 bought with coins) and run one after the
// other: a job's end time is fixed when it is added (the end of the job before it, or now), so the
// machines keep working while the game is closed and come back exact. Finished goods go into the
// produce storage on the next command; when storage is full they wait in the machine (nothing lost).
// Stars 1–5 (bugs + coins): 5% faster each, and +5% coins/XP on orders that carry the machine's goods.

import type { ContentPack, MachineDef, RecipeDef } from '../core/content.ts';
import type { GameState, MachineState } from '../core/state.ts';
import { addItem, removeItem, storageFree } from './economy.ts';
import { levelCoins } from './coinSinks.ts';
import { houseBonus } from './village.ts';

const MIN = 60_000;

export type WorkshopError = 'unknown_machine' | 'locked' | 'queue_full' | 'not_enough_items' | 'not_enough_coins' | 'max_stars' | 'max_slots' | 'unknown_recipe';

export type WorkshopEvent =
  | { type: 'goodsMade'; machine: string; itemId: string; qty: number }
  | { type: 'jobStarted'; machine: string; recipe: string; endsAt: number }
  | { type: 'machineStar'; machine: string; stars: number }
  | { type: 'machineSlot'; machine: string; slots: number };

function rules(content: ContentPack) {
  const r = content.workshopRules;
  if (!r) throw new Error('Thiếu workshop.json');
  return r;
}

/** The saved state of a machine (created on first use). */
export function machineState(content: ContentPack, state: GameState, machineId: string): MachineState {
  return (state.workshop[machineId] ??= { stars: 1, slots: rules(content).slotsStart, queue: [] });
}

/** How long a recipe takes on a machine with these stars. */
export function jobMs(content: ContentPack, recipe: RecipeDef, stars: number): number {
  return Math.round(recipe.minutes * MIN * (1 - rules(content).starSpeed * (stars - 1)));
}

/** Coins/XP bonus on an order that carries goods of this machine (+5% a star above 1). */
export function machineOrderBonus(content: ContentPack, state: GameState, machineId: string): number {
  const m = state.workshop[machineId];
  return m ? rules(content).starOrderBonus * (m.stars - 1) : 0;
}

/** Everything a batch takes: the recipe's inputs plus the machine's worker bugs (B6, default 1). */
export function jobInputs(machine: MachineDef, recipe: RecipeDef): Record<string, number> {
  const bugs = recipe.workerBugs ?? 1;
  const out = { ...recipe.inputs };
  if (bugs > 0) out[machine.worker] = (out[machine.worker] ?? 0) + bugs;
  return out;
}

/** Adds a job: takes the produce (and the worker bugs) now, the good comes when the job ends. */
export function startJob(content: ContentPack, state: GameState, recipeId: string, now: number): WorkshopError | WorkshopEvent {
  const hit = content.recipes?.get(recipeId);
  if (!hit) return 'unknown_recipe';
  const { machine, recipe } = hit;
  if (state.player.level < machine.unlockLevel) return 'locked';
  const m = machineState(content, state, machine.id);
  if (m.queue.length >= queueSize(content, state, m)) return 'queue_full';
  const take = jobInputs(machine, recipe);
  for (const [id, q] of Object.entries(take)) if ((state.inventory[id] ?? 0) < q) return 'not_enough_items';
  for (const [id, q] of Object.entries(take)) removeItem(state, id, q);
  const start = Math.max(now, m.queue.at(-1)?.endsAt ?? now);
  const endsAt = start + jobMs(content, recipe, m.stars);
  m.queue.push({ recipe: recipeId, endsAt });
  return { type: 'jobStarted', machine: machine.id, recipe: recipeId, endsAt };
}

/** Moves finished jobs' goods into storage (front of each queue first), while there is room. */
export function collectWorkshop(content: ContentPack, state: GameState, now: number): WorkshopEvent[] {
  const events: WorkshopEvent[] = [];
  if (!content.recipes) return events;
  for (const [machineId, m] of Object.entries(state.workshop)) {
    while (m.queue.length > 0 && m.queue[0]!.endsAt <= now) {
      const recipe = content.recipes.get(m.queue[0]!.recipe)?.recipe;
      if (!recipe) {
        m.queue.shift();
        continue;
      }
      const item = content.items.get(recipe.output);
      if (item?.countsTowardStorage && storageFree(content, state) < 1) break;
      m.queue.shift();
      addItem(state, recipe.output, 1);
      events.push({ type: 'goodsMade', machine: machineId, itemId: recipe.output, qty: 1 });
    }
  }
  return events;
}

/** Next star's cost (coins + the machine's worker bug), or null at 5 stars. */
export function nextStarCost(content: ContentPack, machine: MachineDef, m: MachineState, level?: number): { coins: number; items: Record<string, number> } | null {
  const step = rules(content).stars[m.stars - 1];
  const extra = level === undefined ? 0 : levelCoins(content, 'machineStarU', level);
  return step ? { coins: step.coins + extra, items: { [machine.worker]: step.bugs } } : null;
}

export function upgradeMachine(content: ContentPack, state: GameState, machineId: string): WorkshopError | WorkshopEvent {
  const machine = content.machines?.get(machineId);
  if (!machine) return 'unknown_machine';
  if (state.player.level < machine.unlockLevel) return 'locked';
  const m = machineState(content, state, machineId);
  const cost = nextStarCost(content, machine, m, state.player.level);
  if (!cost) return 'max_stars';
  if (state.player.coins < cost.coins) return 'not_enough_coins';
  for (const [id, q] of Object.entries(cost.items)) if ((state.inventory[id] ?? 0) < q) return 'not_enough_items';
  state.player.coins -= cost.coins;
  for (const [id, q] of Object.entries(cost.items)) removeItem(state, id, q);
  m.stars += 1;
  return { type: 'machineStar', machine: machineId, stars: m.stars };
}

/** Coins for the next queue slot, or null at the maximum. */
export function nextSlotCost(content: ContentPack, m: MachineState, level?: number): number | null {
  const r = rules(content);
  const base = m.slots >= r.slotsMax ? undefined : r.slotCost[m.slots - r.slotsStart];
  if (base === undefined) return null;
  return level === undefined ? base : base + levelCoins(content, 'machineSlotU', level);
}

export function buyMachineSlot(content: ContentPack, state: GameState, machineId: string): WorkshopError | WorkshopEvent {
  const machine = content.machines?.get(machineId);
  if (!machine) return 'unknown_machine';
  if (state.player.level < machine.unlockLevel) return 'locked';
  const m = machineState(content, state, machineId);
  const cost = nextSlotCost(content, m, state.player.level);
  if (cost === null) return 'max_slots';
  if (state.player.coins < cost) return 'not_enough_coins';
  state.player.coins -= cost;
  m.slots += 1;
  return { type: 'machineSlot', machine: machineId, slots: m.slots };
}

/** Queue size of a machine: its slots plus the Xưởng Bọ house (chỉ thị 11 § D2). */
export function queueSize(content: ContentPack, state: GameState, m: MachineState): number {
  return m.slots + houseBonus(content, state, 'workshop', 'workshopQueue');
}
