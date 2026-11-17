// Chỉ thị 10 § 3.3 display: birds on their perch at the right edge of their floor. They breathe and
// now and then preen (head shake, small hop); a catch is a curved flight to the pot in the flying
// pose, a peck, and the flight back. A hungry bird sleeps on the perch ("z z"), no dialog.
// The birds only show what the simulation (systems/birds.ts) decided; they never change state.

import { Container, Sprite, Text, type Texture } from 'pixi.js';
import type { Art } from './assets.ts';
import { rng } from './world10.ts';

const FLY_OUT_MS = 520;
const PECK_MS = 320;
const FLY_BACK_MS = 600;

const slug = (id: string) => id.slice(id.lastIndexOf('.') + 1);

export class BirdActor {
  readonly root = new Container();
  private readonly sprite: Sprite;
  private readonly zz: Text;
  private readonly perch: Texture;
  private readonly fly: Texture;
  private readonly r: () => number;
  private t = 0;
  private preenAt: number;
  private flight: { t: number; x: number; y: number } | null = null;
  sleeping = false;
  /** Perch position in world points (set every frame by the scene). */
  homeX = 0;
  homeY = 0;

  constructor(
    art: Art,
    readonly id: string,
    readonly species: string,
    seed: number,
  ) {
    const s = slug(species);
    this.perch = art.get(`bird/${s}/perch`);
    this.fly = art.has(`bird/${s}/fly`) ? art.get(`bird/${s}/fly`) : this.perch;
    this.sprite = new Sprite(this.perch);
    this.sprite.anchor.copyFrom(this.perch.defaultAnchor ?? { x: 0.5, y: 1 });
    this.zz = new Text({ text: 'z z', style: { fontFamily: 'Be Vietnam Pro', fontWeight: '700', fontSize: 26, fill: 0xfff8ea, stroke: { color: 0x161a2e, width: 5 } } });
    this.zz.anchor.set(0.5);
    this.zz.position.set(26, -110);
    this.zz.visible = false;
    this.root.addChild(this.sprite, this.zz);
    this.r = rng(seed);
    this.t = this.r() * 10;
    this.preenAt = 2 + this.r() * 5;
  }

  static canShow(art: Art, species: string): boolean {
    return art.has(`bird/${slug(species)}/perch`);
  }

  /** Starts a catch flight to a point in world coordinates. */
  catchAt(x: number, y: number): void {
    if (this.sleeping) return;
    this.flight = { t: 0, x, y };
  }

  update(dtMs: number, visible: boolean): void {
    const dt = dtMs / 1000;
    this.t += dt;
    if (this.flight) {
      this.flight.t += dtMs;
      this.updateFlight();
      return;
    }
    this.root.position.set(this.homeX, this.homeY);
    this.zz.visible = this.sleeping;
    if (!visible) return;
    this.sprite.texture = this.perch;
    this.sprite.anchor.copyFrom(this.perch.defaultAnchor ?? { x: 0.5, y: 1 });
    this.sprite.rotation = 0;
    this.sprite.pivot.y = 0;
    if (this.sleeping) {
      // Slow sleepy breathing, slightly tucked.
      const k = 0.03 * Math.sin(this.t * 1.5);
      this.sprite.scale.set(1 + k * 0.4, 0.94 + k);
      this.zz.alpha = 0.55 + 0.45 * Math.sin(this.t * 2);
      this.zz.y = -110 - ((this.t * 8) % 12);
      return;
    }
    const k = 0.015 * Math.sin(this.t * 2.8);
    this.sprite.scale.set(1 - k * 0.5, 1 + k);
    // Preen now and then: a quick head shake and a little hop.
    const p = this.t - this.preenAt;
    if (p > 0 && p < 0.7) {
      this.sprite.rotation = 0.09 * Math.sin(p * 30) * (1 - p / 0.7);
      this.sprite.pivot.y = Math.sin((p / 0.7) * Math.PI) * 8;
    } else if (p >= 0.7) this.preenAt = this.t + 4 + this.r() * 7;
  }

  private updateFlight(): void {
    const f = this.flight!;
    const total = FLY_OUT_MS + PECK_MS + FLY_BACK_MS;
    const sx = this.homeX;
    const sy = this.homeY;
    const tx = f.x;
    const ty = f.y;
    const curve = (a: number, ax: number, ay: number, bx: number, by: number) => {
      // Quadratic curve with the control point above the midpoint.
      const cx = (ax + bx) / 2;
      const cy = Math.min(ay, by) - 160;
      const u = 1 - a;
      return { x: u * u * ax + 2 * u * a * cx + a * a * bx, y: u * u * ay + 2 * u * a * cy + a * a * by };
    };
    const ease = (a: number) => a * a * (3 - 2 * a);
    this.zz.visible = false;
    this.sprite.rotation = 0;
    if (f.t < FLY_OUT_MS) {
      const p = curve(ease(f.t / FLY_OUT_MS), sx, sy, tx, ty);
      this.setPose(this.fly, tx > sx);
      this.root.position.set(p.x, p.y);
    } else if (f.t < FLY_OUT_MS + PECK_MS) {
      // Peck: perched pose at the pot, two quick dips.
      const a = (f.t - FLY_OUT_MS) / PECK_MS;
      this.setPose(this.perch, tx > sx);
      this.root.position.set(tx, ty);
      this.sprite.rotation = -0.25 * Math.abs(Math.sin(a * Math.PI * 2)) * Math.sign(this.sprite.scale.x);
    } else if (f.t < total) {
      const p = curve(ease((f.t - FLY_OUT_MS - PECK_MS) / FLY_BACK_MS), tx, ty, sx, sy);
      this.setPose(this.fly, sx > tx);
      this.root.position.set(p.x, p.y);
    } else {
      this.flight = null;
      this.setPose(this.perch, false);
      this.root.position.set(sx, sy);
    }
  }

  /** Pictures face left; mirrored when heading right. */
  private setPose(tex: Texture, right: boolean): void {
    if (this.sprite.texture !== tex) {
      this.sprite.texture = tex;
      this.sprite.anchor.copyFrom(tex.defaultAnchor ?? { x: 0.5, y: 0.5 });
    }
    this.sprite.scale.set(right ? -1 : 1, 1);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
