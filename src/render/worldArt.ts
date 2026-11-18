// The garden world from the owner's concept pictures (cut out and upscaled by tools/concept):
// cloud floors (mushroom house, waterfall, and the bridge island for the locked floor), the flowering
// vine, Mèo Mây and three more pets. Earlier Blender versions are in tools/potgen (chỉ thị 08).
//
// The vine is one segment repeated without a joint (cross-faded at its top), drawn BEHIND the floors:
// it rises out of every cloud island and continues above it.

import { Container, Sprite, type Texture } from 'pixi.js';
import trunkData from '../../assets/art/world_trunk.json';
import type { Art } from './assets.ts';

interface TrunkData {
  tile: { w: number; h: number; axis: number };
}
const DATA = trunkData as unknown as TrunkData;
/** One segment of the vine, in points (atlas @2x). */
export const SEGMENT_PT = DATA.tile.h / 2;

const FLOOR_VARIANTS = ['house', 'falls'] as const;

export function hasWorldArt(art: Art): boolean {
  return art.has('world/trunk/tile') && art.has('world/floor/house/L');
}

/** Small deterministic generator (mulberry32). */
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

function halves(art: Art, key: string): Container {
  const c = new Container();
  for (const side of ['L', 'R'] as const) {
    const tex = art.get(`world/floor/${key}/${side}`);
    const s = new Sprite(tex);
    s.anchor.copyFrom(tex.defaultAnchor ?? { x: 0, y: 0 });
    c.addChild(s);
  }
  return c;
}

/** Cloud floor picture; origin = the floor container origin (middle of the pot row, on the lawn). */
export function floorArt(art: Art, floorIndex: number): Container {
  return halves(art, FLOOR_VARIANTS[floorIndex % FLOOR_VARIANTS.length]!);
}

/** The floating bridge island, used for the next (locked) floor. */
export function lockedFloorArt(art: Art): Container {
  return art.has('world/floor/bridge/L') ? halves(art, 'bridge') : floorArt(art, 0);
}

/** The vine from `bottom` up to `top` (world points, y grows downward), its axis at x. */
export function buildVine(art: Art, x: number, bottom: number, top: number): Container {
  const layer = new Container();
  const tile = art.get('world/trunk/tile');
  let y = bottom;
  while (y > top) {
    const s = new Sprite(tile);
    s.anchor.copyFrom(tile.defaultAnchor ?? { x: 0.5, y: 1 });
    s.position.set(x, y);
    layer.addChild(s);
    y -= SEGMENT_PT;
  }
  return layer;
}

// ----------------------------------------------------------------------------- pets living on floors

export const PET_SPECIES = ['cloud-cat', 'ember-fox', 'jade-dragon', 'cloud-sparrow'] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

type PetMode = 'idle' | 'run' | 'sleep' | 'happy';

/**
 * A pet on one floor (decoration; pet gameplay comes in đợt 5): it breathes while standing, now and
 * then runs (or flies) across the lawn in front of the pots, naps, or plays. Pictures face left;
 * mirrored when heading right. Animations only advance while its floor is on screen.
 */
export class PetActor {
  readonly sprite: Sprite;
  private mode: PetMode = 'idle';
  private timer: number;
  private t = 0;
  private targetX = 0;
  private dir = 1;
  private readonly r: () => number;

  private constructor(
    private readonly tex: Record<PetMode, Texture>,
    seed: number,
    private readonly minX: number,
    private readonly maxX: number,
  ) {
    this.r = rng(seed);
    this.sprite = new Sprite(tex.idle);
    this.sprite.anchor.copyFrom(tex.idle.defaultAnchor ?? { x: 0.5, y: 1 });
    this.timer = 2500 + this.r() * 4000;
    this.t = this.r() * 10;
  }

  static create(art: Art, species: PetSpecies, seed: number, minX: number, maxX: number): PetActor | null {
    return PetActor.fromFrames(art, `world/pet/${species}`, { stand: 'idle', run: 'run', sleep: 'sleep', happy: 'happy' }, seed, minX, maxX);
  }

  /** Chỉ thị 11: a pet from its frame prefix and pose names (stand, run, sleep, happy). */
  static fromFrames(art: Art, prefix: string, poses: Record<'stand' | 'run' | 'sleep' | 'happy', string>, seed: number, minX: number, maxX: number, asleep = false): PetActor | null {
    const f = (name: string) => `${prefix}/${name}`;
    if (!art.has(f(poses.stand))) return null;
    const get = (pose: string) => (art.has(f(pose)) ? art.get(f(pose)) : art.get(f(poses.stand)));
    const actor = new PetActor({ idle: get(poses.stand), run: get(poses.run), sleep: get(poses.sleep), happy: get(poses.happy) }, seed, minX, maxX);
    if (asleep) actor.sleepOnly();
    return actor;
  }

  private asleep = false;
  /** Size of the picture (new pet art is larger than the old). */
  baseScale = 1;
  /** The run picture looks right (new pet art) rather than left (Mèo Mây). */
  facesRight = false;
  /** Chỉ thị 11 § E5: x positions to keep clear (front-row ripe pots), so a pet never hides one. */
  avoid: () => number[] = () => [];
  /** Which pet species this is (the player's own pets). */
  species = '';
  private static readonly CLEAR = 70;

  private blocked(x: number): boolean {
    return this.avoid().some((a) => Math.abs(a - x) < PetActor.CLEAR);
  }

  /** A spot on the lawn away from ripe pots (a few tries, then the edge). */
  private freeSpot(): number {
    for (let k = 0; k < 8; k++) {
      const x = this.minX + this.r() * (this.maxX - this.minX);
      if (!this.blocked(x)) return x;
    }
    return this.minX;
  }

  /** Runs to a place to work (next to `x`, never in front of a ripe pot) and cheers there. */
  goTo(x: number): void {
    if (this.asleep) return;
    let tx = Math.max(this.minX, Math.min(this.maxX, x + (this.r() < 0.5 ? -1 : 1) * PetActor.CLEAR));
    if (this.blocked(tx)) tx = this.freeSpot();
    this.targetX = tx;
    this.dir = Math.sign(tx - this.sprite.x) || 1;
    this.working = true;
    this.set('run');
  }
  private working = false;

  /** A hungry or resting pet just sleeps where it is (chỉ thị 11 § E5). */
  sleepOnly(): void {
    this.asleep = true;
    this.set('sleep');
  }

  private set(mode: PetMode): void {
    this.mode = mode;
    const t = this.tex[mode];
    this.sprite.texture = t;
    this.sprite.anchor.copyFrom(t.defaultAnchor ?? { x: 0.5, y: 1 });
  }

  /** Advances the pet; `visible` false freezes it (off screen). */
  update(dtMs: number, visible: boolean): void {
    if (!visible) return;
    this.t += dtMs / 1000;
    if (this.asleep) {
      const k = 0.025 * Math.sin(this.t * 1.6);
      this.sprite.scale.set(this.baseScale * (1 - k * 0.5), this.baseScale * (1 + k));
      return;
    }
    const flip = this.mode === 'run' && this.dir > 0 !== this.facesRight ? -1 : 1;
    // Breathing (and a bounce while running), done by squash and stretch on the single picture.
    const k = this.mode === 'sleep' ? 0.025 * Math.sin(this.t * 1.6) : this.mode === 'run' ? 0 : 0.018 * Math.sin(this.t * 2.6);
    this.sprite.scale.set(this.baseScale * flip * (1 - k * 0.5), this.baseScale * (1 + k));
    if (this.mode === 'run') {
      this.sprite.pivot.y = Math.abs(Math.sin(this.t * 9)) * 6;
      const step = (dtMs / 1000) * 90;
      if (Math.abs(this.targetX - this.sprite.x) <= step) {
        this.sprite.x = this.targetX;
        this.sprite.pivot.y = 0;
        this.set(this.working ? 'happy' : 'idle');
        this.timer = this.working ? 1800 : 3000 + this.r() * 5000;
        this.working = false;
      } else this.sprite.x += this.dir * step;
      // Running past a ripe pot: see-through, so the pot still shows.
      this.sprite.alpha = this.blocked(this.sprite.x) ? 0.55 : 1;
      return;
    }
    // Standing in front of a pot that has just become ripe: step aside.
    if (this.mode !== 'sleep' && this.blocked(this.sprite.x)) {
      this.targetX = this.freeSpot();
      this.dir = Math.sign(this.targetX - this.sprite.x) || 1;
      this.set('run');
      return;
    }
    this.sprite.alpha = 1;
    if (this.mode === 'happy') this.sprite.pivot.y = Math.abs(Math.sin(this.t * 6)) * 8;
    this.timer -= dtMs;
    if (this.timer > 0) return;
    this.sprite.pivot.y = 0;
    const roll = this.r();
    if (this.mode !== 'idle') {
      this.set('idle');
      this.timer = 3000 + this.r() * 4000;
    } else if (roll < 0.45) {
      this.targetX = this.freeSpot();
      this.dir = Math.sign(this.targetX - this.sprite.x) || 1;
      this.set('run');
    } else if (roll < 0.7) {
      this.set('sleep');
      this.timer = 8000 + this.r() * 9000;
    } else {
      this.set('happy');
      this.timer = 1800;
    }
  }

  /** Plays the happy pose for a moment. */
  cheer(): void {
    if (this.mode === 'run') return;
    this.set('happy');
    this.timer = 1800;
  }
}
