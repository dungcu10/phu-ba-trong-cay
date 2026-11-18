// Chỉ thị 11 TỔNG § C2 / D1: Làng Phú Bà on the ground (0 m) under floor 1. The village picture
// (village_sky0, the ground with nine plots, the river and the wooden bridge) fades into the sky at
// its top; the eight houses stand on their plots (plot 9 is the "sắp xây" sign), locked houses are
// dim with "Mở ở cấp X", houses with something waiting carry a bouncing roof bubble, and pets that
// are not looking after a floor play in the village. Tapping a house opens its feature (the toolbar
// buttons still work too). Nothing here blocks the screen.

import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { houseLevel, houseOpen } from '../systems/village.ts';
import { houseAlerts } from '../systems/villageAlerts.ts';
import type { Art } from './assets.ts';
import { PetActor } from './worldArt.ts';
import { avatarSvg } from '../ui/avatar.ts';
import { isNight } from '../systems/growth.ts';

/** Xu Xu's stroll along the dirt roads (picture coordinates). */
const XUXU_PATH: Array<[number, number]> = [
  [0.42, 0.62],
  [0.62, 0.615],
  [0.64, 0.73],
  [0.44, 0.74],
  [0.3, 0.62],
];
/** Where visiting neighbours come from (the bridge) and stand (in front of the market). */
const BOT_FROM: [number, number] = [0.78, 0.83];

interface Walker {
  s: Sprite;
  path: Array<[number, number]>;
  leg: number;
  t: number;
  speed: number;
  wait: number;
  base: number;
}

interface Fx {
  s: Sprite;
  kind: 'smoke' | 'fire' | 'glow' | 'glint' | 'bird';
  x: number;
  y: number;
  phase: number;
}

const URLS = import.meta.glob('../../assets/art/village_sky0.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Picture width in world points; the picture's top (sky) fades out over FADE of its height. */
const PIC_W = 1320;
const FADE = 0.42;
const HOUSE_SCALE = 0.5;
/** Plot centres in the picture (0–1), plot 1 … 9, and the river (fishing) by the bridge. */
const PLOTS: Record<number, [number, number]> = {
  1: [0.524, 0.663],
  2: [0.236, 0.493],
  3: [0.756, 0.491],
  4: [0.36, 0.571],
  5: [0.69, 0.571],
  6: [0.23, 0.68],
  7: [0.836, 0.687],
  8: [0.504, 0.484],
  9: [0.55, 0.771],
};
const RIVER: [number, number] = [0.69, 0.865];

export interface VillageHit {
  house: string;
}

interface HouseView {
  id: string;
  root: Container;
  pic: Sprite;
  bubble: Container;
  bubbleText: Text;
  lock: Text;
  level: Text;
  phase: number;
}

export class VillageView {
  readonly root = new Container();
  private ground: Sprite | null = null;
  private readonly houses: HouseView[] = [];
  private river: HouseView | null = null;
  private pets: PetActor[] = [];
  private petKey = '';
  private t = 0;
  /** Picture size in world points once loaded. */
  private picH = PIC_W * 1.5;
  private xuxu: Walker | null = null;
  private bots: Walker[] = [];
  private botKey = '';
  private fx: Fx[] = [];
  /** Open state per house at the last update (for the "house opens" moment). */
  private opened = new Map<string, boolean>();
  private rising: Array<{ h: HouseView; t: number }> = [];
  private night = false;

  constructor(
    private readonly art: Art,
    /** World y of the picture's top. */
    private readonly top: number,
    /** Soft round particle for code-drawn effects. */
    private readonly glow: Texture,
  ) {
    this.root.visible = false;
  }

  /** World y of the bottom of the village (camera stops there). */
  get bottom(): number {
    return this.top + this.picH * 0.9;
  }

  get ready(): boolean {
    return this.ground !== null;
  }

  async load(content: ContentPack): Promise<void> {
    const url = Object.values(URLS)[0];
    if (!url || !content.village) return;
    const tex = await Assets.load<Texture>(url);
    const g = new Sprite(tex);
    const k = PIC_W / tex.width;
    g.scale.set(k);
    g.anchor.set(0.5, 0);
    g.position.set(0, this.top);
    this.picH = tex.height * k;
    // The sky of the picture fades out (smoothstep), so it melts into the parallax sky behind.
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    for (let i = 0; i <= 10; i++) {
      const y = i / 10;
      const t = Math.min(1, Math.max(0, (y - FADE * 0.55) / (FADE * 0.45)));
      const a = t * t * (3 - 2 * t);
      grad.addColorStop(y, `rgba(255,255,255,${a})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    const mask = new Sprite(Texture.from(c));
    mask.width = PIC_W;
    mask.height = this.picH;
    mask.position.set(-PIC_W / 2, this.top);
    this.root.addChild(g, mask);
    g.mask = mask;
    this.ground = g;
    for (const h of content.village.houses) this.addHouse(h.id, h.art, PLOTS[h.plot] ?? [0.5, 0.6], h.unlockLevel);
    // Plot 9: the sign for the Dinh Phú Bà (later).
    const sign = new Text({ text: 'Bảng Phú Bà\n(Dinh sắp xây)', style: { fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: '700', fill: 0x5b3a1e, align: 'center' } });
    sign.anchor.set(0.5);
    const board = new Graphics().roundRect(-80, -34, 160, 68, 12).fill(0xe8c891).stroke({ color: 0x8a5a2b, width: 4 });
    const [sx, sy] = PLOTS[9]!;
    const s = new Container();
    s.addChild(board, sign);
    s.position.set((sx - 0.5) * PIC_W, this.top + sy * this.picH - 30);
    this.root.addChild(s);
    if (content.fishing) this.addHouse('river', 'village/rod', RIVER, content.fishing.unlockLevel, 0.9);
    this.addEffects();
    if (this.art.has('xuxu/wave')) {
      const s = new Sprite(this.art.get('xuxu/wave'));
      s.anchor.set(0.5, 1);
      const base = 110 / Math.max(1, s.texture.height);
      s.scale.set(base);
      this.root.addChild(s);
      this.xuxu = { s, path: XUXU_PATH, leg: 0, t: 0, speed: 0.045, wait: 0, base };
    }
    this.root.visible = true;
  }

  private at(p: [number, number]): { x: number; y: number } {
    return { x: (p[0] - 0.5) * PIC_W, y: this.top + p[1] * this.picH };
  }

  /** Idle motion drawn by code (§ D1): kiln fire and smoke, birds round the tower, the gate's swirl,
   *  market lanterns glowing, glints on the river. */
  private addEffects(): void {
    const house = (id: string) => this.houses.find((h) => h.id === id);
    const add = (kind: Fx['kind'], x: number, y: number, n: number, tint: number, blend: 'add' | 'normal' = 'add') => {
      for (let i = 0; i < n; i++) {
        const s = new Sprite(this.glow);
        s.anchor.set(0.5);
        s.blendMode = blend;
        s.tint = tint;
        this.root.addChild(s);
        this.fx.push({ s, kind, x, y, phase: i / n });
      }
    };
    const kiln = house('kiln');
    if (kiln) {
      const top = kiln.root.y - kiln.pic.height;
      add('fire', kiln.root.x + 6, kiln.root.y - kiln.pic.height * 0.32, 1, 0xff9a3c);
      add('smoke', kiln.root.x + kiln.pic.width * 0.1, top + 10, 5, 0xd8d2cc, 'normal');
    }
    const birds = house('birds');
    if (birds) add('bird', birds.root.x, birds.root.y - birds.pic.height * 0.85, 3, 0x6a5a7a, 'normal');
    const gate = house('gate');
    if (gate) add('glow', gate.root.x, gate.root.y - gate.pic.height * 0.45, 1, 0x9fe8ff);
    const market = house('market');
    if (market) add('glow', market.root.x - market.pic.width * 0.25, market.root.y - market.pic.height * 0.55, 2, 0xffd27a);
    const r = this.at(RIVER);
    add('glint', r.x - 60, r.y + 40, 7, 0xffffff);
  }

  private addHouse(id: string, frame: string, at: [number, number], unlockLevel: number, scale = HOUSE_SCALE): void {
    const root = new Container();
    root.position.set((at[0] - 0.5) * PIC_W, this.top + at[1] * this.picH + 18);
    const pic = new Sprite(this.art.has(frame) ? this.art.get(frame) : Texture.EMPTY);
    pic.anchor.copyFrom(pic.texture.defaultAnchor ?? { x: 0.5, y: 1 });
    pic.scale.set(scale);
    const label = { fontFamily: 'system-ui, sans-serif', fontWeight: '700' as const, stroke: { color: 0x2b2620, width: 5 } };
    const lock = new Text({ text: `🔒 Mở ở cấp ${unlockLevel}`, style: { ...label, fontSize: 20, fill: 0xffffff } });
    lock.anchor.set(0.5, 0);
    lock.y = 6;
    const level = new Text({ text: '', style: { ...label, fontSize: 18, fill: 0xffe08a } });
    level.anchor.set(0.5, 0);
    level.y = 6;
    const bubble = new Container();
    const bubbleText = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: '700', fill: 0x3a2a12 } });
    bubbleText.anchor.set(0.5);
    bubble.addChild(new Graphics(), bubbleText);
    bubble.y = -pic.height - 14;
    bubble.visible = false;
    root.addChild(pic, lock, level, bubble);
    const view = { id, root, pic, bubble, bubbleText, lock, level, phase: this.houses.length * 0.7 };
    if (id === 'river') this.river = view;
    else this.houses.push(view);
    this.root.addChild(root);
  }

  /** Locks, levels and roof bubbles (on game events, not every frame). */
  update(content: ContentPack, state: GameState, now: number): void {
    if (!this.ground) return;
    const alerts = new Map(houseAlerts(content, state, now).map((a) => [a.house, a.text]));
    const all = this.river ? [...this.houses, this.river] : this.houses;
    for (const h of all) {
      const open = h.id === 'river' ? state.player.level >= (content.fishing?.unlockLevel ?? Infinity) : houseOpen(content, state, h.id);
      h.pic.alpha = open ? 1 : 0.45;
      h.lock.visible = !open;
      h.level.visible = open && h.id !== 'river';
      if (h.level.visible) h.level.text = `Cấp ${houseLevel(state, h.id)}`;
      const text = open ? alerts.get(h.id) : undefined;
      h.bubble.visible = !!text;
      if (text && h.bubbleText.text !== text) {
        h.bubbleText.text = text;
        const w = h.bubbleText.width + 28;
        const g = h.bubble.children[0] as Graphics;
        g.clear().roundRect(-w / 2, -22, w, 44, 22).fill(0xfff6dc).stroke({ color: 0xe0b14a, width: 3 }).poly([-10, 20, 10, 20, 0, 34]).fill(0xfff6dc);
      }
    }
    // House just opened (level-up): dust puff and it rises with a bounce (§ D1).
    for (const h of all) {
      const open = !h.lock.visible;
      const was = this.opened.get(h.id);
      if (was === false && open) this.rising.push({ h, t: 0 });
      this.opened.set(h.id, open);
    }
    this.night = isNight(content, now);
    // One or two neighbours drop by the market (§ D1), changing every few hours.
    const ids = Object.keys(state.neighbors).sort();
    const slot = Math.floor(now / (3 * 3_600_000));
    const visitors = ids.length && houseOpen(content, state, 'market') ? [ids[slot % ids.length]!, ...(slot % 3 === 0 ? [ids[(slot * 7 + 3) % ids.length]!] : [])] : [];
    const bk = visitors.join(',');
    if (bk !== this.botKey) {
      this.botKey = bk;
      for (const b of this.bots) b.s.destroy();
      this.bots = [];
      const market = this.houses.find((h) => h.id === 'market');
      visitors.forEach((id, i) => {
        if (!market) return;
        const img = new Image();
        img.src = `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(id))}`;
        const s = new Sprite(Texture.EMPTY);
        s.anchor.set(0.5, 1);
        this.root.addChild(s);
        const stand: [number, number] = [(market.root.x + (i ? 70 : -60)) / PIC_W + 0.5, (market.root.y + 26 - this.top) / this.picH];
        const w: Walker = { s, path: [BOT_FROM, stand], leg: 0, t: 0, speed: 0.09, wait: 2 + i * 3, base: 1 };
        this.bots.push(w);
        void img.decode().then(() => {
          if (s.destroyed) return;
          // Drawn onto a canvas at a fixed size (the SVG has only a viewBox).
          const c = document.createElement('canvas');
          c.width = c.height = 96;
          c.getContext('2d')!.drawImage(img, 0, 0, 96, 96);
          s.texture = Texture.from(c);
          w.base = 58 / 96;
          s.scale.set(w.base);
        });
      });
    }
    // Pets that are not walked play in the village (§ D1).
    const home = state.pets.filter((p) => !p.active || (p.awayUntil ?? 0) > now);
    const key = home.map((p) => p.species).join(',');
    if (key !== this.petKey) {
      this.petKey = key;
      for (const p of this.pets) p.sprite.destroy();
      this.pets = [];
      home.forEach((p, i) => {
        const sp = content.pets?.species.find((s) => s.id === p.species);
        if (!sp) return;
        const y = this.top + 0.74 * this.picH;
        const actor = PetActor.fromFrames(this.art, sp.art, sp.poses, 300 + i * 17, -420, 420);
        if (!actor) return;
        if (sp.art.startsWith('pet/')) ((actor.baseScale = 0.62), (actor.facesRight = true));
        actor.sprite.position.set(-300 + i * 180, y);
        this.pets.push(actor);
        this.root.addChild(actor.sprite);
      });
    }
  }

  /** Bubbles bounce every 2 s; pets play. */
  animate(dtMs: number, visible: boolean): void {
    if (!this.ground || !visible) return;
    this.t += dtMs / 1000;
    for (const h of this.houses) {
      if (!h.bubble.visible) continue;
      const p = ((this.t + h.phase) % 2) / 2;
      h.bubble.y = -h.pic.height - 14 - (p < 0.2 ? Math.sin((p / 0.2) * Math.PI) * 10 : 0);
    }
    for (const p of this.pets) p.update(dtMs, true);
    const dt = dtMs / 1000;
    // Xu Xu strolls the roads by day and naps at night.
    if (this.xuxu) {
      const x = this.xuxu;
      if (this.night && this.art.has('xuxu/sleep')) {
        x.s.texture = this.art.get('xuxu/sleep');
        x.s.scale.set(x.base, x.base * (1 + 0.02 * Math.sin(this.t * 1.6)));
      } else this.walk(x, dt, true);
    }
    for (const b of this.bots) this.walk(b, dt, false);
    for (const f of this.fx) {
      const k = (this.t * 0.25 + f.phase) % 1;
      switch (f.kind) {
        case 'smoke':
          f.s.position.set(f.x + Math.sin((this.t + f.phase * 6) * 0.9) * 10 + k * 18, f.y - k * 110);
          f.s.scale.set(0.35 + k * 0.9);
          f.s.alpha = 0.45 * Math.sin(k * Math.PI);
          break;
        case 'fire':
          f.s.position.set(f.x, f.y);
          f.s.scale.set(0.35 + 0.06 * Math.sin(this.t * 13) + 0.04 * Math.sin(this.t * 7.3));
          f.s.alpha = 0.45 + 0.2 * Math.sin(this.t * 9.1);
          break;
        case 'glow':
          f.s.position.set(f.x + f.phase * 120, f.y);
          f.s.scale.set(0.45 + 0.08 * Math.sin(this.t * 1.8 + f.phase * 3));
          f.s.alpha = (this.night ? 0.5 : 0.22) + 0.1 * Math.sin(this.t * 2.2 + f.phase * 5);
          break;
        case 'glint': {
          const tw = Math.max(0, Math.sin(this.t * 2.6 + f.phase * 17));
          f.s.position.set(f.x + ((f.phase * 7.3) % 1) * 260, f.y + ((f.phase * 3.1) % 1) * 40);
          f.s.scale.set(0.12 + tw * 0.12);
          f.s.alpha = tw * 0.8;
          break;
        }
        case 'bird': {
          const a = this.t * 0.9 + f.phase * Math.PI * 2;
          f.s.position.set(f.x + Math.cos(a) * 60, f.y + Math.sin(a * 2) * 14);
          f.s.scale.set(0.12, 0.08 + 0.04 * Math.sin(this.t * 14 + f.phase * 9));
          f.s.alpha = this.night ? 0 : 0.9;
          break;
        }
      }
    }
    // Opening houses: rise with a bounce, dust puffs around the plot.
    this.rising = this.rising.filter((r) => {
      r.t += dt;
      const p = Math.min(1, r.t / 0.9);
      const back = 1.70158;
      const e = 1 + (back + 1) * Math.pow(p - 1, 3) + back * Math.pow(p - 1, 2);
      r.h.pic.scale.set(HOUSE_SCALE * (0.4 + 0.6 * e));
      r.h.pic.alpha = Math.min(1, 0.45 + p);
      return p < 1;
    });
  }

  /** Moves a walker along its path (looping for Xu Xu; neighbours come, wait, go back and come again). */
  private walk(w: Walker, dt: number, loop: boolean): void {
    if (w.wait > 0) {
      w.wait -= dt;
      w.s.scale.y = w.base * (1 + 0.015 * Math.sin(this.t * 2.4));
      return;
    }
    if (this.xuxu === w && this.art.has('xuxu/wave') && w.s.texture !== this.art.get('xuxu/wave')) w.s.texture = this.art.get('xuxu/wave');
    const a = this.at(w.path[w.leg % w.path.length]!);
    const b = this.at(w.path[(w.leg + 1) % w.path.length]!);
    const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    w.t += (dt * w.speed * PIC_W) / len;
    const t = Math.min(1, w.t);
    w.s.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.abs(Math.sin(this.t * 8)) * 5);
    w.s.scale.x = w.base * (b.x < a.x ? -1 : 1);
    w.s.scale.y = w.base;
    if (w.t < 1) return;
    w.t = 0;
    if (loop) {
      w.leg = (w.leg + 1) % w.path.length;
      if (w.leg === 0) w.wait = 4;
    } else {
      // Neighbours: at the market wait a while, then walk back; at the bridge wait and come again.
      w.path = [w.path[1]!, w.path[0]!];
      w.wait = w.path[0] === BOT_FROM ? 12 : 8;
    }
  }

  /** The house (or "river", or "sign") under a world point. */
  hitAt(x: number, y: number): string | null {
    if (!this.ground) return null;
    const all = this.river ? [...this.houses, this.river] : this.houses;
    for (const h of [...all].reverse()) {
      const b = h.pic.getLocalBounds();
      const lx = x - h.root.x;
      const ly = y - h.root.y;
      if (lx >= b.x * h.pic.scale.x - 10 && lx <= (b.x + b.width) * h.pic.scale.x + 10 && ly >= (b.y * h.pic.scale.y) - 60 && ly <= 30) return h.id;
    }
    const [sx, sy] = PLOTS[9]!;
    if (Math.abs(x - (sx - 0.5) * PIC_W) < 90 && Math.abs(y - (this.top + sy * this.picH - 30)) < 50) return 'sign';
    return null;
  }
}
