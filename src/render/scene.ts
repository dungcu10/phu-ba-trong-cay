// The PixiJS view of the garden, front view (owner's decision 2026-11-16): sky, the ancient
// climbing vine on the left, a long cloud floor reaching out from it with a row of pots.
// Reads game state through the session and reports taps/swipes; never changes state itself.

import { Application, Container, Graphics, Point, Sprite, type FederatedPointerEvent, type Texture } from 'pixi.js';
import type { SlotRef } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import type { GameSession } from '../app/session.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { Art } from './assets.ts';
import { Effects } from './effects.ts';
import { SLOT_GEOM, SlotView } from './slotView.ts';
import { Tweens } from './tween.ts';

export type RendererPreference = 'webgpu' | 'webgl';

/** World layout in points. The floor art is stretched to hold a row of pots. */
const WORLD = {
  floorCenterX: 650,
  floorScale: { x: 1.72, y: 1.25 },
  potRowSpan: 940,
  potScale: 0.9,
  trunk: { x: 40, y: 430 },
  /** Region that must stay on screen: from the trunk to the last pot, markers to floor bottom. */
  view: { left: -100, right: 1180, top: -260, bottom: 230 },
};
/** How often plant stages, bugs and timers are re-read from the simulation. */
const STATUS_REFRESH_MS = 250;

export interface ViewHandlers {
  onTap(slot: SlotRef, target: 'pot' | 'bug'): void;
  onSwipe(slot: SlotRef): void;
}

export class GameView {
  readonly effects = new Effects();
  readonly tweens = new Tweens();
  private readonly world = new Container();
  private readonly floor = new Container();
  private readonly sky: Sprite;
  private readonly slots: SlotView[] = [];
  private readonly tmp = new Point();
  private sinceRefresh = 0;
  private elapsed = 0;
  private drag: { start: number; visited: Set<number>; swiping: boolean; target: 'pot' | 'bug' } | null = null;
  /** Soft round particle (code-drawn effect), tinted per use: water drops, sparkles. */
  readonly dot: Texture;
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

    const floorDef = session.content.floors.get(session.state.floors[0]!.floorId)!;
    const cloud = new Sprite(art.get(floorDef.sprite));
    cloud.anchor.copyFrom(cloud.texture.defaultAnchor ?? { x: 0.5, y: 0.2 });
    cloud.scale.set(WORLD.floorScale.x, WORLD.floorScale.y);
    this.floor.addChild(cloud);
    this.floor.x = WORLD.floorCenterX;
    this.buildSlots();
    this.floor.addChild(this.effects);

    const trunk = new Sprite(art.get('trunk'));
    trunk.anchor.copyFrom(trunk.texture.defaultAnchor ?? { x: 0.5, y: 1 });
    trunk.position.set(WORLD.trunk.x, WORLD.trunk.y);
    this.world.addChild(this.floor, trunk);
    app.stage.addChild(this.world);

    app.stage.eventMode = 'static';
    // A sweep may start between or before pots: the stage starts it, slots join as it passes.
    app.stage.on('pointerdown', () => {
      if (!this.drag) this.drag = { start: -1, visited: new Set(), swiping: false, target: 'pot' };
    });
    app.stage.on('globalpointermove', (e) => this.onMove(e));
    app.stage.on('pointerup', () => this.onUp());
    app.stage.on('pointerupoutside', () => this.onUp());
    app.ticker.add((tk) => this.frame(tk.deltaMS));
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

  private buildSlots(): void {
    const n = this.session.state.floors[0]!.slots.length;
    const spacing = n > 1 ? WORLD.potRowSpan / (n - 1) : 0;
    for (let i = 0; i < n; i++) {
      const view = new SlotView(i, this.art, this.tweens);
      view.position.set(-WORLD.potRowSpan / 2 + i * spacing, 4);
      view.scale.set(WORLD.potScale);
      view.on('pointerdown', (e) => this.onDown(i, e));
      this.slots.push(view);
      this.floor.addChild(view);
    }
  }

  /** Fits the play area to the screen; works in landscape and portrait. */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const k = Math.max(w / this.art.sky.width, h / this.art.sky.height);
    this.sky.scale.set(k);
    this.sky.position.set(w / 2, h / 2);
    const v = WORLD.view;
    const hud = TOKENS.touch.primary + (TOKENS.space[5] ?? 0);
    const scale = Math.min((w * 0.97) / (v.right - v.left), (h - hud - TOKENS.layout.bottomInset) / (v.bottom - v.top));
    this.world.scale.set(scale);
    this.world.position.set(w / 2 - ((v.left + v.right) / 2) * scale, hud + (h - hud) / 2 - ((v.top + v.bottom) / 2) * scale);
    this.app.stage.hitArea = this.app.screen;
  }

  /** Re-reads every pot from the simulation. Cheap: a few pure function calls. */
  refresh(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    state.floors[0]!.slots.forEach((slot, i) => {
      const view = this.slots[i]!;
      const pot = state.pots[slot.potInstanceId]!;
      view.setPot(content.pots.get(pot.potId)!.sprite, pot.level);
      view.setStatus(cropStatus(content, state, slot, now));
    });
  }

  slotView(i: number): SlotView {
    return this.slots[i]!;
  }

  private onDown(i: number, e: FederatedPointerEvent): void {
    this.slots[i]!.toLocal(e.global, undefined, this.tmp);
    const b = SLOT_GEOM.bugOffset;
    const nearBug = Math.hypot(this.tmp.x - b.x, this.tmp.y - b.y) < 40;
    this.drag = { start: i, visited: new Set([i]), swiping: false, target: nearBug ? 'bug' : 'pot' };
  }

  private slotAt(e: FederatedPointerEvent): number {
    const g = SLOT_GEOM.hit;
    for (const view of this.slots) {
      view.toLocal(e.global, undefined, this.tmp);
      if (this.tmp.x >= g.x && this.tmp.x <= g.x + g.w && this.tmp.y >= g.y && this.tmp.y <= g.y + g.h) return view.index;
    }
    return -1;
  }

  private onMove(e: FederatedPointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const i = this.slotAt(e);
    if (i < 0 || d.visited.has(i)) return;
    d.visited.add(i);
    if (!d.swiping) {
      d.swiping = true;
      if (d.start >= 0) this.handlers?.onSwipe({ floor: 0, slot: d.start });
    }
    this.handlers?.onSwipe({ floor: 0, slot: i });
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (d && !d.swiping && d.start >= 0) this.handlers?.onTap({ floor: 0, slot: d.start }, d.target);
  }

  private frame(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    this.elapsed += dt;
    this.tweens.update(dt);
    for (const s of this.slots) s.animate(this.elapsed);
    this.effects.update(dt);
    const bob = TOKENS.world.islandBob;
    this.floor.y = Math.sin((this.elapsed / bob.periodMs) * Math.PI * 2) * bob.amplitude;
    this.sinceRefresh += dt;
    if (this.sinceRefresh >= STATUS_REFRESH_MS) {
      this.sinceRefresh = 0;
      this.refresh();
    }
    this.onFrame?.(dtMs);
  }
}
