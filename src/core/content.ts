// Content pack types, loading and validation.
// Game rules never mention a specific crop, pot or floor: everything comes from these definitions.

export type LocalizedText = { vi: string; en?: string };
export type PotStatName = 'speed' | 'yield';

export interface GameConfig {
  startingCoins: number;
  startingLevel: number;
  storageCapacity: number;
  levels: { xpBase: number; xpExponent: number; maxLevel: number; levelUpCoins: number };
  water: { remainingTimeReduction: number };
  market: { dailyPriceVariation: number };
  startFloor: string;
}

export interface FloorDef {
  id: string;
  name: LocalizedText;
  unlockLevel: number;
  unlockCost: number;
  slotCount: number;
  startingPot: string;
  sprite: string;
}

export interface UpgradeCost {
  coins: number;
  items: Record<string, number>;
}

export interface PotLevelDef {
  level: number;
  stats: Record<PotStatName, number>;
  upgradeCost: UpgradeCost | null;
}

export interface PotDef {
  id: string;
  name: LocalizedText;
  rarity: string;
  sprite: string;
  levels: PotLevelDef[];
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
  chancePerStage: number;
  lingerSeconds: number;
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
  checkFields('config', config, ['startingCoins', 'startingLevel', 'storageCapacity'], ['startFloor'], problems);

  const floors = new Map<string, FloorDef>();
  asArray('floors', raw.floors, problems).forEach((f, i) => {
    if (checkFields(`floors[${i}]`, f, ['unlockLevel', 'unlockCost', 'slotCount'], ['id', 'startingPot', 'sprite'], problems)) {
      addUnique(floors, f as unknown as FloorDef, `floors[${i}]`, problems);
    }
  });

  const pots = new Map<string, PotDef>();
  asArray('pots', raw.pots, problems).forEach((p, i) => {
    if (!checkFields(`pots[${i}]`, p, [], ['id', 'rarity', 'sprite'], problems)) return;
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
    if (!checkFields(`bugs[${i}]`, b, ['chancePerStage', 'lingerSeconds'], ['id', 'sprite'], problems)) return;
    const bug = b as unknown as BugDef;
    if (bug.chancePerStage > 1) problems.push(`bugs[${i}].chancePerStage: phải <= 1`);
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
  for (const f of floors.values()) if (!pots.has(f.startingPot)) problems.push(`tầng ${f.id}: không có chậu "${f.startingPot}"`);
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
    bugList: [...bugs.values()],
  };
}
