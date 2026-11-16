// The PixiJS view of the garden: sky, drifting clouds, the cloud floor and its pots.
// Reads game state through the session and reports taps/swipes; never changes state itself.

import { Application, Container, Point, Sprite, type FederatedPointerEvent, type RendererType } from 'pixi.js';
import type { SlotRef } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import type { GameSession } from '../app/session.ts';
import type { Art } from './assets.ts';
import { Effects } from './effects.ts';
import { SLOT_GEOM, SlotView } from './slotView.ts';
import { Tweens } from './tween.ts';

/** Island art size in points and where the row of pots sits on it. */
const ISLAND = { w: 900, h: 350, rowY: -52, rowSpan: 680 };
/** How often plant stages, bugs and timers are re-read from the simulation. */
const STATUS_REFRESH_MS = 250;

export interface ViewHandlers {
  onTap(slot: SlotRef, target: 'pot' | 'bug'): void;
  onSwipe(slot: SlotRef): void;
}

export interface FrameStats {
  /** Called every frame with the frame duration; used by the dev FPS meter. */
  onFrame?: (dtMs: number) => void;
}

interface CloudSprite {
  sprite: Sprite;
  speed: number;
  baseY: number;
}

export class GameView {
  readonly effects = new Effects();
  readonly tweens = new Tweens();
  private readonly world = new Container();
  private readonly floor = new Container();
  private readonly sky: Sprite;
  private readonly island: Sprite;
  private readonly clouds: CloudSprite[] = [];
  private readonly slots: SlotView[] = [];
  private readonly tmp = new Point();
  private sinceRefresh = 0;
  private elapsed = 0;
  private drag: { start: number; visited: Set<number>; swiping: boolean; target: 'pot' | 'bug' } | null = null;
  handlers: ViewHandlers | null = null;
  stats: FrameStats = {};

  private constructor(
    readonly app: Application,
    private readonly session: GameSession,
    private readonly art: Art,
  ) {
    this.sky = new Sprite(art.sky);
    app.stage.addChild(this.sky);
    for (let i = 0; i < 5; i++) this.addCloud(i);

    this.island = new Sprite(art.get(session.content.floors.get(session.state.floors[0]!.floorId)!.sprite));
    this.island.anchor.set(0.5);
    this.floor.addChild(this.island);
    this.buildSlots();
    this.world.addChild(this.floor, this.effects);
    app.stage.addChild(this.world);

    app.stage.eventMode = 'static';
    app.stage.on('globalpointermove', (e) => this.onMove(e));
    app.stage.on('pointerup', () => this.onUp());
    app.stage.on('pointerupoutside', () => this.onUp());
    app.ticker.add((tk) => this.frame(tk.deltaMS));
    this.layout();
    this.refresh();
  }

  static async create(host: HTMLElement, session: GameSession, art: Art, preference: RendererType): Promise<GameView> {
    const app = new Application();
    await app.init({
      preference,
      resizeTo: host,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      background: 0x8ccbff,
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

  private addCloud(i: number): void {
    const sprite = new Sprite(this.art.get(`clouds/${i % 3}`));
    sprite.anchor.set(0.5);
    sprite.alpha = 0.75 + (i % 2) * 0.2;
    const c = { sprite, speed: 6 + i * 3.5, baseY: 0.12 + ((i * 37) % 70) / 100 };
    sprite.x = ((i * 271) % 1000) / 1000;
    this.clouds.push(c);
    this.app.stage.addChild(sprite);
  }

  private buildSlots(): void {
    const floorState = this.session.state.floors[0]!;
    const n = floorState.slots.length;
    const spacing = n > 1 ? ISLAND.rowSpan / (n - 1) : 0;
    floorState.slots.forEach((_, i) => {
      const view = new SlotView(i, this.art, this.tweens);
      view.position.set(-ISLAND.rowSpan / 2 + i * spacing, ISLAND.rowY);
      view.on('pointerdown', (e) => this.onDown(i, e));
      this.slots.push(view);
      this.floor.addChild(view);
    });
  }

  /** Fits the island to the screen; works in landscape and portrait. */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.sky.width = w;
    this.sky.height = h;
    const scale = Math.min((w * 0.94) / ISLAND.w, (h * 0.62) / (ISLAND.h + 260));
    this.world.scale.set(scale);
    this.world.position.set(w / 2, h * 0.56 + 80 * scale);
    for (const c of this.clouds) {
      c.sprite.scale.set(Math.max(0.5, scale) * 0.9);
      c.sprite.y = c.baseY * h;
      if (c.sprite.x <= 1) c.sprite.x *= w;
    }
    this.app.stage.hitArea = this.app.screen;
  }

  /** Re-reads every pot from the simulation. Cheap: a few pure function calls. */
  refresh(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    const floorState = state.floors[0]!;
    floorState.slots.forEach((slot, i) => {
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
    const view = this.slots[i]!;
    view.toLocal(e.global, undefined, this.tmp);
    const b = SLOT_GEOM.bugOffset;
    const nearBug = Math.hypot(this.tmp.x - b.x, this.tmp.y - b.y) < 60;
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
      this.handlers?.onSwipe({ floor: 0, slot: d.start });
    }
    this.handlers?.onSwipe({ floor: 0, slot: i });
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (d && !d.swiping) this.handlers?.onTap({ floor: 0, slot: d.start }, d.target);
  }

  private frame(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    this.elapsed += dt;
    this.tweens.update(dt);
    for (const s of this.slots) s.animate(this.elapsed);
    this.effects.update(dt);
    const w = this.app.screen.width;
    for (const c of this.clouds) {
      c.sprite.x += (c.speed * dt) / 1000;
      if (c.sprite.x - c.sprite.width / 2 > w) c.sprite.x = -c.sprite.width / 2;
    }
    this.sinceRefresh += dt;
    if (this.sinceRefresh >= STATUS_REFRESH_MS) {
      this.sinceRefresh = 0;
      this.refresh();
    }
    this.stats.onFrame?.(dtMs);
  }
}
