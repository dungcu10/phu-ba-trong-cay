// One pot on a cloud floor: pot, plant, status marker, Bọ Mây, growth bar and timer, plus the
// pot's appearance tier (REDESIGN_V2 2.2): Tinh = warm glow, Thần = aura and orbiting sparkles.
// It only displays a CropStatus computed by the simulation; it never decides game rules.

import { Container, Graphics, Rectangle, Sprite, Text, type Texture } from 'pixi.js';
import type { CropStatus } from '../systems/growth.ts';
import { formatClock } from '../ui/text.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { Art } from './assets.ts';
import { ease, type Tweens } from './tween.ts';

/** Geometry in points, relative to the bottom centre of the pot (its anchor). */
export const SLOT_GEOM = {
  /** Where the plant's base sits: the soil line inside the pot mouth. */
  soilY: -72,
  markerY: -205,
  bugOffset: { x: 30, y: -112 },
  barY: 8,
  barWidth: 76,
  hit: { x: -50, y: -215, w: 100, h: 245 },
} as const;

const C = TOKENS.color;

export class SlotView extends Container {
  private readonly pot: Sprite;
  private readonly plant: Sprite;
  private readonly marker: Graphics;
  private readonly bug: Sprite;
  private readonly bugCount: Text;
  private readonly bar: Graphics;
  private readonly timer: Text;
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly aura: Sprite;
  private readonly shadow: Sprite;
  private readonly studs = new Graphics();
  private potGrow = 1;
  private dropY = 0;
  /** Pot layer, added by the scene to the floor's pot layer under all slots. */
  readonly back = new Container();
  /** Soil line of the current pot picture (pt, negative = up) and its offset from the default. */
  private soilY: number = SLOT_GEOM.soilY;
  private readonly sparkles: Sprite[] = [];
  private tier: 0 | 1 | 2 = 0;
  private bloomT = -1;
  private readonly bloomRing: Graphics;

  private plantKey = '';
  private potKey = '';
  private bugTextures: [Texture, Texture] | null = null;
  private markerKind: 'none' | 'water' | 'ripe' = 'none';
  private shownBugs = 0;
  private sway = 0;
  private family = '';
  private markerScale = 1;
  private plantPop = 1;
  private potPop = 1;
  private lastBar = -2;
  private lastTimer = '';

  constructor(
    readonly floorIndex: number,
    readonly index: number,
    private readonly art: Art,
    private readonly tweens: Tweens,
    dot: Texture,
    glow: Texture,
  ) {
    super();
    this.shadow = new Sprite(glow);
    this.shadow.anchor.set(0.5);
    this.shadow.tint = hex(C.brand.shadow);
    this.shadow.alpha = 0.45;
    this.shadow.scale.set(0.95, 0.22);
    this.shadow.position.set(0, -4);
    this.shadow.zIndex = -3;
    this.aura = new Sprite(glow);
    this.aura.anchor.set(0.5);
    this.aura.position.set(0, -48);
    this.aura.blendMode = 'add';
    this.aura.visible = false;
    for (let i = 0; i < 4; i++) {
      const sp = new Sprite(dot);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.tint = hex(C.brand.gold);
      sp.visible = false;
      this.sparkles.push(sp);
    }
    this.bloomRing = new Graphics();
    this.bloomRing.visible = false;
    this.sortableChildren = true;
    this.aura.zIndex = -2;
    this.plant = new Sprite();
    this.plant.y = SLOT_GEOM.soilY;
    this.pot = new Sprite();
    this.marker = new Graphics();
    this.marker.y = SLOT_GEOM.markerY;
    this.marker.visible = false;
    this.bug = new Sprite();
    this.bug.anchor.set(0.5);
    this.bug.visible = false;
    this.bugCount = new Text({ text: '', style: { fontFamily: `"${TOKENS.font.display}", sans-serif`, fontWeight: '800', fontSize: TOKENS.font.size.caption, fill: hex(C.ui.textOnDark), stroke: { color: hex(C.ui.wood), width: 4, join: 'round' } }, resolution: 2 });
    this.bugCount.anchor.set(0, 1);
    this.bar = new Graphics();
    this.bar.y = SLOT_GEOM.barY;
    this.timer = new Text({ text: '', style: { fontFamily: `"${TOKENS.font.display}", sans-serif`, fontWeight: '800', fontSize: TOKENS.font.size.caption, fill: hex(C.ui.text), stroke: { color: hex(C.ui.paper), width: 4, join: 'round' } }, resolution: 2 });
    this.timer.anchor.set(0.5, 0);
    this.timer.y = SLOT_GEOM.barY + 10;
    // Plant in front of the pot: its base sits on the soil line inside the mouth.
    // The pot and what belongs to it live in `back`, drawn by the floor beneath every plant and
    // marker, so a wide pot (wings, halo) can spill into the next slot without covering its plant
    // (directive 03 step 4). Taps still use this slot's own hit box.
    this.back.sortableChildren = true;
    this.back.addChild(this.shadow, this.aura, this.pot, this.studs);
    this.addChild(this.plant, ...this.sparkles, this.bloomRing, this.bug, this.bugCount, this.marker, this.bar, this.timer);

    const g = SLOT_GEOM.hit;
    this.hitArea = new Rectangle(g.x, g.y, g.w, g.h);
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  /** key identifies pot type + level; look is the picture (possibly a tinted stand-in); step is
   *  the number of small evolutions past the look's milestone: gold studs around the pot's foot
   *  and a slightly larger pot (POT_SYSTEM 2: every level shows). */
  setPot(key: string, look: { texture: Texture; tint: number; soil?: number | null }, step = 0): void {
    if (key === this.potKey) return;
    const changed = this.potKey !== '';
    this.potKey = key;
    this.pot.texture = look.texture;
    this.pot.tint = look.tint;
    this.pot.anchor.copyFrom(this.pot.texture.defaultAnchor ?? { x: 0.5, y: 1 });
    this.potGrow = 1 + Math.min(step, 4) * 0.015;
    // Directive 03 step 3: plants stand on the frame's own soil line (atlas px @2x -> pt).
    this.soilY = look.soil != null ? -look.soil / 2 : SLOT_GEOM.soilY;
    this.drawStuds(step);
    if (changed) this.popPot();
  }

  private drawStuds(step: number): void {
    const g = this.studs;
    g.clear();
    const n = Math.min(step, 4);
    for (let i = 0; i < n; i++) {
      // Studs sit on an arc just above the pot's foot, centred.
      const x = (i - (n - 1) / 2) * 16;
      const y = -10 - Math.abs(x) * 0.12;
      g.circle(x, y, 5.5).fill(hex(C.ui.wood));
      g.circle(x, y, 4).fill(hex(C.brand.gold));
      g.circle(x - 1.2, y - 1.4, 1.4).fill({ color: 0xffffff, alpha: 0.85 });
    }
  }

  /** Appearance tier of the pot (0 Mộc, 1 Tinh, 2 Thần). */
  setTier(tier: 0 | 1 | 2): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.aura.visible = tier > 0;
    this.aura.tint = hex(tier === 2 ? C.brand.gold : C.brand.cream);
    this.sparkles.forEach((sp, i) => (sp.visible = tier === 2 || (tier === 1 && i < 2)));
  }

  /** Harvest: a ring of light opens from the plant and the plant springs up. */
  bloom(): void {
    this.bloomT = 0;
    this.bloomRing.visible = true;
  }

  /** Updates plant, marker, bug and timer from the current status (null = empty pot). */
  setStatus(status: CropStatus | null): void {
    const key = status ? `${status.crop.sprite}/${status.stage}` : '';
    if (key !== this.plantKey) {
      const grew = this.plantKey !== '' && key !== '';
      this.plantKey = key;
      this.plant.visible = key !== '';
      if (key) {
        this.plant.texture = this.art.get(key);
        this.plant.anchor.copyFrom(this.plant.texture.defaultAnchor ?? { x: 0.5, y: 1 });
        if (grew) this.popPlant(0.85);
      }
      this.family = status?.crop.family ?? '';
      this.sway = status && status.stage >= 2 ? 0.03 : 0.012;
    }

    const kind = !status ? 'none' : status.ripe ? 'ripe' : status.thirsty ? 'water' : 'none';
    if (kind !== this.markerKind) {
      this.markerKind = kind;
      this.drawMarker(kind);
      if (kind !== 'none') this.tweens.add(TOKENS.motion.bounce.ms * 2, ease.outBack, (v) => (this.markerScale = v));
    }

    const bugs = status?.bug?.count ?? 0;
    if (bugs > 0 && this.shownBugs === 0) {
      const sprite = status!.bug!.bug.sprite;
      this.bugTextures = [this.art.get(`${sprite}/0`), this.art.get(`${sprite}/1`)];
      this.tweens.add(TOKENS.motion.bounce.ms * 2, ease.outBack, (v) => this.bug.scale.set(0.75 * v), undefined, this);
    }
    this.bug.visible = bugs > 0;
    this.bugCount.visible = bugs > 1;
    if (bugs !== this.shownBugs && bugs > 1) this.bugCount.text = `×${bugs}`;
    this.shownBugs = bugs;

    this.updateTimer(status);
  }

  /** Thirst and ripeness markers, drawn by code (chờ đồ họa đợt 5). */
  private drawMarker(kind: 'none' | 'water' | 'ripe'): void {
    const g = this.marker;
    g.clear();
    g.visible = kind !== 'none';
    if (kind === 'none') return;
    // Jelly bubble: wood rim, gold ring, paper face, glossy cap, little tail (matches the HUD buttons).
    const ring = kind === 'ripe' ? C.brand.gold : C.brand.sky;
    g.ellipse(0, 30, 14, 4).fill({ color: hex(C.brand.shadow), alpha: 0.25 });
    g.poly([-8, 16, 8, 16, 0, 30]).fill(hex(C.ui.wood));
    g.circle(0, 0, 25).fill(hex(C.ui.wood));
    g.circle(0, 0, 22).fill(hex(ring));
    g.circle(0, 0, 18).fill(hex(C.ui.paper));
    g.poly([-5, 17, 5, 17, 0, 25]).fill(hex(C.ui.paper));
    if (kind === 'water') {
      g.circle(0, 5, 9).fill(hex(C.brand.sky));
      g.poly([-8, 1, 8, 1, 0, -13]).fill(hex(C.brand.sky));
      g.ellipse(-3, 3, 2.5, 4).fill({ color: 0xffffff, alpha: 0.8 });
    } else {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 14 : 6.5;
        const a2 = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(Math.cos(a2) * r, Math.sin(a2) * r + 1);
      }
      g.poly(pts).fill(hex(C.brand.gold)).stroke({ color: hex(C.ui.number), width: 2.5, join: 'round' });
      g.circle(-3, -3, 2.5).fill({ color: 0xffffff, alpha: 0.85 });
    }
    g.ellipse(-6, -12, 9, 4).fill({ color: 0xffffff, alpha: 0.6 });
  }

  private updateTimer(status: CropStatus | null): void {
    const growing = status !== null && !status.ripe;
    const label = growing ? formatClock(status.remainingMs) : '';
    if (label !== this.lastTimer) {
      this.lastTimer = label;
      this.timer.text = label;
    }
    const progress = growing ? Math.round(status.progress * 40) / 40 : -1;
    if (progress === this.lastBar) return;
    this.lastBar = progress;
    const w = SLOT_GEOM.barWidth;
    this.bar.clear();
    if (progress < 0) return;
    this.bar.roundRect(-w / 2, 0, w, 9, 4.5).fill({ color: hex(C.ui.wood), alpha: 0.55 });
    this.bar.roundRect(-w / 2 + 2, 2, Math.max(5, (w - 4) * progress), 5, 2.5).fill(hex(C.ui.progress));
  }

  popPlant(from = 0.6): void {
    this.tweens.add(TOKENS.motion.bounce.ms * 2.5, ease.outElastic, (v) => (this.plantPop = from + (1 - from) * v));
  }

  /** A pot just placed: falls in from above and settles with a bounce. */
  dropIn(): void {
    this.tweens.add(TOKENS.motion.bounce.ms * 4, ease.outBounce, (v) => (this.dropY = -160 * (1 - v)));
  }

  popPot(): void {
    this.tweens.add(TOKENS.motion.bounce.ms * 3, ease.outElastic, (v) => (this.potPop = 0.8 + 0.2 * v));
  }

  /** Point in world space (the floor container's parent) where feedback should appear. */
  feedbackPoint(): { x: number; y: number } {
    const fx = this.parent?.x ?? 0;
    const fy = this.parent?.y ?? 0;
    return { x: fx + this.x, y: fy + this.y + (SLOT_GEOM.soilY - 70) * this.scale.y };
  }

  bugPoint(): { x: number; y: number } {
    const fx = this.parent?.x ?? 0;
    const fy = this.parent?.y ?? 0;
    return { x: fx + this.x + this.bug.x * this.scale.x, y: fy + this.y + this.bug.y * this.scale.y };
  }

  /** Per-frame animation only; no game logic, no allocation. */
  animate(timeMs: number): void {
    const t = timeMs / 1000;
    // Each family moves differently (DESIGN_SYSTEM 9): herbs flutter, fruit bob heavily.
    const speed = this.family === 'herb' ? 3.2 : this.family === 'fruit' ? 1.1 : 1.7;
    this.plant.skew.x = Math.sin(t * speed + this.phase) * this.sway;
    let hop = 1;
    if (this.markerKind === 'ripe') {
      const period = TOKENS.motion.ripeHopPeriodMs / 1000;
      const k = ((t + this.phase) % period) / period;
      hop = k < 0.12 ? 1 + Math.sin((k / 0.12) * Math.PI) * 0.07 : 1;
    }
    const squash = 1 + Math.sin(t * 2.1 + this.phase) * 0.01;
    this.plant.scale.set(this.plantPop / squash, this.plantPop * squash * hop);
    this.pot.scale.set(this.potPop * this.potGrow);
    this.pot.y = this.dropY;
    this.studs.y = this.dropY;
    this.back.position.set(this.x, this.y);
    this.back.scale.set(this.scale.x, this.scale.y);
    this.back.visible = this.visible;
    const lift = this.soilY * this.potGrow - SLOT_GEOM.soilY;
    this.plant.y = SLOT_GEOM.soilY + lift + this.dropY;
    this.studs.scale.set(this.potPop);
    if (this.tier > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + this.phase);
      // Glow texture is 128 pt wide: about 1.9× / 1.5× the pot.
      this.aura.scale.set((this.tier === 2 ? 1.9 : 1.5) + pulse * 0.12, (this.tier === 2 ? 1.35 : 1.1) + pulse * 0.08);
      this.aura.alpha = (this.tier === 2 ? 0.75 : 0.5) + pulse * 0.2;
      this.sparkles.forEach((sp, i) => {
        if (!sp.visible) return;
        const a = t * (this.tier === 2 ? 1.4 : 0.9) + (i * Math.PI * 2) / this.sparkles.length + this.phase;
        sp.position.set(Math.cos(a) * 62, -50 + Math.sin(a) * 22 + Math.sin(t * 3 + i) * 6);
        sp.scale.set(0.3 + 0.14 * Math.sin(t * 5 + i * 1.7));
        sp.alpha = 0.6 + 0.4 * Math.sin(t * 4 + i);
        // Sparkles pass behind the pot on the far half of their orbit.
        sp.zIndex = Math.sin(a) < 0 ? -1 : 1;
      });
    }
    if (this.bloomT >= 0) {
      this.bloomT += 1 / 30;
      const k = this.bloomT;
      const g = this.bloomRing;
      g.clear();
      if (k >= 1) {
        this.bloomT = -1;
        g.visible = false;
      } else {
        const r = 30 + k * 110;
        g.circle(0, SLOT_GEOM.soilY - 50, r).stroke({ color: hex(C.brand.gold), width: 10 * (1 - k), alpha: 1 - k });
        g.circle(0, SLOT_GEOM.soilY - 50, r * 0.6).stroke({ color: hex(C.brand.cream), width: 6 * (1 - k), alpha: (1 - k) * 0.8 });
      }
    }
    if (this.marker.visible) {
      this.marker.y = SLOT_GEOM.markerY + Math.min(0, lift) + Math.sin(t * 3 + this.phase) * 4;
      this.marker.scale.set(this.markerScale);
    }
    if (this.bug.visible && this.bugTextures) {
      this.bug.texture = this.bugTextures[Math.floor(t * 8) % 2]!;
      this.bug.x = SLOT_GEOM.bugOffset.x + Math.sin(t * 2.3 + this.phase) * 6;
      this.bug.y = SLOT_GEOM.bugOffset.y + lift + Math.cos(t * 3.1 + this.phase) * 5;
      this.bugCount.position.set(this.bug.x + 16, this.bug.y - 10);
    }
  }
}
