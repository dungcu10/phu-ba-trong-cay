// The PixiJS view of the garden, front view (owner's decision 2026-11-16): sky, the ancient
// climbing vine on the left, cloud floors stacked up along it, each with a row of pots. The next
// floor to open floats above, faded, with its conditions. Drag vertically to climb the vine.
// Reads game state through the session and reports input; never changes state itself.

import { Application, Container, Graphics, Point, Rectangle, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import type { FloorDef } from '../core/content.ts';
import { nextFloor, type SlotRef } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import type { GameSession } from '../app/session.ts';
import { formatNumber } from '../ui/text.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { Art } from './assets.ts';
import { Effects } from './effects.ts';
import { SLOT_GEOM, SlotView } from './slotView.ts';
import { ease, Tweens } from './tween.ts';

export type RendererPreference = 'webgpu' | 'webgl';

/** World layout in points. The floor art is stretched to hold a row of pots. */
const WORLD = {
  floorCenterX: 650,
  floorScale: { x: 1.72, y: 1.25 },
  floorGap: 430,
  potRowSpan: 940,
  potScale: 0.9,
  trunk: { x: 40, y: 430 },
  /** Region of one floor that must stay on screen: trunk to last pot, markers to cloud bottom. */
  view: { left: -100, right: 1180, top: -260, bottom: 230 },
};
/** How often plant stages, bugs and timers are re-read from the simulation. */
const STATUS_REFRESH_MS = 250;
/** Movement (screen px) that decides between a vertical climb and a sweep across pots. */
const DRAG_DECIDE_PX = 12;

export interface ViewHandlers {
  onTap(slot: SlotRef, target: 'pot' | 'bug'): void;
  onSwipe(slot: SlotRef): void;
  onLockedFloor(floor: FloorDef): void;
}

interface FloorView {
  container: Container;
  slots: SlotView[];
  phase: number;
  /** True while the opening animation drives the container position. */
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

export class GameView {
  readonly effects = new Effects();
  readonly tweens = new Tweens();
  /** Soft round particle (code-drawn effect), tinted per use: water drops, sparkles. */
  readonly dot: Texture;
  private readonly world = new Container();
  private readonly floorsLayer = new Container();
  private readonly trunkLayer = new Container();
  private readonly sky: Sprite;
  private readonly floors: FloorView[] = [];
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
  handlers: ViewHandlers | null = null;
  /** Called every frame with the frame duration (dev FPS meter). */
  onFrame: ((dtMs: number) => void) | null = null;

  private constructor(
    readonly app: Application,
    private readonly session: GameSession,
    private readonly art: Art,
  ) {
    this.dot = app.renderer.generateTexture(new Graphics().circle(0, 0, 10).fill(0xffffff));
    this.sky = new Sprite(art.sky);
    this.sky.anchor.set(0.5);
    app.stage.addChild(this.sky);
    this.world.addChild(this.floorsLayer, this.trunkLayer, this.effects);
    app.stage.addChild(this.world);

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', (e) => this.onDown(e));
    app.stage.on('globalpointermove', (e) => this.onMove(e));
    app.stage.on('pointerup', () => this.onUp());
    app.stage.on('pointerupoutside', () => this.onUp());
    app.canvas.addEventListener('wheel', (e) => this.setScroll(this.scroll + e.deltaY / this.scale), { passive: true });
    app.ticker.add((tk) => this.frame(tk.deltaMS));
    this.syncFloors();
    this.layout();
    this.refresh();
  }

  static async create(host: HTMLElement, session: GameSession, art: Art, preference: RendererPreference): Promise<GameView> {
    const app = new Application();
    await app.init({
      preference,
      resizeTo: host,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      background: hex(TOKENS.color.brand.sky),
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

  private floorY(index: number): number {
    return -index * WORLD.floorGap;
  }

  /** Creates views for newly unlocked floors and the faded preview of the next one. */
  syncFloors(): void {
    const { content, state } = this.session;
    for (let fi = this.floors.length; fi < state.floors.length; fi++) {
      const def = content.floors.get(state.floors[fi]!.floorId)!;
      this.floors.push(this.buildFloor(def, fi, state.floors[fi]!.slots.length));
    }
    this.buildTrunk();
    this.buildLockedPreview();
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

  private label(text: string, size: number): Text {
    const t = new Text({
      text,
      style: { fontFamily: `"${TOKENS.font.display}", sans-serif`, fontWeight: '800', fontSize: size, fill: hex(TOKENS.color.ui.textOnDark), stroke: { color: hex(TOKENS.color.ui.wood), width: 6, join: 'round' }, align: 'center' },
      resolution: 2,
    });
    t.anchor.set(0.5, 0);
    return t;
  }

  private buildFloor(def: FloorDef, fi: number, slotCount: number): FloorView {
    const container = new Container();
    container.position.set(WORLD.floorCenterX, this.floorY(fi));
    const label = this.label(def.name.vi, TOKENS.font.size.label);
    label.position.set(0, 130);
    container.addChild(this.cloudSprite(def), label);
    const slots: SlotView[] = [];
    const spacing = slotCount > 1 ? WORLD.potRowSpan / (slotCount - 1) : 0;
    for (let i = 0; i < slotCount; i++) {
      const view = new SlotView(fi, i, this.art, this.tweens);
      view.position.set(-WORLD.potRowSpan / 2 + i * spacing, 4);
      view.scale.set(WORLD.potScale);
      slots.push(view);
      container.addChild(view);
    }
    this.floorsLayer.addChild(container);
    return { container, slots, phase: fi * 1.7, animating: false };
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
    if (this.locked) {
      this.locked.container.destroy({ children: true });
      this.locked = null;
    }
    const def = nextFloor(this.session.content, this.session.state);
    if (!def) return;
    const container = new Container();
    container.position.set(WORLD.floorCenterX, this.floorY(this.floors.length));
    const cloud = this.cloudSprite(def);
    cloud.alpha = 0.55;
    const name = this.label(def.name.vi, TOKENS.font.size.window);
    name.position.set(0, -90);
    const info = this.label('', TOKENS.font.size.label);
    info.position.set(0, -40);
    container.addChild(cloud, name, info);
    this.floorsLayer.addChild(container);
    this.locked = { container, def, info };
    this.updateLockedInfo();
  }

  private updateLockedInfo(): void {
    if (!this.locked) return;
    const { def, info } = this.locked;
    const p = this.session.state.player;
    const lines = [`Mở ở cấp ${def.unlockLevel} · ${formatNumber(def.unlockCost)} xu`];
    if (p.level >= def.unlockLevel && p.coins >= def.unlockCost) lines.push('Chạm để mở tầng mới!');
    const text = lines.join('\n');
    if (info.text !== text) info.text = text;
  }

  /** Fits one floor's width to the screen; works in landscape and portrait. */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const k = Math.max(w / this.art.sky.width, h / this.art.sky.height);
    this.sky.scale.set(k);
    this.sky.position.set(w / 2, h / 2);
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
    );
    const open = TOKENS.world.floorOpen;
    fv.slots.forEach((s, i) => {
      s.scale.set(0);
      setTimeout(() => this.tweens.add(TOKENS.motion.bounce.ms * 2, ease.outBack, (t) => s.scale.set(WORLD.potScale * t)), open.cameraMs + i * open.slotStaggerMs);
    });
    for (let k = 0; k < 4; k++) {
      setTimeout(() => this.effects.burst(this.dot, WORLD.floorCenterX - 400 + k * 260, y - 120, 10, { scale: 0.6, speed: 420, tint: hex(TOKENS.color.brand.gold) }), open.cameraMs + k * 160);
    }
  }

  /** Re-reads every pot from the simulation. Cheap: a few pure function calls. */
  refresh(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    const rarityColors = TOKENS.color.rarity as Record<string, string>;
    state.floors.forEach((floor, fi) => {
      const fv = this.floors[fi];
      if (!fv) return;
      floor.slots.forEach((slot, i) => {
        const view = fv.slots[i];
        if (!view) return;
        const pot = state.pots[slot.potInstanceId]!;
        const def = content.pots.get(pot.potId)!;
        view.setPot(`${slot.potInstanceId}/${pot.potId}/${pot.level}`, this.art.pot(def.sprite, pot.level, rarityColors[def.rarity] ?? TOKENS.color.rarity.common));
        view.setStatus(cropStatus(content, state, slot, now));
      });
    });
    this.updateLockedInfo();
  }

  slotView(floor: number, i: number): SlotView {
    return this.floors[floor]!.slots[i]!;
  }

  private slotAt(e: FederatedPointerEvent): SlotView | null {
    const g = SLOT_GEOM.hit;
    for (const fv of this.floors) {
      for (const view of fv.slots) {
        view.toLocal(e.global, undefined, this.tmp);
        if (this.tmp.x >= g.x && this.tmp.x <= g.x + g.w && this.tmp.y >= g.y && this.tmp.y <= g.y + g.h) return view;
      }
    }
    return null;
  }

  private onDown(e: FederatedPointerEvent): void {
    this.scrollVelocity = 0;
    const view = this.slotAt(e);
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
    const view = this.slotAt(e);
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
    if (d.start >= 0) this.handlers?.onTap({ floor: d.floor, slot: d.start }, d.target);
    else if (this.locked && this.locked.container.getBounds().containsPoint(d.x0, d.y0)) this.handlers?.onLockedFloor(this.locked.def);
  }

  private frame(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    this.elapsed += dt;
    this.tweens.update(dt);
    const bob = TOKENS.world.islandBob;
    this.floors.forEach((fv, fi) => {
      for (const s of fv.slots) s.animate(this.elapsed);
      if (!fv.animating) fv.container.y = this.floorY(fi) + Math.sin((this.elapsed / bob.periodMs) * Math.PI * 2 + fv.phase) * bob.amplitude;
    });
    if (!this.drag && Math.abs(this.scrollVelocity) > 0.5) {
      this.setScroll(this.scroll + this.scrollVelocity);
      this.scrollVelocity *= 0.92;
    }
    this.effects.update(dt);
    this.sinceRefresh += dt;
    if (this.sinceRefresh >= STATUS_REFRESH_MS) {
      this.sinceRefresh = 0;
      this.refresh();
    }
    this.onFrame?.(dtMs);
  }
}
