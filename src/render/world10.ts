// Chỉ thị 10 · M1: the garden world from the approved art set PhuBa_BoHinh_v1 (tools/art/build.py):
// four cloud floors, the climbing vine (root, seamless segment, top) with leaves, buds, tendrils and
// lanterns, cloud rings hugging the vine where it passes each floor (back half behind the vine, front
// half over it), stone pedestals under the pots, bugs, birds and Xu Xu.
//
// Layers, far to near (§ 2.3): sky · far clouds · ring backs · vine · vine decoration · floors · ring
// fronts · pedestals · pots · plants · bugs · birds · effects · UI.
// Atlases come in @1x and @2x; floors are loaded lazily, one floor at a time.

import { Container, Sprite, type SpritesheetData, type Texture } from 'pixi.js';
import worldMeta from '../../assets/art/world10.json';
import type { Art } from './assets.ts';

const DATA = import.meta.glob('../../assets/art/world10_*.json', { eager: true, import: 'default' }) as Record<string, SpritesheetData>;
const URLS = import.meta.glob('../../assets/art/world10_*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface FloorArtMeta {
  row: { x0: number; x1: number };
  left: number;
  right: number;
  top: number;
  bottom: number;
  pedestal: 'grey' | 'sand' | 'moon';
}
interface WorldMeta {
  floors: Record<string, FloorArtMeta>;
  vine: { segment: number; width: number; axis: number };
}
export const WORLD10 = worldMeta as unknown as WorldMeta;
const FLOOR_IDS = ['t1', 't2', 't3', 't4'] as const;
export type FloorArtId = (typeof FLOOR_IDS)[number];

/** Art for floor index i (0-based); floors past the fourth reuse the set in order. */
export function floorArtId(index: number): FloorArtId {
  return FLOOR_IDS[index % FLOOR_IDS.length]!;
}

function res(): 1 | 2 {
  return (globalThis.devicePixelRatio ?? 1) >= 1.5 ? 2 : 1;
}

function atlas(name: string): { url: string; data: SpritesheetData } | null {
  const r = res();
  const key = `world10_${name}@${r}x`;
  const json = Object.entries(DATA).find(([p]) => p.endsWith(`/${key}.json`));
  const url = Object.entries(URLS).find(([p]) => p.endsWith(`/${key}.webp`));
  if (!json || !url) return null;
  return { url: url[1], data: json[1] };
}

export function hasWorld10(art: Art): boolean {
  return art.has('vine/tile') && art.has('ring/sun/back');
}

/** Loads the always-needed world atlases (vine, rings, pedestals, characters). */
export async function loadWorld10(art: Art): Promise<boolean> {
  const names = ['vine', 'vine_ends', 'rings', 'pedestals', 'chars', 'icons', 'houses', 'pets', 'village'];
  const list = names.map(atlas);
  if (list.some((a) => !a)) return false;
  await Promise.all(list.map((a) => art.addAtlas(a!.url, a!.data)));
  return true;
}

const floorLoads = new Map<FloorArtId, Promise<void>>();
/** Loads one floor's picture (two halves) on first use. */
export function loadFloor(art: Art, id: FloorArtId): Promise<void> {
  let p = floorLoads.get(id);
  if (!p) {
    const parts = [atlas(`floor_${id}_L`), atlas(`floor_${id}_R`)];
    p = Promise.all(parts.filter((a) => a).map((a) => art.addAtlas(a!.url, a!.data))).then(() => undefined);
    floorLoads.set(id, p);
  }
  return p;
}

function sprite(art: Art, frame: string): Sprite {
  const t = art.get(frame);
  const s = new Sprite(t);
  s.anchor.copyFrom(t.defaultAnchor ?? { x: 0.5, y: 0.5 });
  return s;
}

/** Floor picture (origin = middle of the pedestal row). Empty until its atlas has loaded. */
export function floorPicture(art: Art, id: FloorArtId): Container {
  const c = new Container();
  const fill = () => {
    if (c.destroyed || c.children.length) return;
    for (const side of ['L', 'R']) if (art.has(`floor/${id}/${side}`)) c.addChild(sprite(art, `floor/${id}/${side}`));
  };
  if (art.has(`floor/${id}/L`)) fill();
  else void loadFloor(art, id).then(fill);
  return c;
}

/** Pot positions along the pedestal row of a floor picture, for n positions. */
export function slotXs(id: FloorArtId, n: number): number[] {
  const { x0, x1 } = WORLD10.floors[id]!.row;
  const inset = (x1 - x0) * 0.06;
  const a = x0 + inset;
  const b = x1 - inset;
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** Pedestal for slot i of a floor: style by floor, the two variants alternating. */
export function pedestalSprite(art: Art, id: FloorArtId, i: number, zoneStyle?: FloorArtMeta['pedestal']): Sprite {
  // Chỉ thị 11 § C2: the style follows the sky zone (grey low, sandstone gold, moonstone dusk/night).
  const style = zoneStyle ?? WORLD10.floors[id]!.pedestal;
  return sprite(art, `pedestal/${style}/${i % 2}`);
}

/** The ring of cloud around the vine at one floor: back half (behind the vine) and front half. */
export function ringSprites(art: Art, id: FloorArtId): { back: Sprite; front: Sprite } {
  const kind = id === 't4' ? 'moon' : 'sun';
  return { back: sprite(art, `ring/${kind}/back`), front: sprite(art, `ring/${kind}/front`) };
}

/** Small deterministic generator (mulberry32): same decoration every start, different per floor. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Swayer {
  sprite: Sprite;
  base: number;
  amp: number;
  speed: number;
  phase: number;
  /** World y, to animate only near the floor in view. */
  y: number;
}

/**
 * The vine from below the lowest floor to above the highest: root, seamless segments, top. Leaves,
 * buds, tendrils and one lantern per floor are pinned along the bark by a seed per floor
 * (about one every 60 pt). Returns the layer and the pieces that sway.
 */
export function buildVine(art: Art, x: number, rootY: number, topY: number, bands: { top: number; bottom: number }[]): { layer: Container; swayers: Swayer[] } {
  const layer = new Container();
  const deco = new Container();
  const swayers: Swayer[] = [];
  const seg = WORLD10.vine.segment;
  const half = WORLD10.vine.width / 2;
  let y = rootY;
  while (y > topY) {
    const s = sprite(art, 'vine/tile');
    s.position.set(x, y);
    layer.addChild(s);
    y -= seg;
  }
  const top = sprite(art, 'vine/top');
  top.position.set(x, y + 2);
  layer.addChild(top);
  const root = sprite(art, 'vine/root');
  root.position.set(x, rootY - 2);
  layer.addChild(root);
  const pin = (name: string, side: 1 | -1, py: number, r: () => number): Sprite => {
    const s = sprite(art, `vine/${name}`);
    const lantern = name.startsWith('lantern');
    s.position.set(x + side * (half * (lantern ? 1.05 : 0.78) + r() * 10), py);
    s.scale.set(side * (0.85 + r() * 0.3), 0.85 + r() * 0.3);
    if (!lantern) s.rotation = side * (0.15 + r() * 0.5);
    deco.addChild(s);
    swayers.push({ sprite: s, base: s.rotation, amp: lantern ? 0.08 : 0.05, speed: lantern ? 1.4 : 1.1 + r() * 0.6, phase: r() * 6.28, y: py });
    return s;
  };
  const kinds = ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4', 'leaf5', 'bud0', 'bud1', 'bud2', 'tendril0', 'tendril1'];
  bands.forEach((band, bi) => {
    const r = rng(1000 + bi * 7919);
    const height = band.bottom - band.top;
    const n = Math.max(1, Math.round(height / 60));
    const lanternAt = Math.floor(r() * n);
    for (let i = 0; i < n; i++) {
      const py = band.bottom - (i + 0.2 + r() * 0.6) * (height / n);
      const side: 1 | -1 = r() < 0.5 ? -1 : 1;
      if (i === lanternAt) pin(`lantern${bi % 2}`, 1, py, r);
      else pin(kinds[Math.floor(r() * kinds.length)]!, side, py, r);
    }
  });
  layer.addChild(deco);
  return { layer, swayers };
}
