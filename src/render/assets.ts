// Loads the art atlases: sprites/scene built by tools/process_art.py from the Leonardo AI images,
// and the Blender pot atlases built by tools/potgen (pots_phoenix, pots_catalog; directive 03; pots_signature; directive 04).
// Art is referenced by the "sprite" field of each content definition, so adding a crop only
// needs data plus its frames in the atlas.

import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { ContentPack, PotDef } from '../core/content.ts';
import spritesData from '../../assets/art/sprites.json';
import spritesPng from '../../assets/art/sprites.png?url';
import sceneData from '../../assets/art/scene.json';
import scenePng from '../../assets/art/scene.png?url';
import skyJpg from '../../assets/art/sky.jpg?url';
import phoenixData from '../../assets/art/pots_phoenix.json';
import phoenixWebp from '../../assets/art/pots_phoenix.webp?url';
import catalogData from '../../assets/art/pots_catalog.json';
import catalogWebp from '../../assets/art/pots_catalog.webp?url';
import signatureData from '../../assets/art/pots_signature.json';
import signatureWebp from '../../assets/art/pots_signature.webp?url';
import worldHouseData from '../../assets/art/world_floor_house.json';
import worldHouseWebp from '../../assets/art/world_floor_house.webp?url';
import worldFallsData from '../../assets/art/world_floor_falls.json';
import worldFallsWebp from '../../assets/art/world_floor_falls.webp?url';
import worldBridgeData from '../../assets/art/world_floor_bridge.json';
import worldBridgeWebp from '../../assets/art/world_floor_bridge.webp?url';
import worldVineData from '../../assets/art/world_vine.json';
import worldVineWebp from '../../assets/art/world_vine.webp?url';
import worldMiscData from '../../assets/art/world_misc.json';
import worldMiscWebp from '../../assets/art/world_misc.webp?url';

export const atlasUrls = {
  sprites: spritesPng,
  scene: scenePng,
  pots_phoenix: phoenixWebp,
  pots_catalog: catalogWebp,
  pots_signature: signatureWebp,
  world_floor_house: worldHouseWebp,
  world_floor_falls: worldFallsWebp,
  world_floor_bridge: worldBridgeWebp,
  world_vine: worldVineWebp,
  world_misc: worldMiscWebp,
} as const;
export const atlasData = {
  sprites: spritesData as unknown as SpritesheetData,
  scene: sceneData as unknown as SpritesheetData,
  pots_phoenix: phoenixData as unknown as SpritesheetData,
  pots_catalog: catalogData as unknown as SpritesheetData,
  pots_signature: signatureData as unknown as SpritesheetData,
  // The owner's concept art (cut out and upscaled by tools/concept): cloud floors, vine, pets.
  world_floor_house: worldHouseData as unknown as SpritesheetData,
  world_floor_falls: worldFallsData as unknown as SpritesheetData,
  world_floor_bridge: worldBridgeData as unknown as SpritesheetData,
  world_vine: worldVineData as unknown as SpritesheetData,
  world_misc: worldMiscData as unknown as SpritesheetData,
};
export type SheetName = keyof typeof atlasData;
/** Atlases added at run time (Art.addAtlas), so the HTML icons can use their frames too. */
export const extraAtlases: { url: string; data: SpritesheetData }[] = [];
const SHEETS = Object.keys(atlasData) as SheetName[];

/** Atlas holding a frame (frames are unique across atlases), or null. */
export function sheetOf(frame: string): SheetName | null {
  for (const s of SHEETS) if (atlasData[s].frames[frame]) return s;
  return null;
}

export const hasFrame = (frame: string): boolean => sheetOf(frame) !== null;

/** Pot frames by sprite prefix ("pots/phoenix" -> sorted levels that have a picture). */
const POT_LEVELS = new Map<string, number[]>();
for (const s of SHEETS) {
  for (const name of Object.keys(atlasData[s].frames)) {
    const m = /^(pots\/.+)\/(\d+)$/.exec(name);
    if (!m) continue;
    const list = POT_LEVELS.get(m[1]!) ?? [];
    list.push(Number(m[2]));
    POT_LEVELS.set(m[1]!, list);
  }
}
for (const l of POT_LEVELS.values()) l.sort((a, b) => a - b);

/**
 * Directive 03 step 2: picture for a pot sprite at a level — the frame of the highest level
 * <= level; if none, the lowest level the sprite has (catalog lines only have level 50).
 */
export function spriteLevelFrame(sprite: string, level: number): string | null {
  const levels = POT_LEVELS.get(sprite);
  if (!levels || levels.length === 0) return null;
  let pick = levels[0]!;
  for (const l of levels) if (l <= level) pick = l;
  return `${sprite}/${pick}`;
}

/** Directive 03 step 3: distance (atlas px @2x) from the pot's anchor up to its soil, if given. */
export function potSoil(frame: string): number | null {
  const s = sheetOf(frame);
  const f = s ? (atlasData[s].frames[frame] as unknown as { soil?: number }) : null;
  return typeof f?.soil === 'number' ? f.soil : null;
}

/** Width (atlas px @2x) of the visible soil in the pot mouth, measured from the picture, if known. */
export function potMouth(frame: string): number | null {
  const s = sheetOf(frame);
  const f = s ? (atlasData[s].frames[frame] as unknown as { mouth?: number }) : null;
  return typeof f?.mouth === 'number' ? f.mouth : null;
}

/** A numeric extra field stored on an atlas frame (e.g. a pedestal's "lift"), or 0. */
export function frameNumber(frame: string, key: string): number {
  const s = sheetOf(frame);
  const f = s ? (atlasData[s].frames[frame] as unknown as Record<string, unknown>) : null;
  const v = f?.[key];
  return typeof v === 'number' ? v : 0;
}

/** Frames the scene itself needs, besides those named by the content pack. */
const SCENE_FRAMES = ['trunk'];

export class Art {
  private constructor(
    private readonly frames: Record<string, Texture>,
    readonly sky: Texture,
  ) {}

  /**
   * Loads the art. Directive 05 step 3: atlases in `skip` are left out (saves GPU memory, e.g. the
   * 29.5 MB retired catalog pots when the save has none); their frames then fall back like any
   * missing art, and loadSheet() can bring them in later.
   */
  static async load(skip: readonly SheetName[] = []): Promise<Art> {
    const sheets = SHEETS.filter((s) => !skip.includes(s));
    const [sky, ...textures] = await Promise.all([Assets.load<Texture>(skyJpg), ...sheets.map((s) => Assets.load<Texture>(atlasUrls[s]))]);
    const frames: Record<string, Texture> = {};
    for (let i = 0; i < sheets.length; i++) Object.assign(frames, await new Spritesheet(textures[i]!, atlasData[sheets[i]!]).parse());
    const art = new Art(frames, sky);
    for (const s of SHEETS) if (!sheets.includes(s)) art.notLoaded.add(s);
    return art;
  }

  /**
   * Chỉ thị 10: adds an atlas that is not in the fixed list (the world10 art, loaded at start or lazily
   * per floor). Frames already present are kept.
   */
  async addAtlas(url: string, data: SpritesheetData): Promise<void> {
    extraAtlases.push({ url, data });
    const tex = await Assets.load<Texture>(url);
    Object.assign(this.frames, await new Spritesheet(tex, data).parse());
  }

  /** Atlases left out at load time (directive 05 step 3). */
  readonly notLoaded = new Set<SheetName>();

  /** Loads an atlas that was skipped at start. Returns true if it was not loaded before. */
  async loadSheet(sheet: SheetName): Promise<boolean> {
    if (!this.notLoaded.has(sheet)) return false;
    this.notLoaded.delete(sheet);
    const tex = await Assets.load<Texture>(atlasUrls[sheet]);
    Object.assign(this.frames, await new Spritesheet(tex, atlasData[sheet]).parse());
    return true;
  }

  /** GPU memory of the loaded art, per atlas (RGBA8, no mipmaps), in bytes. */
  textureBytes(): Record<string, number> {
    const out: Record<string, number> = {};
    const seen = new Set<unknown>();
    const add = (name: string, t: Texture) => {
      const src = t.source;
      if (seen.has(src)) return;
      seen.add(src);
      out[name] = (out[name] ?? 0) + src.pixelWidth * src.pixelHeight * 4;
    };
    for (const s of SHEETS) {
      const first = Object.keys(atlasData[s].frames)[0];
      if (first && this.frames[first]) add(s, this.frames[first]!);
    }
    add('sky', this.sky);
    return out;
  }

  get(name: string): Texture {
    const t = this.frames[name];
    if (!t) throw new Error(`Thiếu hình "${name}"`);
    return t;
  }

  has(name: string): boolean {
    return name in this.frames;
  }

  /**
   * Pot picture for a level (POT_SYSTEM 7): the line's look for that level; if that look's art is
   * not made yet, the nearest earlier look that has art; lines with no art at all use the
   * terracotta picture tinted with their rarity colour ("chờ đồ họa").
   */
  pot(def: PotDef, level: number, rarityColor: string): { texture: Texture; tint: number; placeholder: boolean; soil: number | null; mouth?: number | null } {
    const frame = potFrame(def, level, (f) => this.has(f));
    if (frame && this.has(frame)) return { texture: this.frames[frame]!, tint: 0xffffff, placeholder: false, soil: potSoil(frame), mouth: potMouth(frame) };
    return { texture: this.get('pots/terracotta/0'), tint: lighten(rarityColor, 0.35), placeholder: true, soil: potSoil('pots/terracotta/0'), mouth: potMouth('pots/terracotta/0') };
  }

  /** Floor picture; floors without their own art reuse the first floor's, tinted ("chờ đồ họa"). */
  floor(sprite: string, tint: string | undefined, fallback: string): { texture: Texture; tint: number; placeholder: boolean } {
    if (this.has(sprite)) return { texture: this.frames[sprite]!, tint: 0xffffff, placeholder: false };
    return { texture: this.get(fallback), tint: tint ? lighten(tint, 0.25) : 0xffffff, placeholder: true };
  }

  /** Every frame that has no fallback and is missing (the game cannot start without these). */
  missingFor(content: ContentPack): string[] {
    const need = [...SCENE_FRAMES, content.floors.get(content.config.startFloor)!.sprite, 'pots/terracotta/0'];
    for (const c of content.cropList) for (let s = 0; s < c.stages; s++) need.push(`${c.sprite}/${s}`);
    // Chỉ thị 10 bugs have one approved picture (chars atlas) instead of two crawl frames.
    for (const b of content.bugList) {
      if (b.art && b.sprite === b.art) need.push(b.art);
      else need.push(`${b.sprite}/0`, `${b.sprite}/1`);
    }
    for (const id of content.items.keys()) {
      if (content.materials.has(id)) continue;
      // Chỉ thị 10 § 3.5: processed goods use an approved icon ("art:<frame>").
      const good = content.goods?.get(id);
      if (good) need.push(good.icon.startsWith('art:') ? good.icon.slice(4) : good.icon);
      else need.push(itemFrame(content, id));
    }
    return need.filter((n) => !this.frames[n]);
  }
}

/** Best existing art frame for a pot at a level, or null when the line has none yet: the line's
 *  look for that level (or the nearest earlier look with art), else the sprite's own level frames
 *  (directive 03 step 2). */
export function potFrame(def: PotDef, level: number, has: (frame: string) => boolean = hasFrame): string | null {
  for (let i = def.looks.length - 1; i >= 0; i--) {
    const l = def.looks[i]!;
    if (l.from <= level && has(l.frame)) return l.frame;
  }
  return spriteLevelFrame(def.sprite, level);
}

/** Inventory icon frame for an item: items/<last part of the crop or bug sprite path>. */
export function itemFrame(content: ContentPack, itemId: string): string {
  // Mutated produce uses its normal picture (with a glow in the UI) until it has its own art.
  const base = content.items.get(itemId)?.baseItem;
  if (base) return itemFrame(content, base);
  // Chỉ thị 10 bugs without the old sprite sheet use their approved picture as the icon too.
  const bug = content.bugs.get(itemId);
  if (bug?.art && bug.sprite === bug.art) return bug.art;
  const crop = content.cropList.find((c) => c.produce.id === itemId);
  const sprite = crop?.sprite ?? content.bugs.get(itemId)?.sprite ?? itemId;
  return `items/${sprite.slice(sprite.lastIndexOf('/') + 1)}`;
}

/** "#RRGGBB" mixed toward white by `amount` (0..1), as a PixiJS colour number. */
export function lighten(color: string, amount: number): number {
  const n = Number.parseInt(color.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
}
