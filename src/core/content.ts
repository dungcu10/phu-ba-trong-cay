// Content pack types, loading and validation.
// Game rules never mention a specific crop, pot or floor: everything comes from these definitions.

export type LocalizedText = { vi: string; en?: string };
export type PotStatName = 'speed' | 'yield' | 'xp' | 'attract' | 'luck' | 'care';
export const POT_STATS: PotStatName[] = ['speed', 'yield', 'xp', 'attract', 'luck', 'care'];

import { FloorMap, type FloorGenConfig } from './floorgen.ts';
import { IncomeModel, type IncomeConfig } from './income.ts';

export interface GameConfig {
  startingCoins: number;
  startingLevel: number;
  /** Rương Mây capacity before any upgrade. */
  storageCapacity: number;
  /** Rương Mây upgrades (no cap): each tier adds perTier slots; tier t costs firstCost × (t+1)^costExponent coins. */
  storageUpgrade: { perTier: number; firstCost: number; costExponent: number };
  /** Mưa Mây: ripens every growing crop on a floor for gems, ceil(minutes left / minutesPerGem) per pot. */
  cloudRain: { minutesPerGem: number; minGemsPerPot: number };
  /**
   * Player levels have no cap (owner decision 2026-11-17). XP to go from level L to L+1 is
   * xpBase × L^xpExponent × xpGrowth^(L−1): the compounding term makes each level a bit harder
   * than the last up to xpGrowthUntil; after that the extra factor grows linearly
   * (1 + xpLinearAfter × levels past it), so numbers stay finite and exact (plan A2). Every level-up pays coinsBase + coinsPerLevel × L; `milestones` add
   * gems and items every `every` levels (all that match apply).
   */
  levels: { xpBase: number; xpExponent: number; xpGrowth: number; xpGrowthUntil: number; xpLinearAfter: number; levelUp: LevelUpConfig };
  /** Income unit model (plan A1). */
  income: IncomeConfig;
  /** Floors above the hand-made ones (owner decision 2026-11-17: no top floor). */
  floorGen: FloorGenConfig;
  water: { remainingTimeReduction: number };
  market: { dailyPriceVariation: number };
  startFloor: string;
  /** Pot stats are multiplied by (1 + this) when the crop's family is the pot's favoured one. */
  potAffinityBonus: number;
  /** Bonus per floor star for every pot on that floor. */
  floorStarBonus?: Partial<Record<PotStatName, number>>;
  /** Highest total bonus per stat after every source is added (POT_SYSTEM 5: no endless stacking). */
  bonusCaps?: Partial<Record<PotStatName, number>>;
  /** Gems for owning N different pot lines (claimed in order). */
  collectionRewards?: Array<{ lines: number; gems: number }>;
  /** Chance per harvest to find a common upgrade material (scaled by luck). */
  harvestMaterial?: { item: string; chance: number };
}

export interface LevelUpConfig {
  /** Coins on reaching level L = coinsHours × U(L). */
  coinsHours: number;
  milestones: Array<{ every: number; gems?: number; items?: Record<string, number> }>;
}

export interface FloorDef {
  id: string;
  name: LocalizedText;
  unlockLevel: number;
  unlockCost: number;
  slotCount: number;
  startingPot: string;
  sprite: string;
  /** Environment bonus for crops of a family grown on this floor (GAMEPLAY_DESIGN 3). */
  trait: { family: string; stat: PotStatName; value: number } | null;
  /** Optional colour wash for the floor art until each floor has its own picture. */
  tint?: string;
  /** Slots a new floor starts with, the most it can be expanded to, and the coin cost of each extra slot. */
  maxSlots: number;
  expandCosts: number[];
  /** Floor stars (REDESIGN_V2 2.1): each star needs a level, coins and produce. */
  stars: Array<{ level: number; coins: number; items: Record<string, number> }>;
}

export interface PotSetDef {
  id: string;
  name: LocalizedText;
  /** Bonus for every pot on a floor holding at least `count` pots of the set (highest tier reached). */
  tiers: Array<{ count: number; stats: Partial<Record<PotStatName, number>> }>;
}

export type MissionKind = 'harvest' | 'plant' | 'water' | 'catchBug' | 'deliverOrder' | 'helpNeighbor' | 'sell';
export const MISSION_KINDS: MissionKind[] = ['harvest', 'plant', 'water', 'catchBug', 'deliverOrder', 'helpNeighbor', 'sell'];

export interface MissionDef {
  id: string;
  kind: MissionKind;
  target: number;
  name: LocalizedText;
  minLevel: number;
  reward: { coins: number; xp: number; gems: number; items?: Record<string, number> };
}

export interface MissionsConfig {
  perDay: number;
  /** Days change at local midnight of this UTC offset (Việt Nam = 7). */
  utcOffsetHours: number;
  allDone: { coins: number; xp: number; gems: number; items?: Record<string, number> };
  pool: MissionDef[];
}

export interface UpgradeCost {
  coins: number;
  items: Record<string, number>;
}

export interface PotLevelDef {
  level: number;
  stats: Partial<Record<PotStatName, number>>;
  upgradeCost: UpgradeCost | null;
}

/** Compact way to describe a pot's levels: base stats grow by perLevel × base each level. */
export interface PotLevelRule {
  maxLevel: number;
  base: Partial<Record<PotStatName, number>>;
  perLevel: number;
  coins: { base: number; growth: number };
  items: Record<string, { base: number; growth: number }>;
}

/** Where a pot line comes from (POT_SYSTEM 1). */
export type PotGroup = 'shop' | 'daily' | 'weekly' | 'monthly' | 'challenge' | 'event' | 'crafted';
export const POT_GROUPS: PotGroup[] = ['shop', 'daily', 'weekly', 'monthly', 'challenge', 'event', 'crafted'];

/** Level 1–50 growth of one pot line, expanded into explicit levels at load time (POT_SYSTEM 3). */
export interface PotGrowth {
  maxLevel: number;
  /** Levels playable in this build; the rest are designed but locked ("chưa mở"). */
  openTo: number;
  /** value(L) = from + (to - from) * ((L-1)/(max-1))^curve */
  curve: number;
  stats: Partial<Record<PotStatName, [number, number]>>;
  coins: { base: number; growth: number };
  materials: Array<{ item: string; from: number; base: number; growth: number }>;
  /** Extra items needed to reach an evolution milestone level ("5", "10", ...). */
  milestones: Record<string, Record<string, number>>;
  /** Player level needed to upgrade into each 5-level stage (index 0 = levels 1–5). */
  stagePlayerLevel: number[];
}

/** Appearance from a level on: art frame and the effect tier (0 none, 1 glow, 2 aura + sparkles). */
export interface PotLook {
  from: number;
  frame: string;
  name: LocalizedText;
  aura: 0 | 1 | 2;
}

export type PotSkillEffect =
  | { kind: 'stat'; stat: PotStatName; value: number }
  | { kind: 'doubleYield'; chance: number }
  | { kind: 'mutationBoost'; multiplier: number };

export interface PotSkill {
  id: string;
  level: number;
  name: LocalizedText;
  desc: LocalizedText;
  effect: PotSkillEffect;
}

export interface PotDef {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  group: PotGroup;
  /** How players get it, shown in the pot window and the collection. */
  source?: LocalizedText;
  rarity: string;
  sprite: string;
  /** Coins to buy one at the pot shop; null = not sold. Only shop pots may have a price. */
  price: number | null;
  unlockLevel: number;
  favoredFamily: string | null;
  /** Pot set (REDESIGN_V2 2.2), or null. */
  set: string | null;
  /** Main growth direction, for the collection and balance checks. */
  focus?: PotStatName;
  /** Line-specific upgrade material found when harvesting in a pot of this line. */
  shard?: { item: string; chance: number };
  /** How a non-shop pot is obtained by exchange (mission seals, crafting recipe). */
  exchange?: { items: Record<string, number> };
  levels: PotLevelDef[];
  /**
   * Directive 04: replaced by a newer line. Hidden from the shop, the collection list and
   * neighbours' gardens, never sold, but still loadable so owned pots keep working.
   */
  retired?: boolean;
  /** Shop group shown as a header in the pot shop (e.g. "Đồ ăn"), or absent. */
  theme?: string;
  /** Highest level that can be reached in this build. */
  openTo: number;
  /** Player level needed to upgrade TO each level (index = level - 1). */
  levelReq: number[];
  looks: PotLook[];
  skills: PotSkill[];
}

/** Directive 04: sold in the pot shop for coins (retired lines are not). */
export function isSoldInShop(d: PotDef): d is PotDef & { price: number } {
  return d.price !== null && d.group === 'shop' && !d.retired;
}

/** Expands a 50-level growth rule into explicit levels (POT_SYSTEM 3). Costs are rounded. */
export function expandPotGrowth(g: PotGrowth): PotLevelDef[] {
  const levels: PotLevelDef[] = [];
  for (let lv = 1; lv <= g.maxLevel; lv++) {
    const k = g.maxLevel > 1 ? Math.pow((lv - 1) / (g.maxLevel - 1), g.curve) : 1;
    const stats: Partial<Record<PotStatName, number>> = {};
    for (const [stat, [a, b]] of Object.entries(g.stats) as Array<[PotStatName, [number, number]]>) {
      const v = Math.round((a + (b - a) * k) * 1000) / 1000;
      if (v > 0) stats[stat] = v;
    }
    let upgradeCost: UpgradeCost | null = null;
    if (lv > 1) {
      const items: Record<string, number> = {};
      for (const m of g.materials) if (lv >= m.from) items[m.item] = Math.max(1, Math.round(m.base * Math.pow(m.growth, lv - m.from)));
      for (const [id, q] of Object.entries(g.milestones[String(lv)] ?? {})) items[id] = (items[id] ?? 0) + q;
      upgradeCost = { coins: Math.round(g.coins.base * Math.pow(g.coins.growth, lv - 2)), items };
    }
    levels.push({ level: lv, stats, upgradeCost });
  }
  return levels;
}

/** Expands a level rule into explicit levels (rounded so displays stay tidy). */
export function expandPotLevels(rule: PotLevelRule): PotLevelDef[] {
  const levels: PotLevelDef[] = [];
  for (let lv = 1; lv <= rule.maxLevel; lv++) {
    const stats: Partial<Record<PotStatName, number>> = {};
    for (const [k, v] of Object.entries(rule.base)) stats[k as PotStatName] = Math.round(v * (1 + rule.perLevel * (lv - 1)) * 1000) / 1000;
    const upgradeCost =
      lv === 1
        ? null
        : {
            coins: Math.round(rule.coins.base * Math.pow(rule.coins.growth, lv - 2)),
            items: Object.fromEntries(Object.entries(rule.items).map(([id, c]) => [id, Math.round(c.base * Math.pow(c.growth, lv - 2))])),
          };
    levels.push({ level: lv, stats, upgradeCost });
  }
  return levels;
}

export interface CropDef {
  id: string;
  name: LocalizedText;
  family: string;
  unlockLevel: number;
  seedPrice: number;
  growSeconds: number;
  regrowSeconds: number | null;
  harvests: number;
  yield: number;
  sellPrice: number;
  xp: number;
  stages: number;
  produce: { id: string; name: LocalizedText };
  sprite: string;
}

export interface BugDef {
  id: string;
  name: LocalizedText;
  /** On average one bug per this many seconds of (unmodified) growing time. */
  growSecondsPerBug: number;
  /** Most bugs one growth cycle can attract. */
  maxPerCycle: number;
  sprite: string;
}

export interface OrdersConfig {
  slots: number;
  refillSeconds: number;
  skipSeconds: number;
  skipNowGems: number;
  maxLines: number;
  rewardMultiplier: [number, number];
  xpPerCoin: number;
  rareChance: number;
  rareMultiplier: number;
  rareGems: number;
}

export interface MutationDef {
  id: string;
  name: LocalizedText;
  chance: number;
  priceMultiplier: number;
}

export interface SurprisesConfig {
  startingGems: number;
  /** Chance of a gift per 10 minutes of (unmodified) growing time, like Bọ Mây (R2). */
  giftChancePer10Min: number;
  giftChanceMax: number;
  /** Gems surprise gifts may give per local day; past it a gem gift becomes a coin gift (plan C: gift budget). */
  giftGemsPerDay: number;
  gifts: Array<{ kind: 'coins' | 'gems' | 'bug'; weight: number; perLevel?: number; min?: number; max?: number }>;
  mutations: MutationDef[];
  journal: { milestones: number[]; gems: number[] };
}

export interface BotDef {
  id: string;
  name: LocalizedText;
  portrait: string;
  traits: { diligence: number; trader: number; collector: number };
  likes: string;
  startLevel: number;
  startCoins: number;
}

export interface NeighborsConfig {
  stallSlots: number;
  maxListingQty: number;
  priceRange: [number, number];
  sessionMinutes: number;
  catchUpDays: number;
  giftChance: number;
  visitFriendship: number;
  orderFriendship: number;
  /** Helping in a neighbour's garden (water, catch a bug) while visiting. */
  help: { perBotPerDay: number; coinsBase: number; coinsPerLevel: number; xp: number; friendship: number };
  bots: BotDef[];
}

export interface MaterialDef {
  id: string;
  name: LocalizedText;
  desc: LocalizedText;
  /** Icon frame in the sprite atlas, or a built-in vector icon name ("svg:clay"). */
  icon: string;
}

export type EventPointSource = 'harvest' | 'deliverOrder' | 'missionClaimed' | 'neighborHelped';

export interface EventReward {
  coins?: number;
  gems?: number;
  items?: Record<string, number>;
  /** A pot line given to keep forever. */
  pot?: string;
}

export interface EventDef {
  id: string;
  name: LocalizedText;
  desc: LocalizedText;
  /** ISO times with offset, e.g. "2026-11-16T00:00:00+07:00"; parsed into start/end ms. */
  startsAt: string;
  endsAt: string;
  start: number;
  end: number;
  points: Partial<Record<EventPointSource, number>>;
  milestones: Array<{ points: number; reward: EventReward }>;
}

export interface ItemDef {
  id: string;
  name: LocalizedText;
  kind: 'produce' | 'bug' | 'material';
  sellPrice: number | null;
  countsTowardStorage: boolean;
  /** For mutated produce: the mutation and the normal item it is a variant of. */
  mutation?: string;
  baseItem?: string;
}

export interface ContentPack {
  contentVersion: number;
  config: GameConfig;
  floors: Map<string, FloorDef>;
  pots: Map<string, PotDef>;
  crops: Map<string, CropDef>;
  bugs: Map<string, BugDef>;
  items: Map<string, ItemDef>;
  cropList: CropDef[];
  /** Floors in the order they unlock (bottom to top). */
  floorList: FloorDef[];
  /** U(L), coins per hour of diligent play at level L (plan A1). */
  income: IncomeModel;
  potList: PotDef[];
  orders: OrdersConfig;
  surprises: SurprisesConfig;
  neighbors: NeighborsConfig;
  bots: Map<string, BotDef>;
  bugList: BugDef[];
  potSets: Map<string, PotSetDef>;
  missions: MissionsConfig;
  materials: Map<string, MaterialDef>;
  events: EventDef[];
}

export interface RawContent {
  contentVersion: number;
  config: unknown;
  floors: unknown;
  pots: unknown;
  crops: unknown;
  bugs: unknown;
  orders: unknown;
  surprises: unknown;
  neighbors: unknown;
  potsets: unknown;
  missions: unknown;
  materials: unknown;
  events: unknown;
}

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Gói nội dung không hợp lệ:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

type ReadJson = (relativePath: string) => Promise<unknown>;

/** Loads a pack through a reader (fetch in the browser, fs in tests/tools). */
export async function loadContentPack(readJson: ReadJson): Promise<ContentPack> {
  const manifest = (await readJson('manifest.json')) as {
    contentVersion: number;
    files: Record<'config' | 'floors' | 'pots' | 'crops' | 'bugs' | 'orders' | 'surprises' | 'neighbors' | 'potsets' | 'missions' | 'materials' | 'events', string>;
  };
  const raw: RawContent = {
    contentVersion: manifest.contentVersion,
    config: await readJson(manifest.files.config),
    floors: await readJson(manifest.files.floors),
    pots: await readJson(manifest.files.pots),
    crops: await readJson(manifest.files.crops),
    bugs: await readJson(manifest.files.bugs),
    orders: await readJson(manifest.files.orders),
    surprises: await readJson(manifest.files.surprises),
    neighbors: await readJson(manifest.files.neighbors),
    potsets: await readJson(manifest.files.potsets),
    missions: await readJson(manifest.files.missions),
    materials: await readJson(manifest.files.materials),
    events: await readJson(manifest.files.events),
  };
  return buildContentPack(raw);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function checkFields(where: string, obj: unknown, nums: string[], strs: string[], problems: string[]): obj is Record<string, unknown> {
  if (!isObj(obj)) {
    problems.push(`${where}: phải là object`);
    return false;
  }
  for (const k of nums) if (!isNum(obj[k]) || (obj[k] as number) < 0) problems.push(`${where}.${k}: phải là số >= 0`);
  for (const k of strs) if (!isStr(obj[k])) problems.push(`${where}.${k}: phải là chuỗi khác rỗng`);
  if (!isObj(obj.name) && strs.includes('id')) problems.push(`${where}.name: thiếu tên hiển thị`);
  return true;
}

function asArray(where: string, v: unknown, problems: string[]): unknown[] {
  if (!Array.isArray(v)) {
    problems.push(`${where}: phải là mảng`);
    return [];
  }
  return v;
}

function addUnique<T extends { id: string }>(map: Map<string, T>, item: T, where: string, problems: string[]): void {
  if (map.has(item.id)) problems.push(`${where}: trùng id "${item.id}"`);
  map.set(item.id, item);
}

/** Validates raw JSON and builds lookup tables. Throws ContentError listing every problem found. */
export function buildContentPack(raw: RawContent): ContentPack {
  const problems: string[] = [];
  const config = raw.config as GameConfig;
  checkFields('config', config, ['startingCoins', 'startingLevel', 'storageCapacity', 'potAffinityBonus'], ['startFloor'], problems);
  if (!isObj(config.levels) || !['xpBase', 'xpExponent', 'xpGrowth', 'xpGrowthUntil', 'xpLinearAfter'].every((k) => isNum((config.levels as unknown as Record<string, unknown>)[k]))) problems.push('config.levels: cần xpBase, xpExponent, xpGrowth, xpGrowthUntil, xpLinearAfter');
  else if (!isObj(config.levels.levelUp) || !isNum(config.levels.levelUp.coinsHours) || !Array.isArray(config.levels.levelUp.milestones)) problems.push('config.levels.levelUp: cần coinsHours, milestones');
  else config.levels.levelUp.milestones.forEach((m, i) => { if (!isNum(m.every) || m.every < 1) problems.push(`config.levels.levelUp.milestones[${i}].every: phải >= 1`); });

  const floors = new Map<string, FloorDef>();
  asArray('floors', raw.floors, problems).forEach((f, i) => {
    if (checkFields(`floors[${i}]`, f, ['unlockLevel', 'unlockCost', 'slotCount'], ['id', 'startingPot', 'sprite'], problems)) {
      if (f.trait === undefined) f.trait = null;
      if (f.maxSlots === undefined) f.maxSlots = f.slotCount;
      if (f.expandCosts === undefined) f.expandCosts = [];
      if (f.stars === undefined) f.stars = [];
      const extra = (f.maxSlots as number) - (f.slotCount as number);
      if (!isNum(f.maxSlots) || extra < 0) problems.push(`floors[${i}].maxSlots: phải >= slotCount`);
      else if (!Array.isArray(f.expandCosts) || f.expandCosts.length !== extra || !f.expandCosts.every((c) => isNum(c) && c >= 0)) problems.push(`floors[${i}].expandCosts: cần ${extra} giá xu >= 0`);
      asArray(`floors[${i}].stars`, f.stars, problems).forEach((st, j) => checkFields(`floors[${i}].stars[${j}]`, st, ['level', 'coins'], [], problems));
      addUnique(floors, f as unknown as FloorDef, `floors[${i}]`, problems);
    }
  });

  const pots = new Map<string, PotDef>();
  asArray('pots', raw.pots, problems).forEach((p, i) => {
    if (!checkFields(`pots[${i}]`, p, ['unlockLevel'], ['id', 'rarity', 'sprite'], problems)) return;
    if (isObj(p.levelRule)) p.levels = expandPotLevels(p.levelRule as unknown as PotLevelRule);
    const growth = isObj(p.growth) ? (p.growth as unknown as PotGrowth) : null;
    if (growth) {
      p.levels = expandPotGrowth(growth);
      if (!(growth.openTo >= 1 && growth.openTo <= growth.maxLevel)) problems.push(`pots[${i}].growth.openTo: phải từ 1 đến maxLevel`);
    }
    const nLevels = Array.isArray(p.levels) ? p.levels.length : 0;
    p.openTo = growth ? growth.openTo : nLevels;
    p.levelReq = Array.from({ length: nLevels }, (_, j) => (growth ? growth.stagePlayerLevel[Math.floor(j / 5)] ?? 1 : 1));
    if (p.group === undefined) p.group = 'shop';
    if (!POT_GROUPS.includes(p.group as PotGroup)) problems.push(`pots[${i}].group: "${String(p.group)}" không hợp lệ`);
    if (p.group !== 'shop' && p.price !== null && p.price !== undefined) problems.push(`pots[${i}]: chậu ${String(p.group)} không được bán bằng xu`);
    if (p.looks === undefined) p.looks = [];
    if (p.skills === undefined) p.skills = [];
    (p.looks as PotLook[]).forEach((l, j, all) => {
      if (j === 0 && l.from !== 1) problems.push(`pots[${i}].looks: ngoại hình đầu tiên phải từ cấp 1`);
      if (j > 0 && l.from <= all[j - 1]!.from) problems.push(`pots[${i}].looks[${j}].from: phải tăng dần`);
    });
    for (const sk of p.skills as PotSkill[]) if (!(sk.level >= 1 && sk.level <= nLevels)) problems.push(`pots[${i}].skills ${sk.id}: cấp ngoài khoảng`);
    if (p.price !== null && !(isNum(p.price) && p.price >= 0)) problems.push(`pots[${i}].price: phải là số >= 0 hoặc null`);
    if (p.retired !== undefined && typeof p.retired !== 'boolean') problems.push(`pots[${i}].retired: phải là true/false`);
    if (p.theme !== undefined && !isStr(p.theme)) problems.push(`pots[${i}].theme: phải là chuỗi`);
    if (p.favoredFamily === undefined) p.favoredFamily = null;
    if (p.set === undefined) p.set = null;
    const levels = asArray(`pots[${i}].levels`, p.levels, problems) as PotLevelDef[];
    if (levels.length === 0) problems.push(`pots[${i}].levels: cần ít nhất 1 cấp`);
    levels.forEach((lv, j) => {
      if (lv.level !== j + 1) problems.push(`pots[${i}].levels[${j}].level: phải bằng ${j + 1}`);
      if (j > 0 && !lv.upgradeCost) problems.push(`pots[${i}].levels[${j}]: thiếu upgradeCost`);
    });
    addUnique(pots, p as unknown as PotDef, `pots[${i}]`, problems);
  });

  const items = new Map<string, ItemDef>();
  const bugs = new Map<string, BugDef>();
  asArray('bugs', raw.bugs, problems).forEach((b, i) => {
    if (!checkFields(`bugs[${i}]`, b, ['growSecondsPerBug', 'maxPerCycle'], ['id', 'sprite'], problems)) return;
    const bug = b as unknown as BugDef;
    if (bug.growSecondsPerBug <= 0) problems.push(`bugs[${i}].growSecondsPerBug: phải > 0`);
    addUnique(bugs, bug, `bugs[${i}]`, problems);
    addUnique(items, { id: bug.id, name: bug.name, kind: 'bug', sellPrice: null, countsTowardStorage: false }, `bugs[${i}]`, problems);
  });

  const crops = new Map<string, CropDef>();
  asArray('crops', raw.crops, problems).forEach((c, i) => {
    const where = `crops[${i}]`;
    if (!checkFields(where, c, ['unlockLevel', 'seedPrice', 'growSeconds', 'harvests', 'yield', 'sellPrice', 'xp', 'stages'], ['id', 'family', 'sprite'], problems)) return;
    const crop = c as unknown as CropDef;
    if (crop.stages < 3) problems.push(`${where}.stages: cần ít nhất 3 giai đoạn`);
    if (crop.harvests < 1) problems.push(`${where}.harvests: phải >= 1`);
    if (crop.harvests > 1 && !isNum(crop.regrowSeconds)) problems.push(`${where}.regrowSeconds: bắt buộc khi harvests > 1`);
    // A regrow cycle runs from REGROW_FROM_STAGE (2) to the ripe stage: it needs at least one growing stage between.
    if (crop.harvests > 1 && crop.stages < 4) problems.push(`${where}.stages: cây thu nhiều lần cần ít nhất 4 giai đoạn`);
    if (crop.growSeconds <= 0) problems.push(`${where}.growSeconds: phải > 0`);
    if (!isObj(crop.produce) || !isStr(crop.produce.id)) {
      problems.push(`${where}.produce.id: thiếu`);
      return;
    }
    addUnique(crops, crop, where, problems);
    addUnique(items, { id: crop.produce.id, name: crop.produce.name, kind: 'produce', sellPrice: crop.sellPrice, countsTowardStorage: true }, `${where}.produce`, problems);
  });

  const materials = new Map<string, MaterialDef>();
  asArray('materials', raw.materials, problems).forEach((m, i) => {
    if (!checkFields(`materials[${i}]`, m, [], ['id', 'icon'], problems)) return;
    const mat = m as unknown as MaterialDef;
    addUnique(materials, mat, `materials[${i}]`, problems);
    addUnique(items, { id: mat.id, name: mat.name, kind: 'material', sellPrice: null, countsTowardStorage: false }, `materials[${i}]`, problems);
  });
  const events: EventDef[] = [];
  asArray('events', raw.events, problems).forEach((e, i) => {
    if (!checkFields(`events[${i}]`, e, [], ['id', 'startsAt', 'endsAt'], problems)) return;
    const ev = e as unknown as EventDef;
    ev.start = Date.parse(ev.startsAt);
    ev.end = Date.parse(ev.endsAt);
    if (!(ev.end > ev.start)) problems.push(`events[${i}]: thời gian không hợp lệ`);
    ev.milestones.forEach((m, j) => {
      if (j > 0 && m.points <= ev.milestones[j - 1]!.points) problems.push(`events[${i}].milestones[${j}]: điểm phải tăng dần`);
    });
    events.push(ev);
  });

  const orders = raw.orders as OrdersConfig;
  checkFields('orders', orders, ['slots', 'refillSeconds', 'skipSeconds', 'skipNowGems', 'maxLines', 'xpPerCoin', 'rareChance', 'rareMultiplier', 'rareGems'], [], problems);
  const surprises = raw.surprises as SurprisesConfig;
  checkFields('surprises', surprises, ['startingGems', 'giftChancePer10Min', 'giftChanceMax', 'giftGemsPerDay'], [], problems);
  for (const m of surprises?.mutations ?? []) {
    for (const crop of crops.values()) {
      addUnique(
        items,
        { id: `${crop.produce.id}~${m.id}`, name: { vi: `${crop.produce.name.vi} ${m.name.vi}` }, kind: 'produce', sellPrice: crop.sellPrice * m.priceMultiplier, countsTowardStorage: true, mutation: m.id, baseItem: crop.produce.id },
        `biến dị ${m.id}`,
        problems,
      );
    }
  }
  const neighbors = raw.neighbors as NeighborsConfig;
  checkFields('neighbors', neighbors, ['stallSlots', 'maxListingQty', 'sessionMinutes', 'catchUpDays', 'giftChance'], [], problems);
  const bots = new Map<string, BotDef>();
  asArray('neighbors.bots', neighbors?.bots, problems).forEach((b, i) => {
    if (checkFields(`neighbors.bots[${i}]`, b, ['startLevel', 'startCoins'], ['id', 'portrait', 'likes'], problems)) addUnique(bots, b as unknown as BotDef, `neighbors.bots[${i}]`, problems);
  });

  const potSets = new Map<string, PotSetDef>();
  asArray('potsets', raw.potsets, problems).forEach((ps, i) => {
    if (!checkFields(`potsets[${i}]`, ps, [], ['id'], problems)) return;
    const tiers = asArray(`potsets[${i}].tiers`, ps.tiers, problems) as PotSetDef['tiers'];
    tiers.forEach((t, j) => {
      if (!isNum(t.count) || t.count < 1 || (j > 0 && t.count <= tiers[j - 1]!.count)) problems.push(`potsets[${i}].tiers[${j}].count: phải tăng dần, >= 1`);
      for (const k of Object.keys(t.stats ?? {})) if (!POT_STATS.includes(k as PotStatName)) problems.push(`potsets[${i}].tiers[${j}]: chỉ số "${k}" không hợp lệ`);
    });
    addUnique(potSets, ps as unknown as PotSetDef, `potsets[${i}]`, problems);
  });
  const missions = raw.missions as MissionsConfig;
  if (checkFields('missions', missions, ['perDay', 'utcOffsetHours'], [], problems)) {
    const ids = new Set<string>();
    asArray('missions.pool', missions.pool, problems).forEach((m, i) => {
      if (!checkFields(`missions.pool[${i}]`, m, ['target', 'minLevel'], ['id', 'kind'], problems)) return;
      if (!MISSION_KINDS.includes(m.kind as MissionKind)) problems.push(`missions.pool[${i}].kind: "${String(m.kind)}" không hợp lệ`);
      if (ids.has(m.id as string)) problems.push(`missions.pool[${i}]: trùng id`);
      ids.add(m.id as string);
    });
    if (isObj(config) && missions.pool.filter((m) => m.minLevel <= config.startingLevel).length < missions.perDay) problems.push('missions: không đủ nhiệm vụ cho người mới');
  }

  // Anti soft-lock: a brand-new or broke player must always be able to plant something.
  if (isObj(config) && isNum(config.startingLevel) && ![...crops.values()].some((c) => c.unlockLevel <= config.startingLevel && c.seedPrice === 0)) {
    problems.push('crops: cần ít nhất một cây miễn phí (seedPrice = 0) mở từ cấp khởi đầu, để người chơi không bao giờ kẹt');
  }

  // Cross references.
  if (isObj(config) && !floors.has(config.startFloor)) problems.push(`config.startFloor: không có tầng "${config.startFloor}"`);
  for (const f of floors.values()) {
    if (!pots.has(f.startingPot)) problems.push(`tầng ${f.id}: không có chậu "${f.startingPot}"`);
    if (f.trait && !POT_STATS.includes(f.trait.stat)) problems.push(`tầng ${f.id}: đặc tính "${f.trait.stat}" không hợp lệ`);
    for (const st of f.stars) for (const id of Object.keys(st.items ?? {})) if (!items.has(id)) problems.push(`tầng ${f.id}: sao cần vật phẩm "${id}" không tồn tại`);
  }
  for (const p of pots.values()) if (p.set !== null && !potSets.has(p.set)) problems.push(`chậu ${p.id}: không có bộ "${p.set}"`);
  for (const ev of events) {
    for (const m of ev.milestones) {
      for (const id of Object.keys(m.reward.items ?? {})) if (!items.has(id)) problems.push(`sự kiện ${ev.id}: vật phẩm "${id}" không tồn tại`);
      if (m.reward.pot && pots.get(m.reward.pot)?.group !== 'event') problems.push(`sự kiện ${ev.id}: "${m.reward.pot}" không phải chậu sự kiện`);
    }
  }
  if (isObj(config) && config.harvestMaterial && !items.has(config.harvestMaterial.item)) problems.push('config.harvestMaterial: vật phẩm không tồn tại');
  for (const m of missions?.pool ?? []) for (const id of Object.keys(m.reward.items ?? {})) if (!items.has(id)) problems.push(`nhiệm vụ ${m.id}: vật phẩm "${id}" không tồn tại`);
  for (const p of pots.values()) {
    for (const id of [p.shard?.item, ...Object.keys(p.exchange?.items ?? {})]) if (id && !items.has(id)) problems.push(`chậu ${p.id}: vật phẩm "${id}" không tồn tại`);
    for (const sk of p.skills) if (sk.effect.kind === 'stat' && !POT_STATS.includes(sk.effect.stat)) problems.push(`chậu ${p.id}: kỹ năng ${sk.id} chỉ số sai`);
  }
  for (const p of pots.values()) {
    for (const lv of p.levels) for (const k of Object.keys(lv.stats)) if (!POT_STATS.includes(k as PotStatName)) problems.push(`chậu ${p.id}: chỉ số "${k}" không hợp lệ`);
  }
  for (const p of pots.values()) {
    for (const lv of p.levels) {
      for (const itemId of Object.keys(lv.upgradeCost?.items ?? {})) {
        if (!items.has(itemId)) problems.push(`chậu ${p.id} cấp ${lv.level}: vật phẩm nâng cấp "${itemId}" không tồn tại`);
      }
    }
  }

  if (!isObj(config.storageUpgrade) || !isNum(config.storageUpgrade.perTier) || !isNum(config.storageUpgrade.firstCost) || !isNum(config.storageUpgrade.costExponent)) problems.push('config.storageUpgrade: cần perTier, firstCost, costExponent');
  if (!isObj(config.income) || !(config.income.visitMinutes > 0) || !(config.income.potsPerFloor > 0) || !isNum(config.income.potBonus)) problems.push('config.income: cần visitMinutes > 0, potsPerFloor > 0, potBonus');
  for (const st of POT_STATS) if (!isNum(config.bonusCaps?.[st])) problems.push(`config.bonusCaps.${st}: cần trần cho mọi chỉ số (kế hoạch A4)`);
  if (!isObj(config.cloudRain) || !isNum(config.cloudRain.minutesPerGem) || config.cloudRain.minutesPerGem <= 0 || !isNum(config.cloudRain.minGemsPerPot)) problems.push('config.cloudRain: cần minutesPerGem > 0, minGemsPerPot');
  const fg = config.floorGen as FloorGenConfig | undefined;
  if (!isObj(fg)) problems.push('config.floorGen: thiếu quy tắc sinh tầng');
  else {
    for (const k of ['firstLevel', 'levelStep', 'levelStepGrowth', 'costHours', 'costHoursPerFloor', 'slotCount', 'maxSlots'] as const) if (!isNum(fg[k])) problems.push(`config.floorGen.${k}: phải là số`);
    for (const k of ['names', 'sprites', 'tints', 'traits', 'expandFactors', 'stars'] as const) if (!Array.isArray(fg[k]) || fg[k].length === 0) problems.push(`config.floorGen.${k}: cần danh sách`);
    if (fg.maxSlots < fg.slotCount || (fg.expandFactors?.length ?? 0) < fg.maxSlots - fg.slotCount) problems.push('config.floorGen.expandFactors: thiếu giá cho các ô thêm');
    if (!pots.has(fg.startingPot)) problems.push(`config.floorGen.startingPot: chậu "${fg.startingPot}" không tồn tại`);
    for (const t of fg.traits ?? []) if (!POT_STATS.includes(t.stat)) problems.push(`config.floorGen.traits: chỉ số "${t.stat}" sai`);
    const lastHand = Math.max(...[...floors.values()].map((f) => f.unlockLevel));
    if (fg.firstLevel <= lastHand) problems.push('config.floorGen.firstLevel: phải cao hơn tầng cuối trong floors.json');
  }

  if (problems.length > 0) throw new ContentError(problems);
  const handFloors = [...floors.values()].sort((a, b) => a.unlockLevel - b.unlockLevel);
  const income = new IncomeModel(config.income, [...crops.values()], handFloors, config.floorGen);
  return {
    contentVersion: raw.contentVersion,
    config,
    floors: new FloorMap(floors, config.floorGen, floors.size, [...crops.values()], income),
    income,
    pots,
    crops,
    bugs,
    items,
    cropList: [...crops.values()],
    floorList: [...floors.values()].sort((a, b) => a.unlockLevel - b.unlockLevel),
    potList: [...pots.values()],
    orders,
    surprises,
    neighbors,
    bots,
    bugList: [...bugs.values()],
    potSets,
    missions,
    materials,
    events,
  };
}
