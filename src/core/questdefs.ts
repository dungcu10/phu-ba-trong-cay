// Quests, features and tutorials as data (kế hoạch v3, mục B; đợt 2). Everything a quest needs —
// what counts, how much, what it pays, what it opens — lives in content/base/quests.json,
// features.json and tutorials.json. This file holds the shapes and the validator.

import type { LocalizedText } from './content.ts';

/** Things that happen in the game and can advance a counted quest (one per game event kind). */
export const QUEST_TRIGGERS = [
  'plant',
  'water',
  'catchBug',
  'harvest',
  'harvestQty',
  'mutation',
  'sell',
  'earnCoins',
  'deliverOrder',
  'upgradePot',
  'buyPot',
  'unlockFloor',
  'expandFloor',
  'starFloor',
  'helpNeighbor',
  'listStall',
  'stallSold',
  'claimDaily',
  'claimJournal',
  'cloudRain',
  'upgradeStorage',
  'levelUp',
  // Chỉ thị 10 M8: the new systems.
  'feedBird',
  'makeGoods',
  'blowCloud',
  'openSeaChest',
  'clearSea',
  'catchFish',
  'castPot',
  'starPot',
  'huntBazaar',
  // Chỉ thị 11: pets and the village.
  'petErrand',
  'feedPet',
] as const;
export type QuestTrigger = (typeof QUEST_TRIGGERS)[number];

/** Values read from the save, for quests like "reach level 10" (progress is never stored). */
export const QUEST_MEASURES = ['level', 'floors', 'stars', 'potLines', 'cropKinds', 'maxPotLevel', 'storageTier', 'totalHarvests', 'bestFriendship', 'houseUpgrades', 'pets', 'petStars', 'petLevels', 'medals'] as const;
export type QuestMeasure = (typeof QUEST_MEASURES)[number];

export interface QuestFilter {
  cropId?: string;
  family?: string;
  /** For 'mutation': which mutation (e.g. "jade"). */
  mutation?: string;
  /** Pot rarity for 'upgradePot' / 'buyPot'. */
  rarity?: string;
  /** Floor index (0 = first) at least this, for slot events. */
  floorMin?: number;
  /** Local hours [from, to) the event must happen in, e.g. [0, 4]. */
  hours?: [number, number];
}

export interface QuestReward {
  /** Coins as hours of income: × U(level when claimed) (plan A1). */
  coinsHours?: number;
  coins?: number;
  gems?: number;
  xp?: number;
  items?: Record<string, number>;
  pot?: string;
}

/** Target of a counted quest: a number, or base + perLevel × player level when the period starts. */
export type QuestTarget = number | { base: number; perLevel: number };

/** Endless tiers: target(t) = round(base × growth^t + step × t), t = tiers already claimed.
 *  Or a fixed list of targets. Each tier's reward is the reward × rewardGrowth^t. */
export type QuestTiers = { base: number; growth?: number; step?: number; rewardGrowth?: number } | { targets: number[]; rewardGrowth?: number };

export interface QuestDef {
  id: string;
  track: string;
  name: LocalizedText;
  desc?: LocalizedText;
  trigger?: QuestTrigger;
  measure?: QuestMeasure;
  filter?: QuestFilter;
  target?: QuestTarget;
  tiers?: QuestTiers;
  reward: QuestReward;
  /** Quests that must be claimed first (chains). */
  requires?: string[];
  minLevel?: number;
  /** Secret: shown only once done. */
  hidden?: boolean;
}

export interface TrackDef {
  id: string;
  name: LocalizedText;
  /** Weekly / monthly tracks draw `pick` quests from their pool each period (VN time). */
  reset?: 'week' | 'month';
  pick?: number;
  /** Saves at or above this level skip the track (newbie chain for existing players). */
  skipAtLevel?: number;
}

export interface QuestPack {
  tracks: TrackDef[];
  quests: QuestDef[];
}

export interface FeatureDef {
  id: string;
  name: LocalizedText;
  /** Open at this level, or once this quest is claimed (either is enough). */
  level?: number;
  quest?: string;
  tutorial?: string;
}

export interface TutorialDef {
  id: string;
  title: LocalizedText;
  text: LocalizedText;
  /** data-test of the button to point at. */
  target?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks quests, features and tutorials against the rest of the pack. Returns problems found. */
export function validateQuests(
  pack: QuestPack,
  features: FeatureDef[],
  tutorials: TutorialDef[],
  known: { items: (id: string) => boolean; crops: (id: string) => boolean; pots: (id: string) => boolean; families: Set<string> },
): string[] {
  const problems: string[] = [];
  const trackIds = new Set<string>();
  for (const t of pack.tracks ?? []) {
    if (!t.id || trackIds.has(t.id)) problems.push(`quests.tracks: id "${t.id}" trống hoặc trùng`);
    trackIds.add(t.id);
    if (t.reset && !['week', 'month'].includes(t.reset)) problems.push(`track ${t.id}: reset "${t.reset}" không hợp lệ`);
    if (t.reset && !(isNum(t.pick) && t.pick > 0)) problems.push(`track ${t.id}: cần pick > 0`);
  }
  const ids = new Set<string>();
  for (const q of pack.quests ?? []) {
    const at = `nhiệm vụ ${q.id}`;
    if (!q.id || ids.has(q.id)) problems.push(`${at}: id trống hoặc trùng`);
    ids.add(q.id);
    if (!trackIds.has(q.track)) problems.push(`${at}: tuyến "${q.track}" không tồn tại`);
    if (!q.name?.vi) problems.push(`${at}: thiếu tên`);
    if (!!q.trigger === !!q.measure) problems.push(`${at}: cần đúng một trong trigger hoặc measure`);
    if (q.trigger && !(QUEST_TRIGGERS as readonly string[]).includes(q.trigger)) problems.push(`${at}: trigger "${q.trigger}" không có`);
    if (q.measure && !(QUEST_MEASURES as readonly string[]).includes(q.measure)) problems.push(`${at}: measure "${q.measure}" không có`);
    if (q.target === undefined && q.tiers === undefined) problems.push(`${at}: cần target hoặc tiers`);
    if (isObj(q.target) && !(isNum(q.target.base) && isNum(q.target.perLevel))) problems.push(`${at}: target cần base, perLevel`);
    if (isNum(q.target) && q.target < 1) problems.push(`${at}: target phải >= 1`);
    if (q.tiers && 'targets' in q.tiers && !(Array.isArray(q.tiers.targets) && q.tiers.targets.length > 0 && q.tiers.targets.every((x, i, a) => isNum(x) && x >= 1 && (i === 0 || x > a[i - 1]!)))) problems.push(`${at}: tiers.targets phải tăng dần`);
    if (q.tiers && 'base' in q.tiers && !(isNum(q.tiers.base) && q.tiers.base >= 1 && ((q.tiers.growth ?? 1) > 1 || (q.tiers.step ?? 0) > 0))) problems.push(`${at}: tiers cần base >= 1 và growth > 1 hoặc step > 0`);
    const f = q.filter ?? {};
    if (f.cropId && !known.crops(f.cropId)) problems.push(`${at}: cây "${f.cropId}" không tồn tại`);
    if (f.family && !known.families.has(f.family)) problems.push(`${at}: họ cây "${f.family}" không có`);
    const r = q.reward as QuestReward | undefined;
    if (!r || typeof r !== 'object') problems.push(`${at}: thiếu phần thưởng`);
    else {
      if (!(r.coinsHours || r.coins || r.gems || r.xp || r.pot || Object.keys(r.items ?? {}).length)) problems.push(`${at}: phần thưởng rỗng`);
      for (const id of Object.keys(r.items ?? {})) if (!known.items(id)) problems.push(`${at}: vật phẩm thưởng "${id}" không tồn tại`);
      if (r.pot && !known.pots(r.pot)) problems.push(`${at}: chậu thưởng "${r.pot}" không tồn tại`);
    }
  }
  for (const q of pack.quests ?? []) for (const req of q.requires ?? []) if (!ids.has(req)) problems.push(`nhiệm vụ ${q.id}: requires "${req}" không tồn tại`);
  // No cycles in requires.
  const byId = new Map((pack.quests ?? []).map((q) => [q.id, q]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      problems.push(`nhiệm vụ: vòng lặp requires ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const r of byId.get(id)?.requires ?? []) visit(r, [...path, id]);
    state.set(id, 2);
  };
  for (const id of byId.keys()) visit(id, []);
  const tutIds = new Set(tutorials.map((t) => t.id));
  for (const t of tutorials) if (!t.title?.vi || !t.text?.vi) problems.push(`hướng dẫn ${t.id}: thiếu tiêu đề hoặc lời`);
  const featIds = new Set<string>();
  for (const f of features) {
    if (featIds.has(f.id)) problems.push(`tính năng ${f.id}: trùng`);
    featIds.add(f.id);
    if (f.level === undefined && f.quest === undefined) problems.push(`tính năng ${f.id}: cần level hoặc quest`);
    if (f.quest && !ids.has(f.quest)) problems.push(`tính năng ${f.id}: nhiệm vụ "${f.quest}" không tồn tại`);
    if (f.tutorial && !tutIds.has(f.tutorial)) problems.push(`tính năng ${f.id}: hướng dẫn "${f.tutorial}" không tồn tại`);
  }
  return problems;
}
