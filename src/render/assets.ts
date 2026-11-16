// Loads the art atlases built by tools/process_art.py from the Leonardo AI images.
// Art is referenced by the "sprite" field of each content definition, so adding a crop only
// needs data plus its frames in the atlas.

import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { ContentPack } from '../core/content.ts';
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

  /** Every frame the content pack and scene need that the atlases do not have. */
  missingFor(content: ContentPack): string[] {
    const need = [...SCENE_FRAMES];
    for (const f of content.floors.values()) need.push(f.sprite);
    for (const p of content.pots.values()) for (const lv of p.levels) need.push(`${p.sprite}/${lv.level}`);
    for (const c of content.cropList) for (let s = 0; s < c.stages; s++) need.push(`${c.sprite}/${s}`);
    for (const b of content.bugList) need.push(`${b.sprite}/0`, `${b.sprite}/1`);
    for (const id of content.items.keys()) need.push(itemFrame(content, id));
    return need.filter((n) => !this.frames[n]);
  }
}

/** Inventory icon frame for an item: items/<last part of the crop or bug sprite path>. */
export function itemFrame(content: ContentPack, itemId: string): string {
  const crop = content.cropList.find((c) => c.produce.id === itemId);
  const sprite = crop?.sprite ?? content.bugs.get(itemId)?.sprite ?? itemId;
  return `items/${sprite.slice(sprite.lastIndexOf('/') + 1)}`;
}
