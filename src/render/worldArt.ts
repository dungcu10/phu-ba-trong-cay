// Chỉ thị 08: the Blender world — ancient vine, cloud floors, stone pedestals, Mèo Mây.
// Art from tools/potgen (render_trunk / render_floor / render_pet, packed by pack_world.py).
//
// The vine is ONE seamless segment repeated, with separate leaves, twigs, tendrils, buds and lanterns
// pinned along the bark edge by a fixed seed per floor: the same every time the game opens, different
// between floors. The vine is drawn BEHIND the floors; each floor picture has a transparent cut where
// the vine passes behind its cloud, while the cloud in front of the vine still covers it, so the vine
// goes through the edge of every floor with a ring of cloud around it.

import { AnimatedSprite, Container, Sprite, type Texture } from 'pixi.js';
import trunkData from '../../assets/art/world_trunk.json';
import { frameNumber, type Art } from './assets.ts';

interface PieceInfo {
  kind: string;
  side: 'L' | 'R';
  hang?: [number, number];
}
interface TrunkData {
  scale: number;
  tile: { w: number; h: number; edges: [number, number][] };
  pieces: Record<string, PieceInfo>;
}
const DATA = trunkData as unknown as TrunkData;
/** Atlas pixels per point (@2x art). */
const PX = DATA.scale;
/** One segment of the vine, in points. */
export const SEGMENT_PT = DATA.tile.h / PX;

const FLOOR_VARIANTS = ['meadow-a', 'meadow-b'] as const;
const PEDESTALS = ['world/pedestal/meadow/0', 'world/pedestal/meadow/1'] as const;
const CAT_BREATHE = [0, 1, 2, 3, 4, 5].map((i) => `world/pet/cloud-cat/breathe_${i}`);

export function hasWorldArt(art: Art): boolean {
  return art.has('world/trunk/tile') && art.has('world/floor/meadow-a/L');
}

/** Small deterministic generator (mulberry32): the same decoration on every start. */
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

/** The cloud floor picture (two halves, origin = floor container origin: middle of the pot row). */
export function floorArt(art: Art, floorIndex: number): Container {
  const c = new Container();
  const v = FLOOR_VARIANTS[floorIndex % FLOOR_VARIANTS.length]!;
  for (const side of ['L', 'R'] as const) {
    const tex = art.get(`world/floor/${v}/${side}`);
    const s = new Sprite(tex);
    s.anchor.copyFrom(tex.defaultAnchor ?? { x: 0, y: 0 });
    c.addChild(s);
  }
  return c;
}

/** A stone pedestal for pot position i of a floor; `lift` = how high the pot stands on it (points). */
export function pedestal(art: Art, floorIndex: number, i: number): { sprite: Sprite; lift: number } {
  const frame = PEDESTALS[(i * 7 + floorIndex * 3) % PEDESTALS.length]!;
  const tex = art.get(frame);
  const s = new Sprite(tex);
  s.anchor.copyFrom(tex.defaultAnchor ?? { x: 0.5, y: 0.5 });
  // Mirror every other one: worn stones look different, and they are lit almost from the top.
  if ((i + floorIndex) % 3 === 1) s.scale.x = -1;
  return { sprite: s, lift: frameNumber(frame, 'lift') / PX };
}

/** Distance (points) from the vine axis to the bark edge at a height y (points, any value). */
function edgeAt(side: 1 | -1, yFromSegmentTop: number): number {
  const rows = DATA.tile.edges;
  const r = ((Math.floor(yFromSegmentTop * PX) % rows.length) + rows.length) % rows.length;
  const e = rows[r]!;
  return (side > 0 ? e[1] : e[0]) / PX;
}

function piece(art: Art, name: string): Sprite {
  const tex = art.get(`world/piece/${name}`);
  const s = new Sprite(tex);
  s.anchor.copyFrom(tex.defaultAnchor ?? { x: 0.5, y: 0.5 });
  return s;
}

/**
 * The vine from `bottom` up to `top` (world points, y grows downward), its axis at x. Segments are
 * laid from `bottom` upward so every joint falls on the segment period. `bands` are the floor
 * stretches that get their own decoration seed (one per floor).
 */
export function buildVine(art: Art, x: number, bottom: number, top: number, bands: { top: number; bottom: number }[]): Container {
  const layer = new Container();
  const tile = art.get('world/trunk/tile');
  const segs = new Container();
  let y = bottom;
  while (y > top) {
    const s = new Sprite(tile);
    s.anchor.set(0.5, 1);
    s.position.set(x, y);
    segs.addChild(s);
    y -= SEGMENT_PT;
  }
  const vineTop = y + SEGMENT_PT;
  const deco = new Container();
  const pin = (name: string, side: 1 | -1, py: number, inset: number, scale: number) => {
    const s = piece(art, name);
    const fromTop = py - (bottom - SEGMENT_PT * Math.ceil((bottom - py) / SEGMENT_PT));
    s.position.set(x + side * (edgeAt(side, fromTop) - inset), py);
    s.scale.set(scale);
    deco.addChild(s);
    return s;
  };
  bands.forEach((band, bi) => {
    const r = rng(1000 + bi * 7919);
    const height = band.bottom - band.top;
    let bag: number[] = [];
    let side: 1 | -1 = r() < 0.5 ? -1 : 1;
    let yy = 10 + r() * 20;
    const lanternY = band.bottom - height * (0.3 + r() * 0.25);
    while (yy < height - 15) {
      const py = band.bottom - yy;
      if (Math.abs(py - lanternY) > 35 || side < 0) {
        if (bag.length === 0) bag = [0, 1, 2, 3, 4, 5].sort(() => r() - 0.5);
        const roll = r();
        const kind = roll < 0.13 ? `branch${Math.floor(r() * 3)}` : roll < 0.21 ? `tendril${Math.floor(r() * 2)}` : roll < 0.3 ? `bud${Math.floor(r() * 2)}` : `leaf${bag.pop()}`;
        pin(`${kind}_${side > 0 ? 'R' : 'L'}`, side, py, (6 + r() * 20) / PX, 0.82 + r() * 0.26);
      }
      yy += (34 + r() * 58) / PX;
      if (r() < 0.7) side = side > 0 ? -1 : 1;
    }
    // One lantern per floor, hung from its own twig on the open side (towards the pots).
    const twig = `branch${1 + (bi % 2)}_R`;
    const t = pin(twig, 1, lanternY, 10 / PX, 1);
    const hang = DATA.pieces[twig]?.hang;
    if (hang) {
      const l = piece(art, `lantern${bi % 2}`);
      l.position.set(t.x + hang[0] / PX, t.y + hang[1] / PX - 2);
      deco.addChild(l);
    }
  });
  // Crown: the top end of the vine disappears into a dense spray of leaves and twigs.
  const r = rng(424242);
  for (let i = 0; i < 16; i++) {
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const kind = i % 5 === 0 ? `branch${i % 3}` : i % 7 === 3 ? `bud${i % 2}` : `leaf${i % 6}`;
    pin(`${kind}_${side > 0 ? 'R' : 'L'}`, side, vineTop + 6 + r() * 70, (10 + r() * 60) / PX, 0.9 + r() * 0.3);
  }
  for (let i = 0; i < 6; i++) {
    const s = piece(art, `leaf${(i * 5) % 6}_${i % 2 === 0 ? 'R' : 'L'}`);
    s.position.set(x + (r() - 0.5) * 40, vineTop + 4 + r() * 18);
    s.scale.set(1.1);
    s.rotation = (i % 2 === 0 ? -1 : 1) * (0.6 + r() * 0.5);
    deco.addChild(s);
  }
  layer.addChild(segs, deco);
  return layer;
}

/** Mèo Mây sitting on a floor, breathing slowly (decoration only: pets come in đợt 5). */
export function cloudCat(art: Art): AnimatedSprite | null {
  if (!art.has(CAT_BREATHE[0]!)) return null;
  const frames = [...CAT_BREATHE, ...CAT_BREATHE.slice(1, -1).reverse()].map((f) => art.get(f));
  const cat = new AnimatedSprite(frames);
  cat.anchor.copyFrom(frames[0]!.defaultAnchor ?? { x: 0.5, y: 1 });
  cat.updateAnchor = true;
  cat.animationSpeed = 0.09;
  cat.play();
  return cat;
}
