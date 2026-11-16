// Content pack types, loading and validation.
// Game rules never mention a specific crop, pot or floor: everything comes from these definitions.

export type LocalizedText = { vi: string; en?: string };
export type PotStatName = 'speed' | 'yield' | 'xp' | 'attract' | 'luck';
export const POT_STATS: PotStatName[] = ['speed', 'yield', 'xp', 'attract', 'luck'];

export interface GameConfig {
  startingCoins: number;
  startingLevel: number;
  storageCapacity: number;
  levels: { xpBase: number; xpExponent: number; maxLevel: number; levelUpCoins: number };
  water: { remainingTimeReduction: number };
  market: { dailyPriceVariation: number };
  startFloor: string;
  /** Pot stats are multiplied by (1 + this) when the crop's family is the pot's favoured one. */
  potAffinityBonus: number;
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

export interface PotDef {
  id: string;
  name: LocalizedText;
  rarity: string;
  sprite: string;
  /** Coins to buy one at the pot shop; null = not sold. */
  price: number | null;
  unlockLevel: number;
  favoredFamily: string | null;
  levels: PotLevelDef[];
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

export interface ItemDef {
  id: string;
  name: LocalizedText;
  kind: 'produce' | 'bug';
  sellPrice: number | null;
  countsTowardStorage: boolean;
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
  potList: PotDef[];
  bugList: BugDef[];
}

export interface RawContent {
  contentVersion: number;
  config: unknown;
  floors: unknown;
  pots: unknown;
  crops: unknown;
  bugs: unknown;
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
    files: Record<'config' | 'floors' | 'pots' | 'crops' | 'bugs', string>;
  };
  const raw: RawContent = {
    contentVersion: manifest.contentVersion,
    config: await readJson(manifest.files.config),
    floors: await readJson(manifest.files.floors),
    pots: await readJson(manifest.files.pots),
    crops: await readJson(manifest.files.crops),
    bugs: await readJson(manifest.files.bugs),
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

  const floors = new Map<string, FloorDef>();
  asArray('floors', raw.floors, problems).forEach((f, i) => {
    if (checkFields(`floors[${i}]`, f, ['unlockLevel', 'unlockCost', 'slotCount'], ['id', 'startingPot', 'sprite'], problems)) {
      if (f.trait === undefined) f.trait = null;
      addUnique(floors, f as unknown as FloorDef, `floors[${i}]`, problems);
    }
  });

  const pots = new Map<string, PotDef>();
  asArray('pots', raw.pots, problems).forEach((p, i) => {
    if (!checkFields(`pots[${i}]`, p, ['unlockLevel'], ['id', 'rarity', 'sprite'], problems)) return;
    if (isObj(p.levelRule)) p.levels = expandPotLevels(p.levelRule as unknown as PotLevelRule);
    if (p.price !== null && !(isNum(p.price) && p.price >= 0)) problems.push(`pots[${i}].price: phải là số >= 0 hoặc null`);
    if (p.favoredFamily === undefined) p.favoredFamily = null;
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

  // Anti soft-lock: a brand-new or broke player must always be able to plant something.
  if (isObj(config) && isNum(config.startingLevel) && ![...crops.values()].some((c) => c.unlockLevel <= config.startingLevel && c.seedPrice === 0)) {
    problems.push('crops: cần ít nhất một cây miễn phí (seedPrice = 0) mở từ cấp khởi đầu, để người chơi không bao giờ kẹt');
  }

  // Cross references.
  if (isObj(config) && !floors.has(config.startFloor)) problems.push(`config.startFloor: không có tầng "${config.startFloor}"`);
  for (const f of floors.values()) {
    if (!pots.has(f.startingPot)) problems.push(`tầng ${f.id}: không có chậu "${f.startingPot}"`);
    if (f.trait && !POT_STATS.includes(f.trait.stat)) problems.push(`tầng ${f.id}: đặc tính "${f.trait.stat}" không hợp lệ`);
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

  if (problems.length > 0) throw new ContentError(problems);
  return {
    contentVersion: raw.contentVersion,
    config,
    floors,
    pots,
    crops,
    bugs,
    items,
    cropList: [...crops.values()],
    floorList: [...floors.values()].sort((a, b) => a.unlockLevel - b.unlockLevel),
    potList: [...pots.values()],
    bugList: [...bugs.values()],
  };
}
