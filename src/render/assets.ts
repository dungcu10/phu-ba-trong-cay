// Loads the art atlases built by tools/process_art.py from the Leonardo AI images.
// Art is referenced by the "sprite" field of each content definition, so adding a crop only
// needs data plus its frames in the atlas.

import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { ContentPack, PotDef } from '../core/content.ts';
import spritesData from '../../assets/art/sprites.json';
import spritesPng from '../../assets/art/sprites.png?url';
import sceneData from '../../assets/art/scene.json';
import scenePng from '../../assets/art/scene.png?url';
import skyJpg from '../../assets/art/sky.jpg?url';

export const atlasUrls = { sprites: spritesPng, scene: scenePng } as const;
export const atlasData = {
  sprites: spritesData as unknown as SpritesheetData,
  scene: sceneData as unknown as SpritesheetData,
};

/** Frames the scene itself needs, besides those named by the content pack. */
const SCENE_FRAMES = ['trunk'];

export class Art {
  private constructor(
    private readonly frames: Record<string, Texture>,
    readonly sky: Texture,
  ) {}

  static async load(): Promise<Art> {
    const [spritesTex, sceneTex, sky] = await Promise.all([
      Assets.load<Texture>(spritesPng),
      Assets.load<Texture>(scenePng),
      Assets.load<Texture>(skyJpg),
    ]);
    const frames: Record<string, Texture> = {};
    for (const sheet of [new Spritesheet(spritesTex, atlasData.sprites), new Spritesheet(sceneTex, atlasData.scene)]) {
      Object.assign(frames, await sheet.parse());
    }
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
  pot(def: PotDef, level: number, rarityColor: string): { texture: Texture; tint: number; placeholder: boolean } {
    const frame = potFrame(def, level, (f) => this.has(f));
    if (frame) return { texture: this.frames[frame]!, tint: 0xffffff, placeholder: false };
    return { texture: this.get('pots/terracotta/0'), tint: lighten(rarityColor, 0.35), placeholder: true };
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

/** Best existing art frame for a pot at a level, or null when the line has none yet. */
export function potFrame(def: PotDef, level: number, has: (frame: string) => boolean): string | null {
  for (let i = def.looks.length - 1; i >= 0; i--) {
    const l = def.looks[i]!;
    if (l.from <= level && has(l.frame)) return l.frame;
  }
  return null;
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
