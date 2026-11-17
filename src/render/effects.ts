// Pooled visual feedback: floating "+3 Cà Chua Bi" labels and small particle bursts.
// Objects are created once and reused, so repeated harvesting never allocates per frame
// and the number of live particles is capped (QUALITY_STANDARDS 1 and 3.3).

import { Container, Sprite, Text, Texture } from 'pixi.js';
import { hex, TOKENS } from '../ui/tokens.ts';

const FLOAT_POOL = 16;
const PARTICLE_POOL = 60;
const FLOAT_LIFE_MS = 1300;

interface Floater {
  text: Text;
  life: number;
  vy: number;
}

interface Particle {
  sprite: Sprite;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
  baseScale: number;
}

interface Flyer {
  sprite: Sprite;
  t: number;
  delay: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  done: (() => void) | null;
}

export class Effects extends Container {
  private flyers: Flyer[] = [];
  private nextFlyer = 0;
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private nextFloater = 0;
  private nextParticle = 0;

  constructor() {
    super();
    this.eventMode = 'none';
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.addChild(sprite);
      this.particles.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, spin: 0, gravity: 0, baseScale: 1 });
    }
    for (let i = 0; i < TOKENS.motion.maxFlyingItems; i++) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.addChild(sprite);
      this.flyers.push({ sprite, t: 0, delay: 0, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, done: null });
    }
    for (let i = 0; i < FLOAT_POOL; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: `"${TOKENS.font.display}", sans-serif`,
          fontWeight: '800',
          fontSize: TOKENS.font.size.numberLarge,
          fill: hex(TOKENS.color.ui.textOnDark),
          stroke: { color: hex('#5A3A0E'), width: 5, join: 'round' },
        },
        resolution: 2,
      });
      text.anchor.set(0.5, 1);
      text.visible = false;
      this.addChild(text);
      this.floaters.push({ text, life: 0, vy: 0 });
    }
  }

  floatText(label: string, x: number, y: number, color = hex(TOKENS.color.ui.textOnDark)): void {
    const f = this.floaters[this.nextFloater]!;
    this.nextFloater = (this.nextFloater + 1) % FLOAT_POOL;
    f.text.text = label;
    f.text.style.fill = color;
    f.text.position.set(x, y);
    f.text.alpha = 1;
    f.text.scale.set(0.6);
    f.text.visible = true;
    f.life = FLOAT_LIFE_MS;
    f.vy = -70;
  }

  burst(texture: Texture, x: number, y: number, count: number, opts: { speed?: number; scale?: number; gravity?: number; life?: number; tint?: number } = {}): void {
    const speed = opts.speed ?? 260;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextParticle]!;
      this.nextParticle = (this.nextParticle + 1) % PARTICLE_POOL;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const v = speed * (0.5 + Math.random() * 0.6);
      p.sprite.texture = texture;
      p.sprite.tint = opts.tint ?? 0xffffff;
      p.sprite.position.set(x, y);
      p.sprite.alpha = 1;
      p.sprite.rotation = Math.random() * Math.PI;
      p.baseScale = (opts.scale ?? 0.3) * (0.7 + Math.random() * 0.6);
      p.sprite.scale.set(p.baseScale);
      p.sprite.visible = true;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.spin = (Math.random() - 0.5) * 6;
      p.gravity = opts.gravity ?? 700;
      p.maxLife = p.life = opts.life ?? 800;
    }
  }

  /** Produce flies along an arc into the storage button (DESIGN_SYSTEM 9, max 12 at once). */
  fly(texture: Texture, from: { x: number; y: number }, to: { x: number; y: number }, delayMs: number, scale: number, done?: () => void): void {
    const f = this.flyers[this.nextFlyer]!;
    this.nextFlyer = (this.nextFlyer + 1) % this.flyers.length;
    f.sprite.texture = texture;
    f.sprite.scale.set(scale);
    f.sprite.position.set(from.x, from.y);
    f.sprite.visible = delayMs <= 0;
    f.sprite.alpha = 1;
    f.from = from;
    f.to = to;
    f.t = 0;
    f.delay = delayMs;
    f.done = done ?? null;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const dur = TOKENS.motion.flyToBag.ms;
    for (const f of this.flyers) {
      if (f.t >= 1 && !f.sprite.visible) continue;
      if (f.delay > 0) {
        f.delay -= dtMs;
        if (f.delay > 0) continue;
        f.sprite.visible = true;
      }
      if (!f.sprite.visible) continue;
      f.t = Math.min(1, f.t + dtMs / dur);
      const k = f.t;
      const lift = Math.min(f.from.y, f.to.y) - 160;
      // Quadratic Bézier arc through a raised midpoint.
      const mx = (f.from.x + f.to.x) / 2;
      f.sprite.x = (1 - k) * (1 - k) * f.from.x + 2 * (1 - k) * k * mx + k * k * f.to.x;
      f.sprite.y = (1 - k) * (1 - k) * f.from.y + 2 * (1 - k) * k * lift + k * k * f.to.y;
      f.sprite.rotation = k * 2;
      if (f.t >= 1) {
        f.sprite.visible = false;
        f.done?.();
        f.done = null;
      }
    }
    for (const f of this.floaters) {
      if (!f.text.visible) continue;
      f.life -= dtMs;
      if (f.life <= 0) {
        f.text.visible = false;
        continue;
      }
      const age = 1 - f.life / FLOAT_LIFE_MS;
      f.text.y += f.vy * dt;
      f.text.scale.set(age < 0.15 ? 0.6 + (age / 0.15) * 0.5 : 1.1 - Math.min(0.1, (age - 0.15) * 0.4));
      f.text.alpha = age > 0.65 ? 1 - (age - 0.65) / 0.35 : 1;
    }
    for (const p of this.particles) {
      if (!p.sprite.visible) continue;
      p.life -= dtMs;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      const k = p.life / p.maxLife;
      p.sprite.alpha = Math.min(1, k * 2);
      p.sprite.scale.set(p.baseScale * (0.6 + 0.4 * k));
    }
  }
}
