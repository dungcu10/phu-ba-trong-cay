// The PixiJS view of a garden, front view 2.5D (REDESIGN_V2 1): sky, the ancient climbing vine on
// the left, cloud floors stacked along it. Each floor holds 6–10 pots (fewer pots = bigger pots),
// an expansion spot ("+") while it can grow, and a wooden sign with its name and stars. The next
// floor to open floats above, faded. Drag vertically to climb the vine.
// The view draws a GardenModel: the player's own garden or a neighbour's while visiting. It reads
// state and reports input; it never changes state itself.

import { Application, Container, Graphics, Point, Rectangle, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import type { FloorDef } from '../core/content.ts';
import type { SlotRef } from '../core/game.ts';
import type { GameSession } from '../app/session.ts';
import { formatNumber } from '../ui/text.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { Art } from './assets.ts';
import { Effects } from './effects.ts';
import { Ambience } from './ambience.ts';
import { homeGarden, type GardenFloor, type GardenModel } from './garden.ts';
import { SLOT_GEOM, SlotView } from './slotView.ts';
import { ease, Tweens } from './tween.ts';

export type RendererPreference = 'webgpu' | 'webgl';

/** World layout in points. The floor art is stretched to hold a row of pots. */
const WORLD = {
  floorCenterX: 650,
  floorScale: { x: 1.72, y: 1.25 },
  floorGap: 430,
  potRowSpan: 940,
  /** Pot scale for 10 positions, and how much bigger each missing position makes the rest. */
  potScale10: 0.9,
  potScaleStep: 0.085,
  potScaleMax: 1.25,
  signY: 96,
  trunk: { x: 40, y: 430 },
  /** Region of one floor that must stay on screen: trunk to last pot, markers to the sign. */
  view: { left: -100, right: 1180, top: -280, bottom: 240 },
};
/** How often plant stages, bugs and timers are re-read from the simulation. */
const STATUS_REFRESH_MS = 250;
/** Movement (screen px) that decides between a vertical climb and a sweep across pots. */
const DRAG_DECIDE_PX = 12;

export interface ViewHandlers {
  onTap(slot: SlotRef, target: 'pot' | 'bug'): void;
  onSwipe(slot: SlotRef): void;
  onLockedFloor(floor: FloorDef): void;
  onExpand(floor: number): void;
  onFloorSign(floor: number): void;
}

interface FloorView {
  key: string;
  container: Container;
  slots: SlotView[];
  ghost: Container | null;
  sign: Container;
  signKey: string;
  phase: number;
  /** True while an animation drives the container position. */
  animating: boolean;
}

type Drag = {
  start: number;
  floor: number;
  visited: Set<string>;
  mode: 'undecided' | 'sweep' | 'climb';
  target: 'pot' | 'bug';
  x0: number;
  y0: number;
  scroll0: number;
};

const C = TOKENS.color;

export class GameView {
  readonly effects = new Effects();
  readonly tweens = new Tweens();
  /** Soft round particle (code-drawn effect), tinted per use: water drops, sparkles, auras. */
  readonly dot: Texture;
  /** Soft radial glow (code-drawn effect) for pot auras. */
  readonly glow: Texture;
  private readonly world = new Container();
  private readonly floorsLayer = new Container();
  private readonly trunkLayer = new Container();
  private readonly sky: Sprite;
  private readonly ambience: Ambience;
  private floors: FloorView[] = [];
  private locked: { container: Container; def: FloorDef; info: Text } | null = null;
  private readonly tmp = new Point();
  private sinceRefresh = 0;
  private elapsed = 0;
  private drag: Drag | null = null;
  private scale = 1;
  private baseY = 0;
  /** Camera height in world points (0 = first floor). */
  private scroll = 0;
  private scrollVelocity = 0;
  private model: GardenModel;
  /** Where the garden comes from: the player's own by default, a neighbour's while visiting. */
  private source: () => GardenModel;
  handlers: ViewHandlers | null = null;
  /** Called every frame with the frame duration (dev FPS meter). */
  onFrame: ((dtMs: number) => void) | null = null;

  private constructor(
    readonly app: Application,
    private readonly session: GameSession,
    private readonly art: Art,
  ) {
    this.dot = app.renderer.generateTexture(new Graphics().circle(0, 0, 10).fill(0xffffff));
    this.glow = GameView.glowTexture();
    this.sky = new Sprite(art.sky);
    this.sky.anchor.set(0.5);
    this.ambience = new Ambience(this.glow);
    app.stage.addChild(this.sky, this.ambience.back);
    this.world.addChild(this.floorsLayer, this.trunkLayer, this.effects);
    app.stage.addChild(this.world, this.ambience.front);
    this.source = () => homeGarden(session.content, session.state, session.now());
    this.model = this.source();

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', (e) => this.onDown(e));
    app.stage.on('globalpointermove', (e) => this.onMove(e));
    app.stage.on('pointerup', () => this.onUp());
    app.stage.on('pointerupoutside', () => this.onUp());
    app.canvas.addEventListener('wheel', (e) => this.setScroll(this.scroll + e.deltaY / this.scale), { passive: true });
    app.ticker.add((tk) => this.frame(tk.deltaMS));
    this.syncFloors();
    this.layout();
  }

  private static glowTexture(): Texture {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return Texture.from(c);
  }

  static async create(host: HTMLElement, session: GameSession, art: Art, preference: RendererPreference): Promise<GameView> {
    const app = new Application();
    await app.init({
      preference,
      resizeTo: host,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      background: hex(C.brand.sky),
      antialias: false,
      powerPreference: 'high-performance',
    });
    host.append(app.canvas);
    const view = new GameView(app, session, art);
    app.renderer.on('resize', () => view.layout());
    return view;
  }

  get rendererName(): string {
    return this.app.renderer.name;
  }

  get mode(): GardenModel['mode'] {
    return this.model.mode;
  }

  /** Shows another garden (a neighbour's), or the player's own again with null. */
  setSource(source: (() => GardenModel) | null): void {
    this.source = source ?? (() => homeGarden(this.session.content, this.session.state, this.session.now()));
    for (const fv of this.floors) fv.container.destroy({ children: true });
    this.floors = [];
    this.scroll = 0;
    this.scrollVelocity = 0;
    this.syncFloors();
    this.layout();
    // Floors rise into place, pots pop in one after another.
    this.floors.forEach((fv, fi) => {
      fv.container.alpha = 0;
      fv.animating = true;
      this.tweens.add(
        TOKENS.world.floorExpandMs * 1.6,
        ease.outBack,
        (t) => {
          fv.container.alpha = Math.min(1, t * 1.6);
          fv.container.y = this.floorY(fi) + (1 - t) * 90;
        },
        () => (fv.animating = false),
        fv.container,
      );
    });
  }

  private floorY(index: number): number {
    return -index * WORLD.floorGap;
  }

  private floorKey(f: GardenFloor): string {
    return `${this.model.mode}|${f.def.id}|${f.pots.length}|${f.expandCost !== null}`;
  }

  /** Rebuilds floors whose structure changed (unlocked, expanded, new garden), and the vine. */
  syncFloors(): void {
    this.model = this.source();
    const floors = this.model.floors;
    let changed = false;
    floors.forEach((f, fi) => {
      const key = this.floorKey(f);
      const old = this.floors[fi];
      if (old && old.key === key) return;
      const grownSlot = old && old.slots.length + 1 === f.pots.length && old.key.split('|')[1] === f.def.id ? f.pots.length - 1 : -1;
      const keepY = old?.animating ? null : old?.container.y;
      old?.container.destroy({ children: true });
      const fv = this.buildFloor(f, fi);
      if (keepY !== null && keepY !== undefined) fv.container.y = keepY;
      this.floors[fi] = fv;
      changed = true;
      if (grownSlot >= 0) this.popNewSlot(fv, grownSlot);
    });
    for (const extra of this.floors.splice(floors.length)) extra.container.destroy({ children: true });
    if (changed || this.trunkLayer.children.length === 0) this.buildTrunk();
    this.buildLockedPreview();
    this.refresh();
  }

  private cloudSprite(def: FloorDef): Sprite {
    const start = this.session.content.floors.get(this.session.content.config.startFloor)!;
    const look = this.art.floor(def.sprite, def.tint, start.sprite);
    const cloud = new Sprite(look.texture);
    cloud.tint = look.tint;
    cloud.anchor.copyFrom(look.texture.defaultAnchor ?? { x: 0.5, y: 0.2 });
    cloud.scale.set(WORLD.floorScale.x, WORLD.floorScale.y);
    return cloud;
  }

  private text(text: string, size: number, fill: string = C.ui.textOnDark, stroke: string = C.ui.wood): Text {
    const t = new Text({
      text,
      style: { fontFamily: `"${TOKENS.font.display}", sans-serif`, fontWeight: '800', fontSize: size, fill: hex(fill), stroke: { color: hex(stroke), width: 6, join: 'round' }, align: 'center' },
      resolution: 2,
    });
    t.anchor.set(0.5);
    return t;
  }

  private star(g: Graphics, x: number, y: number, r: number, filled: boolean): void {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.poly(pts).fill({ color: hex(filled ? C.brand.gold : C.ui.paper), alpha: filled ? 1 : 0.55 }).stroke({ color: hex(C.ui.number), width: 2.5, join: 'round' });
  }

  /** Wooden sign under a floor: stars, name, and the completed pot set if any. */
  private buildSign(f: GardenFloor): Container {
    const sign = new Container();
    const name = this.text(f.def.name.vi, TOKENS.font.size.label);
    const maxStars = f.def.stars.length;
    const starsW = maxStars > 0 ? maxStars * 30 + 10 : 0;
    const w = name.width + starsW + 44;
    const g = new Graphics();
    g.roundRect(-w / 2 + 3, 5, w, 48, 18).fill({ color: hex(C.ui.wood), alpha: 0.35 });
    g.roundRect(-w / 2, 0, w, 48, 18).fill(hex(C.ui.wood)).stroke({ color: hex(C.ui.number), width: 3 });
    g.roundRect(-w / 2 + 6, 5, w - 12, 10, 5).fill({ color: 0xffffff, alpha: 0.12 });
    for (let i = 0; i < maxStars; i++) this.star(g, -w / 2 + 30 + i * 30, 24, 12, i < f.stars);
    name.position.set(-w / 2 + 22 + starsW + name.width / 2, 25);
    sign.addChild(g, name);
    if (f.setName) {
      const set = this.text(`Bộ ${f.setName}`, TOKENS.font.size.caption, C.ui.textOnDark, C.brand.jade);
      set.position.set(0, 64);
      sign.addChild(set);
    }
    sign.position.set(0, WORLD.signY);
    return sign;
  }

  private signKey(f: GardenFloor): string {
    return `${f.stars}|${f.setName ?? ''}`;
  }

  /** The spot where the next pot will go: a soft cloud puff with a "+" and the price. */
  private buildGhost(cost: number, scale: number): Container {
    const ghost = new Container();
    const g = new Graphics();
    g.ellipse(0, -8, 52, 16).fill({ color: hex(C.ui.wood), alpha: 0.18 });
    g.circle(0, -62, 50).fill(hex(C.ui.wood));
    g.circle(0, -62, 46).fill(hex(C.brand.gold));
    g.circle(0, -62, 40).fill({ color: hex(C.ui.paper), alpha: 0.92 });
    g.ellipse(-10, -86, 22, 9).fill({ color: 0xffffff, alpha: 0.6 });
    g.roundRect(-6, -86, 12, 48, 6).fill(hex(C.brand.gold));
    g.roundRect(-24, -68, 48, 12, 6).fill(hex(C.brand.gold));
    const price = this.text(`${formatNumber(cost)} xu`, TOKENS.font.size.caption, C.ui.textOnDark, C.ui.wood);
    price.position.set(0, 12);
    const label = this.text('Thêm chậu', TOKENS.font.size.caption, C.ui.textOnDark, C.ui.wood);
    label.position.set(0, -128);
    ghost.addChild(g, label, price);
    ghost.scale.set(scale);
    return ghost;
  }

  private buildFloor(f: GardenFloor, fi: number): FloorView {
    const container = new Container();
    container.position.set(WORLD.floorCenterX, this.floorY(fi));
    container.addChild(this.cloudSprite(f.def));
    const positions = f.pots.length + (f.expandCost !== null ? 1 : 0);
    const scale = Math.min(WORLD.potScaleMax, WORLD.potScale10 + (10 - positions) * WORLD.potScaleStep);
    const spacing = positions > 1 ? WORLD.potRowSpan / (positions - 1) : 0;
    const x = (i: number) => -WORLD.potRowSpan / 2 + i * spacing;
    const slots: SlotView[] = [];
    // Pots of the whole floor sit in one layer under all plants and markers (directive 03 step 4).
    const potLayer = new Container();
    container.addChild(potLayer);
    f.pots.forEach((_, i) => {
      const view = new SlotView(fi, i, this.art, this.tweens, this.dot, this.glow);
      view.position.set(x(i), 4);
      view.scale.set(scale);
      slots.push(view);
      potLayer.addChild(view.back);
      container.addChild(view);
    });
    let ghost: Container | null = null;
    if (f.expandCost !== null) {
      ghost = this.buildGhost(f.expandCost, scale);
      ghost.position.set(x(f.pots.length), 4);
      container.addChild(ghost);
    }
    const sign = this.buildSign(f);
    container.addChild(sign);
    this.floorsLayer.addChild(container);
    return { key: this.floorKey(f), container, slots, ghost, sign, signKey: this.signKey(f), phase: fi * 1.7, animating: false };
  }

  private popNewSlot(fv: FloorView, i: number): void {
    const s = fv.slots[i];
    if (!s) return;
    const target = s.scale.x;
    s.scale.set(0);
    this.tweens.add(TOKENS.motion.bounce.ms * 3, ease.outBack, (t) => s.scale.set(target * t), undefined, s);
    const p = s.feedbackPoint();
    this.effects.burst(this.dot, p.x, p.y + 40, 14, { scale: 0.55, speed: 380, tint: hex(C.brand.gold) });
  }

  /** The vine: its base under the first floor, middle sections repeated up to the top floor. */
  private buildTrunk(): void {
    this.trunkLayer.removeChildren().forEach((c) => c.destroy());
    const full = this.art.get('trunk');
    const base = new Sprite(full);
    base.anchor.copyFrom(full.defaultAnchor ?? { x: 0.5, y: 1 });
    base.position.set(WORLD.trunk.x, WORLD.trunk.y);
    // Middle band of the trunk picture, repeated upward (chờ ảnh đoạn thân V2 ghép liền mạch).
    const f = full.frame;
    const band = new Texture({ source: full.source, frame: new Rectangle(f.x, f.y + f.height * 0.3, f.width, f.height * 0.4) });
    const top = this.floorY(this.floors.length) - 260;
    let y = WORLD.trunk.y - full.height * 0.62;
    while (y > top) {
      const seg = new Sprite(band);
      seg.anchor.set(0.5, 1);
      seg.position.set(WORLD.trunk.x, y + 2);
      this.trunkLayer.addChild(seg);
      y -= band.height;
    }
    this.trunkLayer.addChild(base);
  }

  private buildLockedPreview(): void {
    const def = this.model.locked;
    if (this.locked && this.locked.def === def && this.locked.container.y === this.floorY(this.floors.length)) return;
    if (this.locked) {
      this.locked.container.destroy({ children: true });
      this.locked = null;
    }
    if (!def) return;
    const container = new Container();
    container.position.set(WORLD.floorCenterX, this.floorY(this.floors.length));
    const cloud = this.cloudSprite(def);
    cloud.alpha = 0.5;
    // A signboard sits on the faded cloud, low enough to stay clear of the HUD and the hint line.
    const g = new Graphics();
    g.roundRect(-230, 72, 460, 112, 24).fill({ color: hex(C.ui.wood), alpha: 0.92 }).stroke({ color: hex(C.ui.number), width: 3 });
    const name = this.text(`Tầng ${this.floors.length + 1} · ${def.name.vi}`, TOKENS.font.size.window);
    name.position.set(0, 106);
    const info = this.text('', TOKENS.font.size.label, C.brand.cream);
    info.position.set(0, 154);
    container.addChild(cloud, g, name, info);
    this.floorsLayer.addChild(container);
    this.locked = { container, def, info };
    this.updateLockedInfo();
  }

  private updateLockedInfo(): void {
    if (!this.locked) return;
    const { def, info } = this.locked;
    const p = this.session.state.player;
    const ready = p.level >= def.unlockLevel && p.coins >= def.unlockCost;
    const text = ready ? 'Chạm để mở tầng mới!' : `Cấp ${def.unlockLevel} · ${formatNumber(def.unlockCost)} xu`;
    if (info.text !== text) info.text = text;
  }

  /** Fits one floor's width to the screen; works in landscape and portrait. */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const k = Math.max(w / this.art.sky.width, h / this.art.sky.height);
    this.sky.scale.set(k);
    this.sky.position.set(w / 2, h / 2);
    this.ambience.resize(w, h);
    const v = WORLD.view;
    const hud = TOKENS.touch.primary + (TOKENS.space[5] ?? 0);
    this.scale = Math.min((w * 0.97) / (v.right - v.left), (h - hud - TOKENS.layout.bottomInset) / (v.bottom - v.top));
    this.world.scale.set(this.scale);
    this.world.x = w / 2 - ((v.left + v.right) / 2) * this.scale;
    this.baseY = hud + (h - hud) / 2 - ((v.top + v.bottom) / 2) * this.scale;
    this.applyScroll();
    this.app.stage.hitArea = this.app.screen;
  }

  private maxScroll(): number {
    return (this.floors.length - 1) * WORLD.floorGap + (this.locked ? WORLD.floorGap * 0.55 : 0);
  }

  private setScroll(value: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll(), value));
    this.applyScroll();
  }

  private applyScroll(): void {
    this.world.y = this.baseY + this.scroll * this.scale;
  }

  /** Smoothly moves the camera to a floor. */
  focusFloor(index: number, durationMs: number = TOKENS.world.floorOpen.cameraMs): void {
    const from = this.scroll;
    const to = Math.max(0, Math.min(this.maxScroll(), index * WORLD.floorGap));
    this.scrollVelocity = 0;
    this.tweens.add(durationMs, ease.inOutSine, (t) => this.setScroll(from + (to - from) * t));
  }

  /** Celebration when a floor opens: camera glides up, the floor rises with a bounce, pots pop in. */
  playFloorOpened(index: number): void {
    const fv = this.floors[index];
    if (!fv) return;
    this.focusFloor(index);
    const y = this.floorY(index);
    fv.animating = true;
    this.tweens.add(
      TOKENS.world.floorExpandMs * 2,
      ease.outBack,
      (t) => {
        fv.container.y = y + (1 - t) * 160;
        fv.container.alpha = Math.min(1, t * 1.5);
      },
      () => (fv.animating = false),
      fv.container,
    );
    const open = TOKENS.world.floorOpen;
    fv.slots.forEach((s, i) => {
      const target = s.scale.x;
      s.scale.set(0);
      setTimeout(() => {
        if (!s.destroyed) this.tweens.add(TOKENS.motion.bounce.ms * 2, ease.outBack, (t) => s.scale.set(target * t), undefined, s);
      }, open.cameraMs + i * open.slotStaggerMs);
    });
    for (let k = 0; k < 4; k++) {
      setTimeout(() => this.effects.burst(this.dot, WORLD.floorCenterX - 400 + k * 260, y - 120, 10, { scale: 0.6, speed: 420, tint: hex(C.brand.gold) }), open.cameraMs + k * 160);
    }
  }

  /** A new star on a floor sign: the sign hops and sparkles. */
  playStar(index: number): void {
    const fv = this.floors[index];
    if (!fv) return;
    this.refresh();
    const sign = fv.sign;
    this.tweens.add(TOKENS.motion.bounce.ms * 3, ease.outElastic, (t) => sign.scale.set(0.7 + 0.3 * t), undefined, sign);
    const p = { x: fv.container.x + sign.x, y: fv.container.y + sign.y + 20 };
    this.effects.burst(this.dot, p.x, p.y, 18, { scale: 0.55, speed: 360, tint: hex(C.brand.gold) });
  }

  /** Re-reads every pot from the model. Cheap: a few pure function calls. */
  refresh(): void {
    this.model = this.source();
    if (this.model.floors.length !== this.floors.length || this.model.floors.some((f, i) => this.floors[i]?.key !== this.floorKey(f))) {
      this.syncFloors();
      return;
    }
    const rarityColors = C.rarity as Record<string, string>;
    this.model.floors.forEach((f, fi) => {
      const fv = this.floors[fi]!;
      const sk = this.signKey(f);
      if (sk !== fv.signKey) {
        const at = fv.container.getChildIndex(fv.sign);
        fv.sign.destroy({ children: true });
        fv.sign = this.buildSign(f);
        fv.signKey = sk;
        fv.container.addChildAt(fv.sign, at);
      }
      f.pots.forEach((p, i) => {
        const view = fv.slots[i];
        if (!view) return;
        view.setPot(`${p.pot.id}/${p.level}`, this.art.pot(p.pot, p.level, rarityColors[p.pot.rarity] ?? C.rarity.common), p.step);
        view.setTier(p.tier);
        view.setStatus(p.status);
      });
    });
    this.updateLockedInfo();
  }

  /** Converts a screen point (CSS px) to world coordinates (for effects aimed at HTML buttons). */
  screenToWorld(x: number, y: number): { x: number; y: number } {
    const p = this.world.toLocal({ x, y });
    return { x: p.x, y: p.y };
  }

  slotView(floor: number, i: number): SlotView {
    return this.floors[floor]!.slots[i]!;
  }

  private slotAtGlobal(global: { x: number; y: number }): SlotView | null {
    const g = SLOT_GEOM.hit;
    for (const fv of this.floors) {
      for (const view of fv.slots) {
        view.toLocal(global, undefined, this.tmp);
        if (this.tmp.x >= g.x && this.tmp.x <= g.x + g.w && this.tmp.y >= g.y && this.tmp.y <= g.y + g.h) return view;
      }
    }
    return null;
  }

  /** Pot under a screen point (CSS px), for dragging seeds from the HTML tray. */
  slotAtScreen(x: number, y: number): SlotRef | null {
    const v = this.slotAtGlobal({ x, y });
    return v ? { floor: v.floorIndex, slot: v.index } : null;
  }

  private onDown(e: FederatedPointerEvent): void {
    this.scrollVelocity = 0;
    const view = this.slotAtGlobal(e.global);
    let target: 'pot' | 'bug' = 'pot';
    if (view) {
      view.toLocal(e.global, undefined, this.tmp);
      const b = SLOT_GEOM.bugOffset;
      if (Math.hypot(this.tmp.x - b.x, this.tmp.y - b.y) < 40) target = 'bug';
    }
    this.drag = {
      start: view?.index ?? -1,
      floor: view?.floorIndex ?? -1,
      visited: new Set(view ? [`${view.floorIndex}:${view.index}`] : []),
      mode: 'undecided',
      target,
      x0: e.global.x,
      y0: e.global.y,
      scroll0: this.scroll,
    };
  }

  private onMove(e: FederatedPointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.global.x - d.x0;
    const dy = e.global.y - d.y0;
    if (d.mode === 'undecided') {
      if (Math.hypot(dx, dy) < DRAG_DECIDE_PX) return;
      d.mode = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'climb' : 'sweep';
      if (d.mode === 'sweep' && d.start >= 0) this.handlers?.onSwipe({ floor: d.floor, slot: d.start });
    }
    if (d.mode === 'climb') {
      const next = d.scroll0 + dy / this.scale;
      this.scrollVelocity = next - this.scroll;
      this.setScroll(next);
      return;
    }
    const view = this.slotAtGlobal(e.global);
    if (!view) return;
    const key = `${view.floorIndex}:${view.index}`;
    if (d.visited.has(key)) return;
    d.visited.add(key);
    this.handlers?.onSwipe({ floor: view.floorIndex, slot: view.index });
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.mode !== 'undecided') return;
    if (d.start >= 0) return this.handlers?.onTap({ floor: d.floor, slot: d.start }, d.target);
    const hit = (c: Container | null) => c !== null && c.getBounds().containsPoint(d.x0, d.y0);
    const fi = this.floors.findIndex((fv) => hit(fv.ghost));
    if (fi >= 0) return this.handlers?.onExpand(fi);
    const si = this.floors.findIndex((fv) => hit(fv.sign));
    if (si >= 0) return this.handlers?.onFloorSign(si);
    if (this.locked && hit(this.locked.container)) this.handlers?.onLockedFloor(this.locked.def);
  }

  private frame(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    this.elapsed += dt;
    this.tweens.update(dt);
    const bob = TOKENS.world.islandBob;
    const t = this.elapsed / 1000;
    this.floors.forEach((fv, fi) => {
      for (const s of fv.slots) s.animate(this.elapsed);
      if (fv.ghost) fv.ghost.alpha = 0.88 + 0.12 * Math.sin(t * 2.4 + fi);
      if (!fv.animating) fv.container.y = this.floorY(fi) + Math.sin((this.elapsed / bob.periodMs) * Math.PI * 2 + fv.phase) * bob.amplitude;
    });
    if (!this.drag && Math.abs(this.scrollVelocity) > 0.5) {
      this.setScroll(this.scroll + this.scrollVelocity);
      this.scrollVelocity *= 0.92;
    }
    this.effects.update(dt);
    this.ambience.update(dt, this.scroll);
    this.sinceRefresh += dt;
    if (this.sinceRefresh >= STATUS_REFRESH_MS) {
      this.sinceRefresh = 0;
      this.refresh();
    }
    this.onFrame?.(dtMs);
  }
}
