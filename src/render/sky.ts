// Chỉ thị 11 TỔNG § C2: the tall sky behind the garden, in parallax. Four sky pictures (village_sky1–4)
// are stacked bottom to top, each overlapping the one below by its faded bottom band (12 %); the
// stack is laid so the camera's floor sees its own zone: floors 1–5 the low sky, 6–10 the golden
// sky, 11–15 the violet dusk, 16–20 the night sky (and above 20 it stays in the night). The factor
// comes from the world height, not written by hand. Pictures load lazily; until then the old
// static sky shows.

import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import skyMeta from '../../assets/art/village.json';
import { FLOORS_PER_ZONE } from './zones.ts';

export { FLOORS_PER_ZONE, ZONES, zoneOf, type SkyZone } from './zones.ts';

const URLS = import.meta.glob('../../assets/art/village_sky*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface SkyPic {
  image: string;
  w: number;
  h: number;
}

export class SkyStrip {
  readonly root = new Container();
  private readonly pics: Sprite[] = [];
  private loaded = false;
  private width = 1;
  private height = 1;
  /** Height of the stack in screen pixels, and the bottom y of each picture's opaque part. */
  private stackH = 0;
  private bands: Array<{ from: number; to: number }> = [];

  constructor() {
    this.root.visible = false;
  }

  /** Loads sky 1–4 (sky 0 is the village ground, drawn with the village). */
  async load(): Promise<void> {
    const meta = (skyMeta as unknown as { sky: { overlap: number; pictures: SkyPic[] } }).sky;
    const list = meta.pictures.slice(1);
    const urls = list.map((p) => Object.entries(URLS).find(([k]) => k.endsWith(`/${p.image}`))?.[1]);
    if (urls.some((u) => !u)) return;
    const tex = await Promise.all(urls.map((u) => Assets.load<Texture>(u!)));
    for (const t of tex) {
      const s = new Sprite(t);
      s.anchor.set(0.5, 1);
      this.pics.push(s);
      this.root.addChild(s);
    }
    this.loaded = true;
    this.root.visible = true;
    this.resize(this.width, this.height);
  }

  get ready(): boolean {
    return this.loaded;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    if (!this.loaded) return;
    const overlap = (skyMeta as unknown as { sky: { overlap: number } }).sky.overlap;
    // Cover the width (a little wider for the side drift); stack upwards.
    let y = 0;
    this.bands = [];
    for (const s of this.pics) {
      const k = (w * 1.04) / s.texture.width;
      s.scale.set(k);
      s.x = w / 2;
      s.y = -y;
      const ph = s.texture.height * k;
      // The opaque part of this picture (above its faded bottom band).
      this.bands.push({ from: y + ph * overlap, to: y + ph });
      y += ph * (1 - overlap);
    }
    this.stackH = y + (this.pics.at(-1)?.texture.height ?? 0) * (this.pics.at(-1)?.scale.y ?? 0) * overlap;
  }

  /**
   * Places the stack for the camera at floor position `f` (0 = first floor, fractional while
   * scrolling): the screen's middle sits at the matching height inside the zone's own picture.
   */
  update(f: number): void {
    if (!this.loaded || this.bands.length === 0) return;
    // Keyframes: a zone's first floor sees the bottom of its picture, its last floor the top; between
    // the last floor of one zone and the first of the next the view crosses the faded overlap.
    const half = this.height / 2;
    const keys: Array<[number, number]> = [];
    this.bands.forEach((b, z) => {
      const lo = b.from + half;
      keys.push([z * FLOORS_PER_ZONE, lo], [z * FLOORS_PER_ZONE + FLOORS_PER_ZONE - 1, Math.max(lo, b.to - half)]);
    });
    let at = keys[0]![1];
    if (f >= keys.at(-1)![0]) at = keys.at(-1)![1];
    else
      for (let i = 1; i < keys.length; i++) {
        const [f0, y0] = keys[i - 1]!;
        const [f1, y1] = keys[i]!;
        if (f <= f1) {
          at = y0 + (y1 - y0) * Math.max(0, (f - f0) / (f1 - f0));
          break;
        }
      }
    this.root.y = half + at;
  }
}
