// Loads the art atlases: sprites/scene built by tools/process_art.py from the Leonardo AI images,
// and the Blender pot atlases built by tools/potgen (pots_phoenix, pots_catalog; directive 03).
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

export const atlasUrls = { sprites: spritesPng, scene: scenePng, pots_phoenix: phoenixWebp, pots_catalog: catalogWebp } as const;
export const atlasData = {
  sprites: spritesData as unknown as SpritesheetData,
  scene: sceneData as unknown as SpritesheetData,
  pots_phoenix: phoenixData as unknown as SpritesheetData,
  pots_catalog: catalogData as unknown as SpritesheetData,
};
export type SheetName = keyof typeof atlasData;
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

/** Frames the scene itself needs, besides those named by the content pack. */
const SCENE_FRAMES = ['trunk'];

export class Art {
  private constructor(
    private readonly frames: Record<string, Texture>,
    readonly sky: Texture,
  ) {}

  static async load(): Promise<Art> {
    const [sky, ...textures] = await Promise.all([Assets.load<Texture>(skyJpg), ...SHEETS.map((s) => Assets.load<Texture>(atlasUrls[s]))]);
    const frames: Record<string, Texture> = {};
    for (let i = 0; i < SHEETS.length; i++) Object.assign(frames, await new Spritesheet(textures[i]!, atlasData[SHEETS[i]!]).parse());
    return new Art(frames, sky);
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
  pot(def: PotDef, level: number, rarityColor: string): { texture: Texture; tint: number; placeholder: boolean; soil: number | null } {
    const frame = potFrame(def, level, (f) => this.has(f));
    if (frame && this.has(frame)) return { texture: this.frames[frame]!, tint: 0xffffff, placeholder: false, soil: potSoil(frame) };
    return { texture: this.get('pots/terracotta/0'), tint: lighten(rarityColor, 0.35), placeholder: true, soil: null };
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
    for (const b of content.bugList) need.push(`${b.sprite}/0`, `${b.sprite}/1`);
    for (const id of content.items.keys()) if (!content.materials.has(id)) need.push(itemFrame(content, id));
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
