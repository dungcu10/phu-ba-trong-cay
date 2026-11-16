// Atmosphere around the garden (code-drawn effects, REDESIGN_V2 1 "2.5D chính diện"): slow cloud
// puffs behind and in front of the floors with parallax, warm light rays from the upper right,
// and pollen motes drifting up. Screen-space, ~40 sprites, no per-frame allocation.

import { Container, Sprite, Texture } from 'pixi.js';

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return Texture.from(c);
}

/** A fluffy cloud made of overlapping soft blobs, flat-ish bottom, white with a lilac underside. */
function cloudTexture(seed: number): Texture {
  return canvasTexture(512, 220, (g) => {
    let r = seed;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 14; i++) {
      const x = 70 + rnd() * 370;
      const y = 110 + rnd() * 40 - Math.sin((x / 512) * Math.PI) * 50;
      const rad = 50 + rnd() * 50;
      const grad = g.createRadialGradient(x, y - rad * 0.2, rad * 0.1, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.6, 'rgba(250,244,255,0.8)');
      grad.addColorStop(1, 'rgba(225,210,240,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  });
}

const rayTexture = () =>
  canvasTexture(64, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(255,240,200,0.9)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    const side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, 64, 512);
  });

interface Puff {
  s: Sprite;
  speed: number;
  y: number;
  parallax: number;
}

interface Mote {
  s: Sprite;
  x: number;
  y: number;
  vy: number;
  phase: number;
}

export class Ambience {
  readonly back = new Container();
  readonly front = new Container();
  private readonly puffs: Puff[] = [];
  private readonly rays: Sprite[] = [];
  private readonly motes: Mote[] = [];
  private w = 1;
  private h = 1;
  private t = 0;

  constructor(glow: Texture) {
    const clouds = [cloudTexture(7), cloudTexture(42), cloudTexture(99)];
    const ray = rayTexture();
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(ray);
      s.anchor.set(0.5, 0);
      s.blendMode = 'add';
      this.rays.push(s);
      this.back.addChild(s);
    }
    // Behind the floors: small, slow, faint. In front: big, faster, very faint, near the bottom.
    for (let i = 0; i < 6; i++) this.addPuff(clouds[i % 3]!, this.back, 0.35 + (i % 3) * 0.1, 6 + i * 2, 0.15 + i * 0.13, 0.3, 0.5);
    for (let i = 0; i < 3; i++) this.addPuff(clouds[(i + 1) % 3]!, this.front, 1.1 + i * 0.25, 18 + i * 6, 0.82 + i * 0.07, 1.4, 0.28);
    for (let i = 0; i < 26; i++) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = i % 3 === 0 ? 0xfff1b8 : 0xffffff;
      this.front.addChild(s);
      this.motes.push({ s, x: Math.random(), y: Math.random(), vy: 0.008 + Math.random() * 0.012, phase: Math.random() * 6.28 });
    }
  }

  private addPuff(tex: Texture, layer: Container, scale: number, speed: number, y: number, parallax: number, alpha: number): void {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(scale);
    s.alpha = alpha;
    s.x = Math.random() * 1600;
    layer.addChild(s);
    this.puffs.push({ s, speed, y, parallax });
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.rays.forEach((r, i) => {
      r.position.set(w * (0.78 + i * 0.07), -40);
      r.scale.set(1.6 + i * 0.6, (h * 1.3) / 512);
      r.rotation = 0.5 + i * 0.09;
    });
  }

  /** dt in ms; scroll in world points (camera height), for parallax. */
  update(dt: number, scroll: number): void {
    this.t += dt / 1000;
    const span = this.w + 700;
    for (const p of this.puffs) {
      p.s.x += (p.speed * dt) / 1000;
      if (p.s.x > this.w + 350) p.s.x -= span;
      p.s.y = this.h * p.y + ((scroll * p.parallax) % (this.h * 1.6)) * 0.25;
    }
    this.rays.forEach((r, i) => (r.alpha = 0.1 + 0.06 * Math.sin(this.t * 0.4 + i * 1.7)));
    for (const m of this.motes) {
      m.y -= (m.vy * dt) / 1000;
      if (m.y < -0.05) {
        m.y = 1.05;
        m.x = Math.random();
      }
      m.s.position.set(m.x * this.w + Math.sin(this.t * 0.8 + m.phase) * 18, m.y * this.h);
      const tw = 0.5 + 0.5 * Math.sin(this.t * 2.3 + m.phase);
      m.s.alpha = 0.25 + tw * 0.45;
      m.s.scale.set(0.05 + tw * 0.05);
    }
  }
}
