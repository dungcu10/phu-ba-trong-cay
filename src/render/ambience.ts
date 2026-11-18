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

/** A small bird in flight (two curved strokes), for the flock over the low sky. */
const birdTexture = () =>
  canvasTexture(48, 24, (g) => {
    g.strokeStyle = 'rgba(70,60,90,0.85)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(3, 10);
    g.quadraticCurveTo(13, 1, 24, 13);
    g.quadraticCurveTo(35, 1, 45, 10);
    g.stroke();
  });

/** A soft wavy band of green and violet light (aurora), drawn once. */
const auroraTexture = () =>
  canvasTexture(1024, 256, (g) => {
    for (let x = 0; x < 1024; x += 2) {
      const y = 128 + Math.sin(x / 90) * 40 + Math.sin(x / 37) * 12;
      const grad = g.createLinearGradient(0, y - 90, 0, y + 40);
      grad.addColorStop(0, 'rgba(160,120,255,0)');
      grad.addColorStop(0.45, 'rgba(120,255,200,0.55)');
      grad.addColorStop(0.75, 'rgba(170,140,255,0.35)');
      grad.addColorStop(1, 'rgba(170,140,255,0)');
      g.fillStyle = grad;
      g.fillRect(x, y - 90, 2, 130);
    }
    const fade = g.createLinearGradient(0, 0, 1024, 0);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.15, 'rgba(0,0,0,0)');
    fade.addColorStop(0.85, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 0, 1024, 256);
  });

/** Chỉ thị 11 § C2: how much each sky zone shows at camera floor f (1 inside the zone, fading over one floor). */
export function zoneWeights(f: number): [number, number, number, number] {
  const w = (z: number) => {
    if (z === 0 && f < 2.5) return 1;
    if (z === 3 && f > 17.5) return 1;
    return Math.min(1, Math.max(0, 1 - (Math.abs(f - (5 * z + 2)) - 2.5)));
  };
  return [w(0), w(1), w(2), w(3)];
}

const PUFF_TINTS = [0xffffff, 0xfff0d2, 0xf6dcf2, 0xb9bde9];
function mix(a: number, b: number, t: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return c(16) | c(8) | c(0);
}

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
  private readonly flock: Array<{ s: Sprite; dx: number; dy: number; phase: number }> = [];
  private flockX = -0.3;
  private readonly stars: Array<{ s: Sprite; x: number; y: number; phase: number; speed: number }> = [];
  private readonly auroras: Sprite[] = [];
  private weights: [number, number, number, number] = [1, 0, 0, 0];
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
    // § C2: stars and aurora for the night zone, a flock of small birds for the low sky.
    for (let i = 0; i < 44; i++) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = i % 4 === 0 ? 0xcfe0ff : 0xffffff;
      this.back.addChildAt(s, 0);
      this.stars.push({ s, x: Math.random(), y: Math.random() * 0.75, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2.5 });
    }
    const aurora = auroraTexture();
    for (let i = 0; i < 2; i++) {
      const s = new Sprite(aurora);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.auroras.push(s);
      this.back.addChildAt(s, this.stars.length);
    }
    const bird = birdTexture();
    for (let i = 0; i < 6; i++) {
      const s = new Sprite(bird);
      s.anchor.set(0.5);
      this.back.addChild(s);
      this.flock.push({ s, dx: -Math.abs(i - 2.5) * 34 + (i % 2) * 6, dy: i * 14 - 30 + (i % 2) * 10, phase: i * 0.9 });
    }
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

  /** dt in ms; scroll in world points (camera height), for parallax; f = camera floor (0 = floor 1, below 0 the village). */
  update(dt: number, scroll: number, f = 0): void {
    this.t += dt / 1000;
    const w = (this.weights = zoneWeights(f));
    const tint = w[3] > 0.5 ? mix(PUFF_TINTS[2]!, PUFF_TINTS[3]!, w[3]) : w[2] > 0 ? mix(PUFF_TINTS[1]!, PUFF_TINTS[2]!, w[2]) : mix(PUFF_TINTS[0]!, PUFF_TINTS[1]!, w[1]);
    for (const p of this.puffs) p.s.tint = tint;
    // Stars twinkle and the aurora drifts in the night zone only.
    for (const st of this.stars) {
      st.s.visible = w[3] > 0.01;
      if (!st.s.visible) continue;
      const tw = 0.5 + 0.5 * Math.sin(this.t * st.speed + st.phase);
      st.s.position.set(st.x * this.w, st.y * this.h);
      st.s.alpha = w[3] * (0.25 + tw * 0.75);
      st.s.scale.set(0.035 + tw * 0.04);
    }
    this.auroras.forEach((a, i) => {
      a.visible = w[3] > 0.01;
      if (!a.visible) return;
      a.position.set(this.w * (0.35 + i * 0.35) + Math.sin(this.t * 0.07 + i * 2) * 60, this.h * (0.2 + i * 0.08));
      a.scale.set((this.w / 1024) * (0.9 + i * 0.3), 1.2 + Math.sin(this.t * 0.3 + i) * 0.15);
      a.alpha = w[3] * (0.28 + 0.1 * Math.sin(this.t * 0.5 + i * 1.3));
    });
    // A small flock crosses the low sky now and then (about every 40 s).
    this.flockX += dt / 1000 / 22;
    if (this.flockX > 1.5) this.flockX = -0.3 - Math.random() * 0.4;
    for (const b of this.flock) {
      b.s.visible = w[0] > 0.01 && this.flockX > -0.25 && this.flockX < 1.25;
      if (!b.s.visible) continue;
      const flap = Math.sin(this.t * 9 + b.phase);
      b.s.position.set(this.flockX * this.w + b.dx, this.h * 0.22 + b.dy + Math.sin(this.t * 0.8) * 10);
      b.s.scale.set(0.7, 0.55 + flap * 0.35);
      b.s.alpha = w[0] * 0.75;
    }
    const span = this.w + 700;
    for (const p of this.puffs) {
      p.s.x += (p.speed * dt) / 1000;
      if (p.s.x > this.w + 350) p.s.x -= span;
      p.s.y = this.h * p.y + ((scroll * p.parallax) % (this.h * 1.6)) * 0.25;
    }
    // Light rays: strongest in the golden sky, faint at dusk, none at night.
    const rayK = 0.8 * w[0] + 1.8 * w[1] + 0.45 * w[2];
    this.rays.forEach((r, i) => (r.alpha = rayK * (0.1 + 0.06 * Math.sin(this.t * 0.4 + i * 1.7))));
    for (const m of this.motes) {
      m.y -= (m.vy * dt) / 1000;
      if (m.y < -0.05) {
        m.y = 1.05;
        m.x = Math.random();
      }
      m.s.position.set(m.x * this.w + Math.sin(this.t * 0.8 + m.phase) * 18, m.y * this.h);
      const tw = 0.5 + 0.5 * Math.sin(this.t * 2.3 + m.phase);
      m.s.alpha = (0.25 + tw * 0.45) * (1 - 0.6 * w[3]);
      m.s.scale.set(0.05 + tw * 0.05);
    }
  }
}
