// Quest engine (đợt 2). Reads quests from content (quests.json) and advances them from the
// events of each command, the same way daily missions do. Counted quests store progress;
// "measure" quests read the save (level, floors…) and store nothing. Weekly and monthly tracks
// draw their quests once per period (Vietnam time) and keep that draw for the whole period.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import type { GameEvent } from '../core/game.ts';
import type { QuestDef, QuestMeasure, QuestReward, QuestTrigger, TrackDef } from '../core/questdefs.ts';
import { tidy } from '../core/income.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';

const DAY_MS = 86_400_000;

export interface QuestState {
  /** Counted progress per quest id (cumulative for tiered quests). */
  progress: Record<string, number>;
  /** Tiers claimed per quest id (1 = a one-off quest is done). */
  claims: Record<string, number>;
  /** Weekly / monthly draws: period key, the quests drawn, the player level at the draw. */
  periods: Record<string, { key: number; picks: string[]; level: number }>;
}

export function emptyQuestState(): QuestState {
  return { progress: {}, claims: {}, periods: {} };
}

// --- Periods ---------------------------------------------------------------------------------

/** Week number, weeks starting Monday 00:00 local time. */
export function weekKey(content: ContentPack, now: number): number {
  return Math.floor((localDay(content, now) + 3) / 7);
}

/** Month number (year × 12 + month) in local time. */
export function monthKey(content: ContentPack, now: number): number {
  const d = new Date(now + content.missions.utcOffsetHours * 3_600_000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function periodKey(content: ContentPack, track: TrackDef, now: number): number {
  return track.reset === 'month' ? monthKey(content, now) : weekKey(content, now);
}

/** Game time when the current period of a track ends. */
export function periodEndsAt(content: ContentPack, track: TrackDef, now: number): number {
  const off = content.missions.utcOffsetHours * 3_600_000;
  if (track.reset === 'month') {
    const k = monthKey(content, now) + 1;
    return Date.UTC(Math.floor(k / 12), k % 12, 1) - off;
  }
  return ((weekKey(content, now) + 1) * 7 - 3) * DAY_MS - off;
}

/** Draws this period's quests for every reset track whose period changed. */
export function ensureQuestPeriods(content: ContentPack, state: GameState, now: number): void {
  // A raw old save used without reconcile (tests, tools) simply starts with no quest progress.
  state.quests ??= emptyQuestState();
  state.tutorials ??= [];
  for (const track of content.questTracks.values()) {
    if (!track.reset) continue;
    const key = periodKey(content, track, now);
    const order = (qs: QuestDef[]) => qs.map((q) => ({ q, k: randomFor(state.seed, 'quest', track.id, key, q.id) })).sort((a, b) => a.k - b.k).map(({ q }) => q.id);
    const pool = content.questList.filter((q) => q.track === track.id && (q.minLevel ?? 1) <= state.player.level);
    const cur = state.quests.periods[track.id];
    if (cur?.key === key) {
      // Same period: a low-level player who drew fewer than `pick` gets more as levels open them;
      // quests already drawn are never swapped.
      const room = (track.pick ?? 0) - cur.picks.length;
      if (room > 0) cur.picks.push(...order(pool.filter((q) => !cur.picks.includes(q.id))).slice(0, room));
      continue;
    }
    for (const q of content.questList) {
      if (q.track !== track.id) continue;
      delete state.quests.progress[q.id];
      delete state.quests.claims[q.id];
    }
    const picks = order(pool).slice(0, track.pick ?? 0);
    state.quests.periods[track.id] = { key, picks, level: state.player.level };
  }
}

// --- Targets, progress, visibility -------------------------------------------------------------

export function measureValue(state: GameState, m: QuestMeasure): number {
  switch (m) {
    case 'level':
      return state.player.level;
    case 'floors':
      return state.floors.length;
    case 'stars':
      return state.floors.reduce((a, f) => a + f.stars, 0);
    case 'potLines':
      return Object.keys(state.potBook).length;
    case 'cropKinds':
      return Object.values(state.journal).filter((j) => j.harvests > 0).length;
    case 'maxPotLevel':
      return Math.max(0, ...Object.values(state.pots).map((p) => p.level));
    case 'storageTier':
      return state.upgrades.storage;
    case 'totalHarvests':
      return state.stats.harvests;
    case 'bestFriendship':
      return Math.max(0, ...Object.values(state.neighbors).map((n) => n.friendship));
  }
}

/** Tiers claimed so far. */
export function questClaims(state: GameState, id: string): number {
  return state.quests.claims[id] ?? 0;
}

/** Target of the next tier, or null when the quest has nothing more to give. */
export function questTarget(content: ContentPack, state: GameState, q: QuestDef): number | null {
  const c = questClaims(state, q.id);
  if (q.tiers) {
    if ('targets' in q.tiers) return q.tiers.targets[c] ?? null;
    return Math.round(q.tiers.base * Math.pow(q.tiers.growth ?? 1, c) + (q.tiers.step ?? 0) * c);
  }
  if (c >= 1) return null;
  if (typeof q.target === 'number') return q.target;
  const t = q.target!;
  const level = state.quests.periods[q.track]?.level ?? state.player.level;
  return Math.max(1, Math.round(t.base + t.perLevel * level));
}

export function questProgress(state: GameState, q: QuestDef): number {
  return q.measure ? measureValue(state, q.measure) : (state.quests.progress[q.id] ?? 0);
}

/** A quest the player can work on now (chain step reached, level met, drawn this period). */
export function questActive(content: ContentPack, state: GameState, q: QuestDef): boolean {
  const track = content.questTracks.get(q.track);
  if (!track) return false;
  if (track.reset && !state.quests.periods[track.id]?.picks.includes(q.id)) return false;
  if ((q.minLevel ?? 1) > state.player.level) return false;
  return (q.requires ?? []).every((r) => questClaims(state, r) > 0);
}

export interface QuestView {
  def: QuestDef;
  progress: number;
  /** Target of the next tier (null: all done). */
  target: number | null;
  tier: number;
  claimable: boolean;
  done: boolean;
}

export function questView(content: ContentPack, state: GameState, q: QuestDef): QuestView {
  const target = questTarget(content, state, q);
  const progress = questProgress(state, q);
  return { def: q, progress, target, tier: questClaims(state, q.id), claimable: target !== null && progress >= target, done: target === null };
}

/** Quests to show in a track's tab: active ones, plus (for chains) the ones already done. */
export function trackQuests(content: ContentPack, state: GameState, trackId: string): QuestView[] {
  return content.questList
    .filter((q) => q.track === trackId && (questActive(content, state, q) || questClaims(state, q.id) > 0))
    .map((q) => questView(content, state, q))
    .filter((v) => !v.def.hidden || v.claimable || v.tier > 0);
}

/** Quests with a reward waiting (HUD badge). */
export function questsReady(content: ContentPack, state: GameState): number {
  return content.questList.filter((q) => questActive(content, state, q) && questView(content, state, q).claimable).length;
}

/** The quest the HUD tracker follows: the first open newbie step, else the best claimable one,
 *  else the active quest closest to done. */
export function trackedQuest(content: ContentPack, state: GameState): QuestView | null {
  const active = content.questList.filter((q) => !q.hidden && questActive(content, state, q)).map((q) => questView(content, state, q)).filter((v) => !v.done);
  const chain = active.find((v) => content.questTracks.get(v.def.track)?.skipAtLevel !== undefined);
  if (chain) return chain;
  const ready = active.find((v) => v.claimable);
  if (ready) return ready;
  return active.sort((a, b) => b.progress / (b.target ?? 1) - a.progress / (a.target ?? 1))[0] ?? null;
}

// --- Counting events -----------------------------------------------------------------------

interface Hit {
  trigger: QuestTrigger;
  amount: number;
  cropId?: string;
  family?: string;
  mutation?: string;
  rarity?: string;
  floor?: number;
}

function cropOfItem(content: ContentPack, itemId: string) {
  const base = content.items.get(itemId)?.baseItem ?? itemId.split('~')[0]!;
  return content.cropList.find((c) => c.produce.id === base);
}

function hitsOf(content: ContentPack, state: GameState, e: GameEvent): Hit[] {
  const potRarity = (instId: string) => content.pots.get(state.pots[instId]?.potId ?? '')?.rarity;
  switch (e.type) {
    case 'planted':
      return [{ trigger: 'plant', amount: 1, cropId: e.cropId, family: content.crops.get(e.cropId)?.family, floor: e.slot.floor }];
    case 'watered':
      return [{ trigger: 'water', amount: 1, floor: e.slot.floor }];
    case 'bugCaught':
      return [{ trigger: 'catchBug', amount: 1, floor: e.slot.floor }];
    case 'harvested': {
      const crop = cropOfItem(content, e.itemId);
      const base = { cropId: crop?.id, family: crop?.family, floor: e.slot.floor };
      const hits: Hit[] = [
        { trigger: 'harvest', amount: 1, ...base },
        { trigger: 'harvestQty', amount: e.qty, ...base },
      ];
      if (e.mutation) hits.push({ trigger: 'mutation', amount: 1, mutation: e.mutation, ...base });
      return hits;
    }
    case 'sold':
      return [
        { trigger: 'sell', amount: e.qty },
        { trigger: 'earnCoins', amount: e.coins },
      ];
    case 'orderDelivered':
      return [
        { trigger: 'deliverOrder', amount: 1 },
        { trigger: 'earnCoins', amount: e.coins },
      ];
    case 'potUpgraded':
      return [{ trigger: 'upgradePot', amount: 1, rarity: potRarity(e.potInstanceId) }];
    case 'potBought':
      return [{ trigger: 'buyPot', amount: 1, rarity: content.pots.get(e.potId)?.rarity }];
    case 'floorUnlocked':
      return [{ trigger: 'unlockFloor', amount: 1, floor: e.index }];
    case 'floorExpanded':
      return [{ trigger: 'expandFloor', amount: 1, floor: e.floor }];
    case 'floorStarred':
      return [{ trigger: 'starFloor', amount: 1, floor: e.floor }];
    case 'neighborHelped':
      return [{ trigger: 'helpNeighbor', amount: 1 }];
    case 'itemListed':
      return [{ trigger: 'listStall', amount: 1 }];
    case 'stallSold':
      return [
        { trigger: 'stallSold', amount: e.qty },
        { trigger: 'earnCoins', amount: e.coins },
      ];
    case 'missionClaimed':
      return [{ trigger: 'claimDaily', amount: 1 }];
    case 'journalClaimed':
      return [{ trigger: 'claimJournal', amount: 1 }];
    case 'cloudRained':
      return [{ trigger: 'cloudRain', amount: 1, floor: e.floor }];
    case 'storageUpgraded':
      return [{ trigger: 'upgradeStorage', amount: 1 }];
    case 'levelUp':
      return [{ trigger: 'levelUp', amount: 1 }];
    case 'birdFed':
      return [{ trigger: 'feedBird', amount: 1 }];
    case 'goodsMade':
      return [{ trigger: 'makeGoods', amount: e.qty }];
    case 'cloudBlown': {
      const hits: Hit[] = [{ trigger: 'blowCloud', amount: 1 }];
      if (e.chest !== undefined) hits.push({ trigger: 'openSeaChest', amount: 1 });
      if (e.cleared) hits.push({ trigger: 'clearSea', amount: 1 });
      return hits;
    }
    case 'fishReeled':
      return e.landed ? [{ trigger: 'catchFish', amount: 1 }] : [];
    case 'potCast':
      return [{ trigger: 'castPot', amount: 1 }];
    case 'potStarred':
      return [{ trigger: 'starPot', amount: 1 }];
    case 'bazaarBought':
      return [{ trigger: 'huntBazaar', amount: 1 }];
    default:
      return [];
  }
}

function matches(content: ContentPack, q: QuestDef, h: Hit, now: number): boolean {
  const f = q.filter;
  if (!f) return true;
  if (f.cropId && f.cropId !== h.cropId) return false;
  if (f.family && f.family !== h.family) return false;
  if (f.mutation && f.mutation !== h.mutation) return false;
  if (f.rarity && f.rarity !== h.rarity) return false;
  if (f.floorMin !== undefined && (h.floor ?? -1) < f.floorMin) return false;
  if (f.hours) {
    const hour = new Date(now + content.missions.utcOffsetHours * 3_600_000).getUTCHours();
    const [a, b] = f.hours;
    if (a <= b ? hour < a || hour >= b : hour < a && hour >= b) return false;
  }
  return true;
}

const TRIGGER_INDEX = new WeakMap<ContentPack, Map<QuestTrigger, QuestDef[]>>();

/** Counted quests grouped by trigger (built once per content pack). */
function questsByTrigger(content: ContentPack): Map<QuestTrigger, QuestDef[]> {
  let m = TRIGGER_INDEX.get(content);
  if (!m) {
    m = new Map();
    for (const q of content.questList) if (q.trigger) m.set(q.trigger, [...(m.get(q.trigger) ?? []), q]);
    TRIGGER_INDEX.set(content, m);
  }
  return m;
}

/** Adds one command's events to the active counted quests. Returns ids that just became claimable. */
export function recordQuests(content: ContentPack, state: GameState, events: GameEvent[], now: number): string[] {
  const done: string[] = [];
  const hits = events.flatMap((e) => hitsOf(content, state, e));
  if (hits.length === 0) return done;
  const byTrigger = questsByTrigger(content);
  const candidates = new Set(hits.flatMap((h) => byTrigger.get(h.trigger) ?? []));
  for (const q of candidates) {
    if (!questActive(content, state, q)) continue;
    const before = questView(content, state, q);
    if (before.done) continue;
    let add = 0;
    for (const h of hits) if (h.trigger === q.trigger && matches(content, q, h, now)) add += h.amount;
    if (add === 0) continue;
    const next = (state.quests.progress[q.id] ?? 0) + add;
    // One-off quests stop at their target; tiered ones keep a running total.
    state.quests.progress[q.id] = q.tiers ? next : Math.min(next, before.target ?? next);
    if (!before.claimable && questView(content, state, q).claimable) done.push(q.id);
  }
  return done;
}

/** A tier's reward, with coinsHours turned into coins at the player's level now. */
export function questReward(content: ContentPack, state: GameState, q: QuestDef): Required<Pick<QuestReward, 'coins' | 'gems' | 'xp'>> & { items: Record<string, number>; pot: string | null } {
  const r = q.reward;
  const growth = q.tiers?.rewardGrowth ?? 1;
  const k = Math.pow(growth, questClaims(state, q.id));
  const coins = tidy(((r.coins ?? 0) + (r.coinsHours ?? 0) * content.income.unit(state.player.level)) * k);
  const items = Object.fromEntries(Object.entries(r.items ?? {}).map(([id, n]) => [id, Math.max(1, Math.round(n * k))]));
  return { coins, gems: Math.round((r.gems ?? 0) * k), xp: Math.round((r.xp ?? 0) * k), items, pot: r.pot ?? null };
}

// --- Features and tutorials ------------------------------------------------------------------

export function featureOpen(content: ContentPack, state: GameState, id: string): boolean {
  const f = content.features.get(id);
  if (!f) return true;
  if (f.level !== undefined && state.player.level >= f.level) return true;
  return !!f.quest && questClaims(state, f.quest) > 0;
}

/** First open feature whose tutorial has not been seen yet. */
export function pendingTutorial(content: ContentPack, state: GameState): { featureId: string; tutorialId: string } | null {
  for (const f of content.features.values()) {
    if (f.tutorial && !state.tutorials.includes(f.tutorial) && featureOpen(content, state, f.id)) return { featureId: f.id, tutorialId: f.tutorial };
  }
  return null;
}

/** For saves made before quests existed: skip chains the player has outgrown and mark tutorials
 *  of features already open as seen, so returning players are not walked through basics. */
export function adoptQuestsForOldSave(content: ContentPack, state: GameState): void {
  for (const track of content.questTracks.values()) {
    if (track.skipAtLevel === undefined || state.player.level < track.skipAtLevel) continue;
    for (const q of content.questList) if (q.track === track.id && !q.tiers) state.quests.claims[q.id] = Math.max(1, state.quests.claims[q.id] ?? 0);
  }
  for (const f of content.features.values()) if (f.tutorial && featureOpen(content, state, f.id) && !state.tutorials.includes(f.tutorial)) state.tutorials.push(f.tutorial);
}
