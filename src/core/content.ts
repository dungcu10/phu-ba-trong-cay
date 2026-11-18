// Content pack types, loading and validation.
// Game rules never mention a specific crop, pot or floor: everything comes from these definitions.

export type LocalizedText = { vi: string; en?: string };
export type PotStatName = 'speed' | 'yield' | 'xp' | 'attract' | 'luck' | 'care';
export const POT_STATS: PotStatName[] = ['speed', 'yield', 'xp', 'attract', 'luck', 'care'];

import { FloorMap, type FloorGenConfig } from './floorgen.ts';
import { IncomeModel, type IncomeConfig } from './income.ts';
import { validateQuests, type FeatureDef, type QuestDef, type QuestPack, type TrackDef, type TutorialDef } from './questdefs.ts';

export interface GameConfig {
  /** Chỉ thị 10: night hours in local time (from ≥ from, or < to). */
  night?: { from: number; to: number };
  /** Chỉ thị 10 § 3.1: floor materials (Sợi Mây Kết, Giọt Sương Trời) found at harvest. */
  floorMaterialDrop?: { chance: number; items: string[] };
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
  /** Chỉ thị 10 § 3.1: items asked on top of the coins, to open the floor and each extra slot. */
  unlockItems?: Record<string, number>;
  expandItems?: Array<Record<string, number>>;
  /** Extra growth speed at night (device time), e.g. 0.25 on Vườn Trăng Lơ Lửng. */
  nightSpeed?: number;
  /** Bug weight multipliers on this floor (Vườn Trăng: Đom Đóm Sao ×2). */
  bugBoost?: Record<string, number>;
  /** Floor stars (REDESIGN_V2 2.1): each star needs a level, coins and produce. */
  stars: Array<{ level: number; coins: number; items: Record<string, number> }>;
}

export interface PotSetDef {
  id: string;
  name: LocalizedText;
  /** Bonus for every pot on a floor holding at least `count` pots of the set (highest tier reached). */
  tiers: Array<{ count: number; stats: Partial<Record<PotStatName, number>> }>;
}

export type MissionKind = 'harvest' | 'plant' | 'water' | 'catchBug' | 'deliverOrder' | 'helpNeighbor' | 'sell' | 'feedBird' | 'makeGoods' | 'blowCloud' | 'catchFish';
export const MISSION_KINDS: MissionKind[] = ['harvest', 'plant', 'water', 'catchBug', 'deliverOrder', 'helpNeighbor', 'sell', 'feedBird', 'makeGoods', 'blowCloud', 'catchFish'];

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
  /** `from`: first level that needs this item (chỉ thị 10 § 3.4); omitted = from level 2. */
  items: Record<string, { base: number; growth: number; from?: number }>;
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
            items: Object.fromEntries(
              Object.entries(rule.items)
                .filter(([, c]) => lv >= (c.from ?? 2))
                .map(([id, c]) => [id, Math.max(1, Math.round(c.base * Math.pow(c.growth, lv - Math.max(2, c.from ?? 2))))]),
            ),
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
  /** Chỉ thị 10 § 3.2: kinds of bug that land on this crop, with weights. */
  bugs: Array<{ id: string; weight: number }>;
}

export type BugRarity = 'common' | 'good' | 'rare' | 'epic';

export interface BugDef {
  id: string;
  name: LocalizedText;
  /**
   * Count rule, set on the first bug only (chỉ thị 10 § 3.2: the number of bugs per cycle is unchanged;
   * only their kind is now chosen): on average one bug per this many seconds of growing time.
   */
  growSecondsPerBug?: number;
  /** Most bugs one growth cycle can attract (first bug only). */
  maxPerCycle?: number;
  sprite: string;
  /** Chỉ thị 10: rarity, level it starts to appear, night only (Đom Đóm Sao), world10 art frame. */
  rarity: BugRarity;
  unlockLevel: number;
  nightOnly: boolean;
  art?: string;
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
  /** Chỉ thị 10 § 3.6 (M6): share of orders with a processed good once the Xưởng is open, rare order
   *  lifetime and extra item, more slots by level, bird escort and neighbour help from these levels. */
  goodsShare?: number;
  rareHours?: number;
  rareItems?: string[];
  extraSlots?: Array<{ level: number; slots: number }>;
  escortLevel?: number;
  helpLevel?: number;
  helpChance?: number;
  helpFriendshipBonus?: number;
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
  /** Floor on the per-harvest gift chance, so the short crops of days 1–6 still find gifts (default 0). */
  giftChanceMin?: number;
  /** Gems surprise gifts may give per local day; past it a gem gift becomes a coin gift (plan C: gift budget). */
  giftGemsPerDay: number;
  gifts: Array<{ kind: 'coins' | 'gems' | 'bug' | 'item'; weight: number; perLevel?: number; min?: number; max?: number; items?: string[] }>;
  mutations: MutationDef[];
  journal: { milestones: number[]; gems: number[] };
}

export interface BotDef {
  id: string;
  name: LocalizedText;
  /** Nickname shown under the name on the Phú Bà board (chỉ thị 07). */
  title?: LocalizedText;
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
  /** Chợ Mây (chỉ thị 07): neighbours' own stalls the player can buy from. */
  market: MarketConfig;
  bots: BotDef[];
}

export interface MarketConfig {
  /** Most items one neighbour lays out at a time. */
  perSession: number;
  /** Asking price = value × markup × (1 + 0.35 × (1 − trader)); ≥ 1.25 so buying to resell loses. */
  markup: number;
  /** Extra factor on crops the player has not unlocked yet. */
  lockedMarkup: number;
  buysPerDay: number;
  maxQty: number;
  friendship: number;
  /** Chance per active session that a neighbour restocks (traders more often). */
  restockChance: number;
  /** Reference value of items the shop does not buy (bugs, materials). */
  values: Record<string, number>;
  /** Chỉ thị 12 B6.3: BOT traders buy bugs at a low price (a floor for spare bugs). */
  bugTrader?: { factor: number; rarityValue: Partial<Record<BugRarity, number>> };
  /** Chỉ thị 10 § 3.13: newer wares (goods, Sợi Mây, Giọt Sương, minerals, bait, bugs short of Rất
   *  hiếm) neighbours may lay out from a level, and their weight in the stall pick (0 = none). */
  wares?: { weight: number; goodsWeight: number; minLevel: Record<string, number> };
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
  kind: 'produce' | 'bug' | 'material' | 'good' | 'shard' | 'fish';
  sellPrice: number | null;
  countsTowardStorage: boolean;
  /** For a pot shard (chỉ thị 12 B7): the pot it belongs to. */
  potId?: string;
  /** For mutated produce: the mutation and the normal item it is a variant of. */
  mutation?: string;
  baseItem?: string;
}

/** Chỉ thị 10 § 3.3: a bird species. */
export interface BirdDef {
  id: string;
  name: LocalizedText;
  sprite: string;
  unlockLevel: number;
  /** Crop families whose bugs it catches; empty = every family. */
  families: string[];
  nightOnly: boolean;
  rent: { days: number; coins: number } | null;
  gems: number;
  escort: { coins: number; xp: number };
}

/** Chỉ thị 10 § 3.3: rules shared by every bird. */
export interface BirdRules {
  secondBranchLevel: number;
  foodMax: number;
  foodPerHour: number;
  millet: { item: string; coins: number; food: number };
  produceFood: number;
  cycleMinutes: { level1: number; level10: number };
  lastsLongerPerLevel: number;
  levelAt: number[];
  betterBugFromLevel: number;
  betterBugChance: number;
  rentWarnMinutes: number;
  maxRarity: { default: BugRarity; nightOnly: BugRarity };
  /** Chỉ thị 11 D1: how BOTs keep birds (same rules, generated garden). */
  bots?: { growingShare: number; feedBelow: number; rentWhenCoinsTimes: number };
}

/** Chỉ thị 10 § 3.5: a Xưởng Bọ machine. */
export interface MachineDef {
  id: string;
  name: LocalizedText;
  worker: string;
  unlockLevel: number;
  recipes: RecipeDef[];
}

export interface RecipeDef {
  id: string;
  inputs: Record<string, number>;
  output: string;
  minutes: number;
  /** B6: worker bugs of the machine each batch uses (default 1). */
  workerBugs?: number;
}

/** Chỉ thị 10 § 3.5: a processed good (Hoa Sấy, Hũ Mứt, Chai Nước Ép…): sold like produce, kept in storage. */
export interface GoodDef {
  id: string;
  name: LocalizedText;
  icon: string;
  sellPrice: number;
  machine: string;
}

/** Bổ sung A6.4–A6.5: night growth of some crops, crop mastery stars, the daily hot crop. */
export interface CropExtras {
  nightGrowth: Record<string, number>;
  mastery: Array<{ harvests: number; stat: PotStatName | null; value: number }>;
  hot: { sellBonus: number; orderBonus: number };
}

/** Chỉ thị 10 § 3.8: casting crafted pots at the Lò Gốm (one recipe tier per pot rarity). */
export interface CastingRules {
  unlockLevel: number;
  perfectChance: number;
  perfectStars: number;
  starStatBonus: number;
  tiers: Array<{ rarity: string; coins: number; items: Record<string, number> }>;
  sources: Record<string, string>;
}

/** Chỉ thị 10 § 3.9: fishing. */
export interface FishExchange {
  coins?: number;
  items?: Record<string, number>;
  /** A random bug of this rarity (qty, default 1). */
  bug?: string;
  qty?: number;
}
export interface FishDef {
  id: string;
  name: LocalizedText;
  rarity: 'common' | 'good' | 'rare' | 'epic' | 'legendary';
  icon: string;
  points: number;
  holdSeconds: number;
  /** Width of the green zone (share of the tension bar) and how hard the fish pulls. */
  zone: number;
  pull: number;
  exchange: FishExchange[];
}
export interface FishingRules {
  unlockLevel: number;
  freeBaitPerDay: number;
  baits: Array<{ item: string; recipes: Array<Record<string, number>>; weights: number[] }>;
  fish: FishDef[];
  biteSeconds: [number, number];
  book: Array<{ points: number; gems?: number; items?: Record<string, number> }>;
}
/** Chỉ thị 10 § 3.11: Xu Xu, the mascot. */
export interface XuxuRules {
  rewardMinutes: number;
  reward: { coins?: number; items?: Record<string, number> };
  lines: string[];
}
/** Chỉ thị 10 § 3.10: floor decorations. */
export interface DecorRules {
  slots: number;
  floorCap: number;
  items: Record<string, { stat: PotStatName; bonus: number; price: number; unlockLevel: number }>;
}

/** Chỉ thị 12 TỔNG B7.2: pot shards, combining, pot stars. */
export interface PotStarRules {
  maxStars: number;
  duplicateShards: number;
  combineShards: number;
  starShards: number[];
  convertSources: string[];
}

/** Item id of a pot's shard. */
export const shardId = (potId: string): string => `${potId}#shard`;

/** Chỉ thị 10 § 3.7: Biển Mây Bí Ẩn. */
export interface SeaDrop {
  kind: 'empty' | 'item' | 'bug';
  weight: number;
  id?: string;
  rarity?: string;
  qty?: [number, number];
}
export interface SeaRules {
  unlockLevel: number;
  cols: number;
  rows: number;
  energy: { max: number; regenMinutes: number; daily: number; cap: number };
  /** How many 2×2 chests a map has, [min, max]. */
  chests: [number, number];
  cells: SeaDrop[];
  chest: { rolls: number; table: SeaDrop[]; potChance: number; potRarities: string[] };
  clear: { items: Record<string, number>; gems: number };
}

/** Chỉ thị 12 TỔNG B2: the Sạp Săn Hàng (8 slots, free refresh, paid reroll, Vận May pity). */
export type BazaarRarity = 'common' | 'good' | 'rare' | 'epic' | 'legendary';
export const BAZAAR_RARITIES: BazaarRarity[] = ['common', 'good', 'rare', 'epic', 'legendary'];
export interface BazaarEntry {
  pick: 'produce' | 'bug' | 'item' | 'pot';
  weight: number;
  /** item: its id. bug: its rarity. pot: which pot rarities, signature pots only. */
  id?: string;
  rarity?: string;
  rarities?: string[];
  signature?: boolean;
  qty?: [number, number];
  /** produce: crops up to this many levels above the player (for orders) may show up. */
  levelAhead?: number;
  priceFactor?: number;
  currency?: 'coins' | 'gems';
  gems?: number;
}
export interface BazaarRules {
  unlockLevel: number;
  slots: number;
  refreshHours: number;
  reroll: { baseU: number; growth: number; minCoins: number };
  pity: Array<{ rarity: BazaarRarity; at: number }>;
  wantedChance: number;
  wantedRarity: BazaarRarity;
  rarities: Array<{ id: BazaarRarity; weight: number; priceU: number }>;
  pools: Record<BazaarRarity, BazaarEntry[]>;
}
/** Chỉ thị 12 TỔNG A3: coins added on top of a price, as a factor of U(player level). 0 = old price. */
export interface LevelPricing {
  floorUnlockU: number;
  floorExpandU: number;
  machineStarU: number;
  machineSlotU: number;
  castingU: Record<string, number>;
}
export interface MarketRules {
  bazaar?: BazaarRules;
  levelPricing?: LevelPricing;
}

export interface WorkshopRules {
  slotsStart: number;
  slotsMax: number;
  slotCost: number[];
  stars: Array<{ coins: number; bugs: number }>;
  starSpeed: number;
  starOrderBonus: number;
  valueCap: number;
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
  /** Chỉ thị 10: bird species and rules (§ 3.3), Xưởng Bọ machines (§ 3.5). */
  birds?: Map<string, BirdDef>;
  birdRules?: BirdRules;
  machines?: Map<string, MachineDef>;
  /** Chỉ thị 10 § 3.5: processed goods, recipes by id, workshop rules. */
  goods?: Map<string, GoodDef>;
  recipes?: Map<string, { machine: MachineDef; recipe: RecipeDef }>;
  workshopRules?: WorkshopRules;
  cropExtras?: CropExtras;
  casting?: CastingRules;
  market?: MarketRules;
  sea?: SeaRules;
  potStars?: PotStarRules;
  fishing?: FishingRules;
  fish: Map<string, FishDef>;
  decor?: DecorRules;
  xuxu?: XuxuRules;
  missions: MissionsConfig;
  materials: Map<string, MaterialDef>;
  events: EventDef[];
  /** Quests (đợt 2): tracks in display order, quests in file order. */
  questTracks: Map<string, TrackDef>;
  questList: QuestDef[];
  quests: Map<string, QuestDef>;
  /** Features that open with level or quests, in file order, and their tutorials. */
  features: Map<string, FeatureDef>;
  tutorials: Map<string, TutorialDef>;
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
  quests: unknown;
  features: unknown;
  tutorials: unknown;
  birds?: unknown;
  workshop?: unknown;
  cropExtras?: unknown;
  casting?: unknown;
  market?: unknown;
  sea?: unknown;
  potStars?: unknown;
  fishing?: unknown;
  decor?: unknown;
  xuxu?: unknown;
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
    files: Record<'config' | 'floors' | 'pots' | 'crops' | 'bugs' | 'orders' | 'surprises' | 'neighbors' | 'potsets' | 'missions' | 'materials' | 'events' | 'quests' | 'features' | 'tutorials', string> & Partial<Record<'birds' | 'workshop' | 'cropExtras' | 'casting' | 'market' | 'sea' | 'potStars' | 'fishing' | 'decor' | 'xuxu', string>>;
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
    quests: await readJson(manifest.files.quests),
    features: await readJson(manifest.files.features),
    tutorials: await readJson(manifest.files.tutorials),
    birds: manifest.files.birds ? await readJson(manifest.files.birds) : undefined,
    workshop: manifest.files.workshop ? await readJson(manifest.files.workshop) : undefined,
    cropExtras: manifest.files.cropExtras ? await readJson(manifest.files.cropExtras) : undefined,
    casting: manifest.files.casting ? await readJson(manifest.files.casting) : undefined,
    market: manifest.files.market ? await readJson(manifest.files.market) : undefined,
    sea: manifest.files.sea ? await readJson(manifest.files.sea) : undefined,
    potStars: manifest.files.potStars ? await readJson(manifest.files.potStars) : undefined,
    fishing: manifest.files.fishing ? await readJson(manifest.files.fishing) : undefined,
    decor: manifest.files.decor ? await readJson(manifest.files.decor) : undefined,
    xuxu: manifest.files.xuxu ? await readJson(manifest.files.xuxu) : undefined,
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
      const itemsOk = (v: unknown) => isObj(v) && Object.values(v).every((q) => isNum(q) && q > 0);
      if (f.unlockItems !== undefined && !itemsOk(f.unlockItems)) problems.push(`floors[${i}].unlockItems: cần số lượng > 0`);
      if (f.expandItems !== undefined && (!Array.isArray(f.expandItems) || f.expandItems.length !== extra || !f.expandItems.every(itemsOk))) problems.push(`floors[${i}].expandItems: cần ${extra} mục`);
      if (f.nightSpeed !== undefined && (!isNum(f.nightSpeed) || f.nightSpeed < 0)) problems.push(`floors[${i}].nightSpeed: phải >= 0`);
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
    if (!checkFields(`bugs[${i}]`, b, i === 0 ? ['growSecondsPerBug', 'maxPerCycle', 'unlockLevel'] : ['unlockLevel'], ['id', 'sprite', 'rarity'], problems)) return;
    const bug = b as unknown as BugDef;
    if (i === 0 && !(bug.growSecondsPerBug! > 0)) problems.push(`bugs[${i}].growSecondsPerBug: phải > 0`);
    if (!['common', 'good', 'rare', 'epic'].includes(bug.rarity)) problems.push(`bugs[${i}].rarity: không hợp lệ`);
    bug.nightOnly = bug.nightOnly === true;
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
  // Chỉ thị 10 § 3.2: every crop names its bugs; every id exists; each has at least one common bug.
  for (const crop of crops.values()) {
    const where = `crop ${crop.id}.bugs`;
    if (!Array.isArray(crop.bugs) || crop.bugs.length === 0) {
      problems.push(`${where}: thiếu danh sách bọ`);
      continue;
    }
    for (const b of crop.bugs) {
      if (!bugs.has(b.id)) problems.push(`${where}: không có bọ ${b.id}`);
      if (!(b.weight > 0)) problems.push(`${where}: trọng số của ${b.id} phải > 0`);
    }
    if (!crop.bugs.some((b) => bugs.get(b.id)?.rarity === 'common')) problems.push(`${where}: cần ít nhất 1 loại bọ Thường`);
  }

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
  if (surprises.giftChanceMin !== undefined && !(surprises.giftChanceMin >= 0 && surprises.giftChanceMin <= 1)) problems.push('surprises.giftChanceMin: 0 – 1');
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
  checkFields('neighbors.market', neighbors?.market, ['perSession', 'markup', 'lockedMarkup', 'buysPerDay', 'maxQty', 'friendship', 'restockChance'], [], problems);
  if (neighbors?.market && neighbors.market.markup < 1.25) problems.push('neighbors.market.markup phải ≥ 1,25 (không cho mua về bán lại có lãi)');
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

  const questPack = (isObj(raw.quests) ? raw.quests : { tracks: [], quests: [] }) as unknown as QuestPack;
  const featureList = (Array.isArray(raw.features) ? raw.features : []) as FeatureDef[];
  const tutorialList = (Array.isArray(raw.tutorials) ? raw.tutorials : []) as TutorialDef[];
  if (!Array.isArray(questPack.tracks) || !Array.isArray(questPack.quests)) problems.push('quests.json: cần tracks và quests');
  else
    problems.push(
      ...validateQuests(questPack, featureList, tutorialList, {
        items: (id) => items.has(id),
        crops: (id) => crops.has(id),
        pots: (id) => pots.has(id),
        families: new Set([...crops.values()].map((c) => c.family)),
      }),
    );

  // Chỉ thị 10 § 3.3: birds.
  let birds: Map<string, BirdDef> | undefined;
  let birdRules: BirdRules | undefined;
  if (isObj(raw.birds)) {
    birds = new Map();
    const rb = raw.birds as { species?: unknown; rules?: BirdRules };
    asArray('birds.species', rb.species, problems).forEach((b, i) => {
      if (!checkFields(`birds.species[${i}]`, b, ['unlockLevel', 'gems'], ['id', 'sprite'], problems)) return;
      const def = b as unknown as BirdDef;
      for (const f of def.families ?? []) if (![...crops.values()].some((c) => c.family === f)) problems.push(`birds.species[${i}]: hệ "${f}" không có cây nào`);
      addUnique(birds!, def, `birds.species[${i}]`, problems);
    });
    birdRules = rb.rules;
    if (!birdRules || !isNum(birdRules.foodPerHour) || !Array.isArray(birdRules.levelAt) || birdRules.levelAt.length !== 10) problems.push('birds.rules: thiếu hoặc sai (levelAt cần 10 mốc)');
    else if (!materials.has(birdRules.millet.item)) problems.push(`birds.rules.millet.item: "${birdRules.millet.item}" không tồn tại`);
  }

  // Chỉ thị 10 § 3.5: Xưởng Bọ (machines, recipes, processed goods).
  let machines: Map<string, MachineDef> | undefined;
  let goods: Map<string, GoodDef> | undefined;
  let recipes: Map<string, { machine: MachineDef; recipe: RecipeDef }> | undefined;
  let workshopRules: WorkshopRules | undefined;
  if (isObj(raw.workshop)) {
    const rw = raw.workshop as { machines?: unknown; goods?: unknown; rules?: WorkshopRules };
    machines = new Map();
    goods = new Map();
    recipes = new Map();
    workshopRules = rw.rules;
    asArray('workshop.goods', rw.goods, problems).forEach((g, i) => {
      if (!checkFields(`workshop.goods[${i}]`, g, ['sellPrice'], ['id', 'icon', 'machine'], problems)) return;
      const def = g as unknown as GoodDef;
      addUnique(goods!, def, `workshop.goods[${i}]`, problems);
      addUnique(items, { id: def.id, name: def.name, kind: 'good', sellPrice: def.sellPrice, countsTowardStorage: true }, `workshop.goods[${i}]`, problems);
    });
    asArray('workshop.machines', rw.machines, problems).forEach((m, i) => {
      if (!checkFields(`workshop.machines[${i}]`, m, ['unlockLevel'], ['id', 'worker'], problems)) return;
      const def = m as unknown as MachineDef;
      if (!bugs.has(def.worker)) problems.push(`workshop.machines[${i}].worker: "${def.worker}" không phải bọ`);
      addUnique(machines!, def, `workshop.machines[${i}]`, problems);
      for (const r of asArray(`workshop.machines[${i}].recipes`, def.recipes, problems) as unknown as RecipeDef[]) {
        for (const id of Object.keys(r.inputs ?? {})) if (!items.has(id)) problems.push(`${r.id}: đầu vào "${id}" không tồn tại`);
        if (!items.has(r.output)) problems.push(`${r.id}: thành phẩm "${r.output}" không tồn tại`);
        if (!isNum(r.minutes) || r.minutes <= 0) problems.push(`${r.id}: minutes phải > 0`);
        if (r.workerBugs !== undefined && (!Number.isInteger(r.workerBugs) || r.workerBugs < 0)) problems.push(`${r.id}: workerBugs phải là số nguyên ≥ 0`);
        // § 3.5: a good is worth at most valueCap × the produce that went in.
        const out = items.get(r.output);
        const inValue = Object.entries(r.inputs ?? {}).reduce((a, [id, q]) => a + (items.get(id)?.sellPrice ?? 0) * q, 0);
        if (out?.sellPrice && inValue > 0 && workshopRules && out.sellPrice > inValue * workshopRules.valueCap) problems.push(`${r.id}: giá thành phẩm vượt ${workshopRules.valueCap} lần đầu vào`);
        if (recipes!.has(r.id)) problems.push(`${r.id}: trùng id công thức`);
        recipes!.set(r.id, { machine: def, recipe: r });
      }
    });
    if (!workshopRules || !isNum(workshopRules.slotsStart) || !Array.isArray(workshopRules.stars) || workshopRules.stars.length !== 4) problems.push('workshop.rules: thiếu hoặc sai (stars cần 4 mốc cho sao 2–5)');
  }

  let cropExtras: CropExtras | undefined;
  if (isObj(raw.cropExtras)) {
    cropExtras = raw.cropExtras as unknown as CropExtras;
    for (const id of Object.keys(cropExtras.nightGrowth ?? {})) if (!crops.has(id)) problems.push(`crop-extras.nightGrowth: cây "${id}" không tồn tại`);
    if (!Array.isArray(cropExtras.mastery) || cropExtras.mastery.some((m, i) => !isNum(m.harvests) || (i > 0 && m.harvests <= cropExtras!.mastery[i - 1]!.harvests))) problems.push('crop-extras.mastery: mốc thu hoạch phải tăng dần');
    if (!isObj(cropExtras.hot) || !isNum(cropExtras.hot.sellBonus) || !isNum(cropExtras.hot.orderBonus)) problems.push('crop-extras.hot: cần sellBonus, orderBonus');
  }

  let casting: CastingRules | undefined;
  if (isObj(raw.casting)) {
    casting = raw.casting as unknown as CastingRules;
    for (const t of casting.tiers ?? []) for (const id of Object.keys(t.items)) if (!items.has(id)) problems.push(`casting: nguyên liệu "${id}" không tồn tại`);
    if (!isNum(casting.perfectChance) || casting.perfectChance < 0 || casting.perfectChance > 1) problems.push('casting.perfectChance: 0–1');
  }

  let potStars: PotStarRules | undefined;
  if (isObj(raw.potStars)) {
    potStars = raw.potStars as unknown as PotStarRules;
    const ps = potStars;
    if (!(ps.maxStars >= 1) || !(ps.duplicateShards >= 1) || !(ps.combineShards >= 1)) problems.push('potStars: maxStars, duplicateShards, combineShards ≥ 1');
    if (!Array.isArray(ps.starShards) || ps.starShards.length < ps.maxStars || ps.starShards.some((n) => !(n >= 1))) problems.push('potStars.starShards: đủ maxStars số ≥ 1');
    if (!Array.isArray(ps.convertSources)) problems.push('potStars.convertSources: cần danh sách');
    // One shard item per pot, kept in the Túi Nguyên Liệu.
    for (const p of pots.values()) addUnique(items, { id: shardId(p.id), name: { vi: `Mảnh ${p.name.vi}` }, kind: 'shard', sellPrice: null, countsTowardStorage: false, potId: p.id }, `potStars.${p.id}`, problems);
  }

  let fishing: FishingRules | undefined;
  const fish = new Map<string, FishDef>();
  if (isObj(raw.fishing)) {
    fishing = raw.fishing as unknown as FishingRules;
    const fr = fishing;
    for (const [i, f] of (Array.isArray(fr.fish) ? fr.fish : []).entries()) {
      if (!f.id || !f.name?.vi || !['common', 'good', 'rare', 'epic', 'legendary'].includes(f.rarity) || !(f.holdSeconds > 0) || !(f.zone > 0 && f.zone < 1) || !(f.points >= 0)) problems.push(`fishing.fish[${i}]: id, name, rarity, holdSeconds > 0, zone 0–1, points`);
      fish.set(f.id, f);
      addUnique(items, { id: f.id, name: f.name, kind: 'fish', sellPrice: null, countsTowardStorage: false }, `fishing.fish[${i}]`, problems);
    }
    if (fish.size !== 5) problems.push('fishing.fish: cần đúng 5 loại cá (5 độ hiếm)');
    for (const [i, b] of (Array.isArray(fr.baits) ? fr.baits : []).entries()) {
      if (!items.has(b.item)) problems.push(`fishing.baits[${i}]: mồi "${b.item}" không tồn tại`);
      if (!Array.isArray(b.weights) || b.weights.length !== fish.size) problems.push(`fishing.baits[${i}].weights: mỗi loại cá một trọng số`);
      for (const r of b.recipes ?? []) for (const id of Object.keys(r)) if (!items.has(id)) problems.push(`fishing.baits[${i}]: nguyên liệu "${id}" không tồn tại`);
    }
    for (const f of fish.values()) for (const ex of f.exchange ?? []) for (const id of Object.keys(ex.items ?? {})) if (!items.has(id)) problems.push(`fishing ${f.id}: món đổi "${id}" không tồn tại`);
    for (const m of fr.book ?? []) for (const id of Object.keys(m.items ?? {})) if (!items.has(id)) problems.push(`fishing.book: món "${id}" không tồn tại`);
  }
  let decor: DecorRules | undefined;
  if (isObj(raw.decor)) {
    decor = raw.decor as unknown as DecorRules;
    if (!(decor.slots >= 1) || !(decor.floorCap > 0)) problems.push('decor: slots ≥ 1, floorCap > 0');
    for (const [id, d] of Object.entries(decor.items ?? {})) {
      if (!items.has(id)) problems.push(`decor: món "${id}" không tồn tại`);
      if (!['speed', 'yield', 'xp', 'luck', 'attract', 'care'].includes(d.stat) || !(d.bonus > 0) || !(d.price >= 0)) problems.push(`decor.${id}: stat, bonus > 0, price ≥ 0`);
    }
  }

  let xuxu: XuxuRules | undefined;
  if (isObj(raw.xuxu)) {
    xuxu = raw.xuxu as unknown as XuxuRules;
    if (!(xuxu.rewardMinutes > 0) || !Array.isArray(xuxu.lines) || xuxu.lines.length === 0) problems.push('xuxu: rewardMinutes > 0 và lines');
    for (const id of Object.keys(xuxu.reward?.items ?? {})) if (!items.has(id)) problems.push(`xuxu.reward: món "${id}" không tồn tại`);
  }

  let market: MarketRules | undefined;
  if (isObj(raw.market)) {
    market = raw.market as unknown as MarketRules;
    const b = market.bazaar;
    if (b) {
      if (!(b.slots > 0) || !(b.refreshHours > 0) || !isNum(b.unlockLevel)) problems.push('market.bazaar: cần slots > 0, refreshHours > 0, unlockLevel');
      if (!isObj(b.reroll) || !isNum(b.reroll.baseU) || !(b.reroll.growth >= 1) || !isNum(b.reroll.minCoins)) problems.push('market.bazaar.reroll: cần baseU, growth ≥ 1, minCoins');
      if (!Array.isArray(b.rarities) || b.rarities.length === 0 || b.rarities.some((r) => !BAZAAR_RARITIES.includes(r.id) || !(r.weight >= 0) || !isNum(r.priceU))) problems.push('market.bazaar.rarities: id, weight ≥ 0, priceU');
      for (const p of b.pity ?? []) if (!BAZAAR_RARITIES.includes(p.rarity) || !(p.at > 0)) problems.push('market.bazaar.pity: rarity và at > 0');
      for (const [rar, list] of Object.entries(b.pools ?? {})) {
        if (!BAZAAR_RARITIES.includes(rar as BazaarRarity)) problems.push(`market.bazaar.pools: độ hiếm "${rar}" không hợp lệ`);
        for (const e of list) {
          const where = `market.bazaar.pools.${rar}`;
          if (!(e.weight > 0)) problems.push(`${where}: weight > 0`);
          if (e.pick === 'item' && (!e.id || !items.has(e.id))) problems.push(`${where}: món "${e.id}" không tồn tại`);
          if (e.pick === 'bug' && !['common', 'good', 'rare', 'epic'].includes(e.rarity ?? '')) problems.push(`${where}: bọ cần rarity`);
          if (e.pick === 'pot' && !(Array.isArray(e.rarities) && e.rarities.length > 0)) problems.push(`${where}: chậu cần rarities`);
          if (!['produce', 'bug', 'item', 'pot'].includes(e.pick)) problems.push(`${where}: pick không hợp lệ`);
          if (e.currency === 'gems' && !(e.gems! > 0)) problems.push(`${where}: trả ngọc cần gems > 0`);
          if (e.qty && !(e.qty[0] >= 1 && e.qty[1] >= e.qty[0])) problems.push(`${where}: qty [min, max]`);
        }
      }
    }
    const lp = market.levelPricing;
    if (lp && (['floorUnlockU', 'floorExpandU', 'machineStarU', 'machineSlotU'] as const).some((k) => !isNum(lp[k]) || lp[k] < 0)) problems.push('market.levelPricing: hệ số ≥ 0');
  }

  let sea: SeaRules | undefined;
  if (isObj(raw.sea)) {
    sea = raw.sea as unknown as SeaRules;
    const e = sea.energy;
    if (!(sea.cols >= 2 && sea.rows >= 2) || !isNum(sea.unlockLevel)) problems.push('sea: cần cols, rows ≥ 2 và unlockLevel');
    if (!isObj(e) || !(e.max > 0) || !(e.regenMinutes > 0) || !(e.daily >= 0) || !(e.cap >= e.max)) problems.push('sea.energy: max > 0, regenMinutes > 0, daily ≥ 0, cap ≥ max');
    if (!Array.isArray(sea.chests) || !(sea.chests[0]! >= 0 && sea.chests[1]! >= sea.chests[0]!)) problems.push('sea.chests: [min, max]');
    const drops = (list: unknown, where: string) => {
      if (!Array.isArray(list) || list.length === 0) return void problems.push(`${where}: cần danh sách`);
      for (const d of list as SeaDrop[]) {
        if (!['empty', 'item', 'bug'].includes(d.kind) || !(d.weight > 0)) problems.push(`${where}: kind và weight > 0`);
        if (d.kind === 'item' && (!d.id || !items.has(d.id))) problems.push(`${where}: món "${d.id}" không tồn tại`);
        if (d.kind === 'bug' && !['common', 'good', 'rare', 'epic'].includes(d.rarity ?? '')) problems.push(`${where}: bọ cần rarity`);
        if (d.qty && !(d.qty[0] >= 1 && d.qty[1] >= d.qty[0])) problems.push(`${where}: qty [min, max]`);
      }
    };
    drops(sea.cells, 'sea.cells');
    drops(sea.chest?.table, 'sea.chest.table');
    for (const id of Object.keys(sea.clear?.items ?? {})) if (!items.has(id)) problems.push(`sea.clear: món "${id}" không tồn tại`);
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
    birds,
    birdRules,
    machines,
    goods,
    recipes,
    workshopRules,
    cropExtras,
    casting,
    market,
    sea,
    potStars,
    fishing,
    fish,
    decor,
    xuxu,
    potSets,
    missions,
    materials,
    events,
    questTracks: new Map(questPack.tracks.map((t) => [t.id, t])),
    questList: questPack.quests,
    quests: new Map(questPack.quests.map((q) => [q.id, q])),
    features: new Map(featureList.map((f) => [f.id, f])),
    tutorials: new Map(tutorialList.map((t) => [t.id, t])),
  };
}
