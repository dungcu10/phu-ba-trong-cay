// The PixiJS view of a garden, front view 2.5D (REDESIGN_V2 1): sky, the ancient climbing vine on
// the left, cloud floors stacked along it. Each floor holds 6–10 pots (fewer pots = bigger pots),
// an expansion spot ("+") while it can grow, and a wooden sign with its name and stars. The next
// floor to open floats above, faded. Drag vertically to climb the vine.
// The view draws a GardenModel: the player's own garden or a neighbour's while visiting. It reads
// state and reports input; it never changes state itself.

import { canOpenFloor, floorItemNeeds } from '../systems/floors.ts';
import { floorUnlockCost } from '../systems/coinSinks.ts';
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
import { PetActor } from './worldArt.ts';

/** New pet pictures are 150 pt wide; drawn at about 0.6 × a pot (§ E5). */
const PET_SCALE = 0.62;
import { BirdActor } from './birdActors.ts';
import { foodAt } from '../systems/birds.ts';
import { isNight } from '../systems/growth.ts';
import { WORLD10 } from './world10.ts';
import { buildVine, floorArtId, floorPicture, hasWorld10, pedestalSprite, ringSprites, slotXs, type Swayer } from './world10.ts';

/** Giao diện fantasy (chỉ thị 06): night glass + thin gold for the canvas signs too. */
const FX = { night: '#161A2E', gold: '#F3D27E', ivory: '#FFF8EA' } as const;

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
  /** Chỉ thị 11 D5: front row size, the back row (up to 4) lifted, 8% smaller, slightly dimmed. */
  frontRow: 6,
  backRowMax: 4,
  backRowLift: 112,
  /** Pot scale cap when a floor has a back row, so the two rows never touch. */
  twoRowScale: 1.08,
  backRowScale: 0.92,
  backRowTint: 0xdedede,
  signY: 96,
  trunk: { x: 40, y: 430 },
  /** Region of one floor that must stay on screen: trunk to last pot, markers to the sign. */
  view: { left: -100, right: 1180, top: -280, bottom: 240 },
};
/** Chỉ thị 10: cloud ring centre below the floor origin; vine root and top beyond the end floors. */
const RING_Y = 30;
const ROOT_BELOW = 330;
const TOP_ABOVE = 380;
/** Pedestal size relative to the pot scale. */
const PEDESTAL_SCALE = 0.86;
/** How often plant stages, bugs and timers are re-read from the simulation. */
const STATUS_REFRESH_MS = 250;
/** Movement (screen px) that decides between a vertical climb and a sweep across pots. */
const DRAG_DECIDE_PX = 12;
/** Zoom: how many floors fit on screen at once (pinch with two fingers, ctrl + wheel on a computer). */
const ZOOM = { min: 1, max: 5, key: 'pb.zoomFloors' } as const;

function readZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM.key));
    return Number.isFinite(v) && v >= ZOOM.min && v <= ZOOM.max ? v : ZOOM.min;
  } catch {
    return ZOOM.min;
  }
}

function saveZoom(v: number): void {
  try {
    localStorage.setItem(ZOOM.key, v.toFixed(2));
  } catch {
    /* private mode: zoom just is not remembered */
  }
}

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
  /** Chỉ thị 10: back half of the cloud ring around the vine (drawn behind the vine, follows the floor). */
  ringBack: Sprite | null;
  /** Pets living on this floor (the owner's approved pets, decoration until the pet system). */
  pets: PetActor[];
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
  /** Chỉ thị 10 § 2.3: back halves of the cloud rings, behind the vine. */
  private readonly ringBackLayer = new Container();
  /** Chỉ thị 10 § 3.3: birds on their perches (above the floors, so a flight passes in front). */
  private readonly birdLayer = new Container();
  private birds = new Map<string, BirdActor>();
  private swayers: Swayer[] = [];
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
  /** Floors visible at once (1–5, fractional while pinching). */
  private zoom = readZoom();
  /** Touch points down on the canvas, for the two-finger pinch. */
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinch: { d0: number; zoom0: number; worldY: number } | null = null;
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
    // Chỉ thị 10 § 2.3 layer order: ring backs, vine, floors (ring fronts, pedestals, pots inside), effects.
    this.world.addChild(this.ringBackLayer, this.trunkLayer, this.floorsLayer, this.birdLayer, this.effects);
    app.stage.addChild(this.world, this.ambience.front);
    this.source = () => homeGarden(session.content, session.state, session.now());
    this.model = this.source();

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', (e) => this.onDown(e));
    app.stage.on('globalpointermove', (e) => this.onMove(e));
    app.stage.on('pointerup', (e) => this.onUp(e));
    app.stage.on('pointerupoutside', (e) => this.onUp(e));
    app.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Trackpad pinch and ctrl + wheel zoom; a plain wheel climbs.
        if (e.ctrlKey || e.metaKey) this.zoomAt(this.zoom * Math.exp(e.deltaY * 0.01), e.offsetY);
        else this.setScroll(this.scroll - e.deltaY / this.scale);
      },
      { passive: false },
    );
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
    for (const fv of this.floors) this.destroyFloor(fv);
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
        () => ((fv.animating = false), this.applyScroll()),
        fv.container,
      );
    });
  }

  private destroyFloor(fv: FloorView): void {
    fv.ringBack?.destroy();
    fv.container.destroy({ children: true });
  }

  private floorY(index: number): number {
    return -index * WORLD.floorGap;
  }

  private floorKey(f: GardenFloor): string {
    return `${this.model.mode}|${f.def.id}|${f.pots.length}|${f.expandCost !== null}|${f.pets.map((p) => `${p.species}${p.asleep ? 'z' : ''}`).join(',')}`;
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
      if (old) this.destroyFloor(old);
      const fv = this.buildFloor(f, fi);
      if (keepY !== null && keepY !== undefined) fv.container.y = keepY;
      this.floors[fi] = fv;
      changed = true;
      if (grownSlot >= 0) this.popNewSlot(fv, grownSlot);
    });
    for (const extra of this.floors.splice(floors.length)) this.destroyFloor(extra);
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

  private text(text: string, size: number, fill: string = FX.ivory, stroke: string = FX.night): Text {
    const t = new Text({
      text,
      style: { fontFamily: `"${TOKENS.font.display}", sans-serif`, fontWeight: '700', fontSize: size, fill: hex(fill), stroke: { color: hex(stroke), width: 5, join: 'round' }, align: 'center', letterSpacing: 0.3 },
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
    g.poly(pts).fill({ color: hex(filled ? FX.gold : FX.night), alpha: filled ? 1 : 0.5 }).stroke({ color: hex(FX.gold), width: 1.5, join: 'round' });
  }

  /** Wooden sign under a floor: stars, name, and the completed pot set if any. */
  private buildSign(f: GardenFloor): Container {
    const sign = new Container();
    const name = this.text(f.def.name.vi, TOKENS.font.size.label);
    const maxStars = f.def.stars.length;
    const starsW = maxStars > 0 ? maxStars * 30 + 10 : 0;
    const w = name.width + starsW + 44;
    const g = new Graphics();
    // Giao diện fantasy: night-glass chip with a thin gold line and a diamond at each end.
    g.roundRect(-w / 2, 0, w, 48, 24).fill({ color: hex(FX.night), alpha: 0.82 }).stroke({ color: hex(FX.gold), width: 1.5, alpha: 0.7 });
    for (const sx of [-1, 1]) g.poly([sx * (w / 2 + 2), 18, sx * (w / 2 + 8), 24, sx * (w / 2 + 2), 30, sx * (w / 2 - 4), 24]).fill(hex(FX.gold));
    for (let i = 0; i < maxStars; i++) this.star(g, -w / 2 + 30 + i * 30, 24, 12, i < f.stars);
    name.position.set(-w / 2 + 22 + starsW + name.width / 2, 25);
    sign.addChild(g, name);
    if (f.setName) {
      const set = this.text(`Bộ ${f.setName}`, TOKENS.font.size.caption, FX.gold, FX.night);
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
    g.ellipse(0, -8, 46, 12).fill({ color: hex(FX.night), alpha: 0.18 });
    g.circle(0, -62, 42).fill({ color: hex(FX.night), alpha: 0.72 }).stroke({ color: hex(FX.gold), width: 2, alpha: 0.85 });
    g.circle(0, -62, 36).stroke({ color: hex(FX.gold), width: 1, alpha: 0.3 });
    g.roundRect(-2.5, -80, 5, 36, 2.5).fill(hex(FX.gold));
    g.roundRect(-18, -64.5, 36, 5, 2.5).fill(hex(FX.gold));
    const price = this.text(`${formatNumber(cost)} xu`, TOKENS.font.size.caption, FX.gold, FX.night);
    price.position.set(0, 12);
    const label = this.text('Thêm chậu', TOKENS.font.size.caption, FX.ivory, FX.night);
    label.position.set(0, -128);
    ghost.addChild(g, label, price);
    ghost.scale.set(scale);
    return ghost;
  }

  private buildFloor(f: GardenFloor, fi: number): FloorView {
    const container = new Container();
    container.position.set(WORLD.floorCenterX, this.floorY(fi));
    const w10 = hasWorld10(this.art);
    const artId = floorArtId(fi);
    container.addChild(w10 ? floorPicture(this.art, artId) : this.cloudSprite(f.def));
    let ringBack: Sprite | null = null;
    if (w10) {
      // The vine passes through the left edge of the floor; a ring of cloud hugs it there.
      const ring = ringSprites(this.art, artId);
      const rx = WORLD.trunk.x - WORLD.floorCenterX;
      ring.front.position.set(rx, RING_Y);
      container.addChild(ring.front);
      ring.back.position.set(WORLD.trunk.x, this.floorY(fi) + RING_Y);
      this.ringBackLayer.addChild(ring.back);
      ringBack = ring.back;
    }
    // Chỉ thị 11 đính chính D5: 6 → 10 positions. Front row up to 6, back row (positions 7–10)
    // staggered between them, 8% smaller and slightly dimmed; every position has a stone pedestal.
    const positions = f.pots.length + (f.expandCost !== null ? 1 : 0);
    const frontN = Math.min(positions, WORLD.frontRow);
    const backN = positions - frontN;
    const scale = Math.min(backN > 0 ? WORLD.twoRowScale : WORLD.potScaleMax, WORLD.potScale10 + (10 - frontN) * WORLD.potScaleStep);
    const spacing = frontN > 1 ? WORLD.potRowSpan / (frontN - 1) : 0;
    const xs = w10 ? slotXs(artId, frontN) : Array.from({ length: frontN }, (_, i) => -WORLD.potRowSpan / 2 + i * spacing);
    const gap = frontN > 1 ? (xs[frontN - 1]! - xs[0]!) / (frontN - 1) : 0;
    // Back pots sit in the gaps between front pots (offsets in gaps from the row centre), symmetric:
    // 1 → centre, 2 → ±1, 3 → −2, 0, +2, 4 → ±1, ±2. Never straight behind a front pot.
    const BACK_GAPS: Record<number, number[]> = { 1: [0], 2: [-1, 1], 3: [-1, 0, 1], 4: [-2, -1, 1, 2] };
    const centre = (xs[0]! + xs[frontN - 1]!) / 2;
    // The "Thêm chậu" button, when it falls in the back row, takes the most central back spot so it
    // always stands on the lawn (never out at the cloud edge); the pots fill the others left to right.
    const backOffs = BACK_GAPS[backN] ?? [];
    const ghostInBack = f.expandCost !== null && backN > 0;
    const ghostOff = ghostInBack ? [...backOffs].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)[0]! : null;
    const potOffs = ghostOff === null ? backOffs : backOffs.filter((o, j) => j !== backOffs.indexOf(ghostOff));
    const place = (i: number) => {
      if (i < frontN) return { x: xs[i]!, y: 4, k: scale, back: false };
      const off = i === f.pots.length && ghostOff !== null ? ghostOff : (potOffs[i - frontN] ?? 0);
      return { x: centre + off * gap, y: 4 - WORLD.backRowLift, k: scale * WORLD.backRowScale, back: true };
    };
    const slots: SlotView[] = [];
    // Back row first (behind), then the front row; pots of a row sit under all plants (directive 03 step 4).
    const backPed = new Container();
    const backPot = new Container();
    const pedLayer = new Container();
    const potLayer = new Container();
    container.addChild(backPed, backPot);
    const backViews = new Container();
    container.addChild(backViews, pedLayer, potLayer);
    const pets: PetActor[] = [];
    // Chỉ thị 11 § E5: the pets looking after this floor wander on the lawn in front of the pots, ~0.6 × a pot.
    f.pets.forEach((gp, k) => {
      const pet = PetActor.fromFrames(this.art, gp.art, gp.poses, 77 + fi * 31 + k * 13, -WORLD.potRowSpan / 2 - 90, WORLD.potRowSpan / 2, gp.asleep);
      if (pet) {
        pet.sprite.position.set(-WORLD.potRowSpan / 2 - 60 + ((fi * 263 + k * 340) % 700), 30);
        if (gp.art.startsWith('pet/')) ((pet.baseScale = PET_SCALE), (pet.facesRight = true));
        pet.species = gp.species;
        pets.push(pet);
      }
    });
    f.pots.forEach((_, i) => {
      const view = new SlotView(fi, i, this.art, this.tweens, this.dot, this.glow);
      const pl = place(i);
      if (w10) {
        // Chỉ thị 10: one stone pedestal under every pot position; the pot stands on its top face.
        const ped = pedestalSprite(this.art, artId, i + fi);
        ped.position.set(pl.x, pl.y);
        ped.scale.set(pl.k * PEDESTAL_SCALE);
        if (pl.back) ped.tint = WORLD.backRowTint;
        (pl.back ? backPed : pedLayer).addChild(ped);
      }
      view.position.set(pl.x, pl.y);
      view.scale.set(pl.k);
      if (pl.back) {
        view.tint = WORLD.backRowTint;
        view.back.tint = WORLD.backRowTint;
      }
      slots.push(view);
      (pl.back ? backPot : potLayer).addChild(view.back);
      (pl.back ? backViews : container).addChild(view);
    });
    let ghost: Container | null = null;
    if (f.expandCost !== null) {
      const pl = place(f.pots.length);
      ghost = this.buildGhost(f.expandCost, pl.k);
      ghost.position.set(pl.x, pl.y);
      (pl.back ? backViews : container).addChild(ghost);
    }
    const sign = this.buildSign(f);
    container.addChild(sign);
    // Pets keep clear of ripe pots in the front row (same lawn line).
    const front = slots.filter((_, i) => !place(i).back);
    for (const p of pets) {
      p.avoid = () => front.filter((v) => v.ripe).map((v) => v.x);
      container.addChild(p.sprite);
    }
    this.floorsLayer.addChild(container);
    return { key: this.floorKey(f), container, slots, ghost, sign, signKey: this.signKey(f), phase: fi * 1.7, animating: false, ringBack, pets };
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
    this.trunkLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (hasWorld10(this.art)) {
      // Chỉ thị 10: root under the lowest floor, the seamless segment up past the highest floor shown
      // (the locked one included), the top above it; decoration seeded per floor.
      const n = this.floors.length + (this.model.locked ? 1 : 0);
      const bands = Array.from({ length: n }, (_, i) => ({ top: this.floorY(i) - WORLD.floorGap, bottom: this.floorY(i) }));
      const vine = buildVine(this.art, WORLD.trunk.x, this.floorY(0) + ROOT_BELOW, this.floorY(n - 1) - TOP_ABOVE, bands);
      this.trunkLayer.addChild(vine.layer);
      this.swayers = vine.swayers;
      return;
    }
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
    const cloud = hasWorld10(this.art) ? floorPicture(this.art, floorArtId(this.floors.length)) : this.cloudSprite(def);
    cloud.alpha = 0.5;
    // A signboard sits on the faded cloud, low enough to stay clear of the HUD and the hint line.
    const g = new Graphics();
    g.roundRect(-230, 72, 460, 112, 26).fill({ color: hex(FX.night), alpha: 0.84 }).stroke({ color: hex(FX.gold), width: 1.5, alpha: 0.7 });
    g.roundRect(-222, 80, 444, 96, 20).stroke({ color: hex(FX.gold), width: 1, alpha: 0.22 });
    const name = this.text(`Tầng ${this.floors.length + 1} · ${def.name.vi}`, TOKENS.font.size.window);
    name.position.set(0, 106);
    const info = this.text('', TOKENS.font.size.label, FX.gold);
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
    const ready = canOpenFloor(def, this.session.state, this.session.content);
    const items = floorItemNeeds(def, this.session.state.inventory).map((n) => `${n.need} ${this.session.content.items.get(n.itemId)?.name.vi ?? ''}`);
    const text = ready ? 'Chạm để mở tầng mới!' : [`Cấp ${def.unlockLevel}`, `${formatNumber(floorUnlockCost(this.session.content, def, p.level))} xu`, ...items].join(' · ');
    if (info.text !== text) info.text = text;
  }

  /** Highest zoom-out that still makes sense: no more floors than the garden has (plus the locked one). */
  private zoomMax(): number {
    return Math.max(ZOOM.min, Math.min(ZOOM.max, this.floors.length + (this.locked ? 0.55 : 0)));
  }

  /** Floors visible at once, as the player set it (clamped to the garden). */
  get floorsInView(): number {
    return Math.min(this.zoom, this.zoomMax());
  }

  /**
   * Zooms so `floors` floors fit on screen, keeping the world point under screen height `anchorY`
   * still (the point between the two fingers).
   */
  zoomAt(floors: number, anchorY: number = this.app.screen.height / 2, worldY?: number): void {
    const next = Math.max(ZOOM.min, Math.min(this.zoomMax(), floors));
    if (Math.abs(next - this.floorsInView) < 1e-4 && worldY === undefined) return;
    const wy = worldY ?? (anchorY - this.world.y) / this.scale;
    this.zoom = next;
    this.layout(false);
    this.setScroll((anchorY - this.baseY - wy * this.scale) / this.scale);
    saveZoom(this.zoom);
  }

  /** Fits one floor's width to the screen (or 1–5 floors' height when zoomed out); landscape and portrait. */
  layout(keepScroll = true): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const k = Math.max(w / this.art.sky.width, h / this.art.sky.height);
    this.sky.scale.set(k);
    this.sky.position.set(w / 2, h / 2);
    this.ambience.resize(w, h);
    const v = WORLD.view;
    const hud = TOKENS.touch.primary + (TOKENS.space[5] ?? 0);
    const avail = h - hud - TOKENS.layout.bottomInset;
    // The view spans the floor at the camera and (zoom − 1) floors above it.
    const top = v.top - (this.floorsInView - 1) * WORLD.floorGap;
    this.scale = Math.min((w * 0.97) / (v.right - v.left), avail / (v.bottom - top));
    this.world.scale.set(this.scale);
    this.world.x = w / 2 - ((v.left + v.right) / 2) * this.scale;
    this.baseY = hud + avail / 2 - ((top + v.bottom) / 2) * this.scale;
    if (keepScroll) this.setScroll(this.scroll);
    else this.applyScroll();
    this.app.stage.hitArea = this.app.screen;
  }

  private maxScroll(): number {
    const top = (this.floors.length - 1) * WORLD.floorGap + (this.locked ? WORLD.floorGap * 0.55 : 0);
    return Math.max(0, top - (this.floorsInView - 1) * WORLD.floorGap);
  }

  private setScroll(value: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll(), value));
    this.applyScroll();
  }

  private applyScroll(): void {
    this.world.y = this.baseY + this.scroll * this.scale;
    // Giao diện fantasy: the floor in view is sharp; floors above and below fade back, so the one
    // peeking in under the HUD reads as "the next floor" instead of pots colliding with the HUD.
    // With zoom, every floor inside the view is sharp; the fade starts past its top and bottom.
    const span = this.floorsInView - 1;
    const dist = (index: number) => {
      const at = index * WORLD.floorGap - this.scroll;
      return (at < 0 ? -at : Math.max(0, at - span * WORLD.floorGap)) / WORLD.floorGap;
    };
    const fade = (index: number) => {
      const d = dist(index);
      return d < 0.45 ? 1 : Math.max(0.32, 1 - (d - 0.45) * 1.4);
    };
    // Floors well outside the view are not drawn at all (keeps 60 FPS with many floors).
    const shown = (index: number) => dist(index) < 1.6;
    this.floors.forEach((fv, i) => {
      if (!fv.animating) fv.container.alpha = fade(i);
      fv.container.visible = fv.animating || shown(i);
      if (fv.ringBack) fv.ringBack.visible = fv.container.visible;
    });
    if (this.locked) {
      this.locked.container.alpha = fade(this.floors.length);
      this.locked.container.visible = shown(this.floors.length);
    }
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
      () => ((fv.animating = false), this.applyScroll()),
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
  /** Perch of a bird in floor coordinates: the right edge of the floor, branch 2 a little inward and higher. */
  private perchOffset(fi: number, branch: number): { x: number; y: number } {
    const right = hasWorld10(this.art) ? WORLD10.floors[floorArtId(fi)]!.right : 560;
    return branch === 0 ? { x: right - 165, y: -60 } : { x: right - 100, y: -175 };
  }

  /** Brings the bird actors in line with the save (own garden only; neighbours' birds come later). */
  private syncBirds(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    const want = this.model.mode === 'home' ? state.birds.filter((b) => b.floor !== null && b.floor < this.floors.length && !(b.escort && now < b.escort.until)) : [];
    const keep = new Set(want.map((b) => b.id));
    for (const [id, a] of this.birds) {
      if (keep.has(id)) continue;
      a.destroy();
      this.birds.delete(id);
    }
    for (const b of want) {
      let a = this.birds.get(b.id);
      if (!a) {
        if (!BirdActor.canShow(this.art, b.species)) continue;
        a = new BirdActor(this.art, b.id, b.species, b.id.length * 97 + b.caught);
        this.birds.set(b.id, a);
        this.birdLayer.addChild(a.root);
      }
      const def = content.birds?.get(b.species);
      a.sleeping = foodAt(content, b, now) <= 0 || (!!def?.nightOnly && !isNight(content, now));
    }
  }

  /** Plays a bird's catch: flight to the pot's bug, peck, flight back. */
  birdCatch(birdId: string, floor: number, slot: number): void {
    const a = this.birds.get(birdId);
    const view = this.floors[floor]?.slots[slot];
    if (!a || !view) return;
    const p = this.world.toLocal(view.toGlobal(SLOT_GEOM.bugOffset));
    a.catchAt(p.x + 20, p.y + 30);
  }

  refresh(): void {
    this.model = this.source();
    this.syncBirds();
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

  /** Chỉ thị 11 § E5: a working pet runs to the pot it works on (beside it, never over a ripe pot). */
  petGoTo(floor: number, species: string, slot?: number): void {
    const fv = this.floors[floor];
    const pet = fv?.pets.find((p) => p.species === species);
    if (!fv || !pet) return;
    const v = slot !== undefined ? fv.slots[slot] : undefined;
    pet.goTo(v ? v.x : pet.sprite.x);
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
    if (e.pointerType === 'touch') this.touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
    if (this.touches.size >= 2) return this.startPinch();
    if (this.pinch) return;
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

  /** Two fingers down: whatever the first finger started (tap, sweep, climb) is cancelled. */
  private startPinch(): void {
    this.drag = null;
    const [a, b] = [...this.touches.values()];
    const midY = (a!.y + b!.y) / 2;
    this.pinch = { d0: Math.max(20, Math.hypot(a!.x - b!.x, a!.y - b!.y)), zoom0: this.floorsInView, worldY: (midY - this.world.y) / this.scale };
  }

  private onMove(e: FederatedPointerEvent): void {
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
    if (this.pinch) {
      if (this.touches.size < 2) return;
      const [a, b] = [...this.touches.values()];
      const dist = Math.max(20, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      // Fingers apart → closer (fewer floors); together → further (more floors).
      this.zoomAt(this.pinch.zoom0 * (this.pinch.d0 / dist), (a!.y + b!.y) / 2, this.pinch.worldY);
      return;
    }
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

  private onUp(e: FederatedPointerEvent): void {
    this.touches.delete(e.pointerId);
    if (this.pinch) {
      // The pinch ends when the last finger lifts; a lone finger left down does nothing meanwhile.
      if (this.touches.size === 0) this.pinch = null;
      else if (this.touches.size >= 2) this.startPinch();
      return;
    }
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
      if (fv.ringBack) {
        fv.ringBack.y = fv.container.y + RING_Y;
        fv.ringBack.alpha = fv.container.alpha;
      }
      // Pets only move while their floor is drawn.
      for (const p of fv.pets) p.update(dt, fv.container.visible);
    });
    for (const b of this.session.state.birds) {
      const a = this.birds.get(b.id);
      const fv = b.floor !== null ? this.floors[b.floor] : undefined;
      if (!a || !fv) continue;
      const o = this.perchOffset(b.floor!, b.branch);
      a.homeX = fv.container.x + o.x;
      a.homeY = fv.container.y + o.y;
      a.root.alpha = fv.container.alpha;
      a.root.visible = fv.container.visible;
      a.update(dt, fv.container.visible);
    }
    // Leaves and lanterns sway, only around the floor in view (the one in view and its neighbours).
    // Visible band: from the camera floor up through the zoomed-out floors above it.
    const viewBottom = -this.scroll + WORLD.floorGap * 1.6;
    const viewTop = -this.scroll - (this.floorsInView - 1 + 1.6) * WORLD.floorGap;
    for (const sw of this.swayers) {
      if (sw.y < viewTop || sw.y > viewBottom) continue;
      sw.sprite.rotation = sw.base + Math.sin(t * sw.speed + sw.phase) * sw.amp;
    }
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
