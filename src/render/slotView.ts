// One pot position on a cloud floor: pedestal, pot, plant, status bubble, Bọ Mây, timer.
// It only displays a CropStatus computed by the simulation; it never decides game rules.

import { Container, Graphics, Rectangle, Sprite, Text, type Texture } from 'pixi.js';
import type { CropStatus } from '../systems/growth.ts';
import { formatClock } from '../ui/text.ts';
import type { Art } from './assets.ts';
import { ease, type Tweens } from './tween.ts';

/** Geometry in points, relative to the pot's base (its anchor). */
export const SLOT_GEOM = {
  potMouthY: -66,
  bubbleY: -250,
  bugOffset: { x: 34, y: -140 },
  timerY: 34,
  barWidth: 104,
  hit: { x: -92, y: -250, w: 184, h: 300 },
} as const;

export class SlotView extends Container {
  private readonly pedestal: Sprite;
  private readonly pot: Sprite;
  private readonly plant: Sprite;
  private readonly bubble: Sprite;
  private readonly bug: Sprite;
  private readonly bar: Graphics;
  private readonly timer: Text;
  private readonly phase = Math.random() * Math.PI * 2;

  private plantKey = '';
  private potKey = '';
  private bugTextures: [Texture, Texture] | null = null;
  private bubbleKind: 'none' | 'water' | 'ripe' = 'none';
  private hasBug = false;
  private swayAmount = 0;
  private bubbleScale = 1;
  private plantPop = 1;
  private potPop = 1;
  private lastBarProgress = -1;
  private lastTimerText = '';

  constructor(
    readonly index: number,
    private readonly art: Art,
    private readonly tweens: Tweens,
  ) {
    super();
    this.pedestal = new Sprite();
    this.pedestal.anchor.set(0.5);
    this.pedestal.y = -6;
    this.pot = new Sprite();
    this.plant = new Sprite();
    this.plant.y = SLOT_GEOM.potMouthY + 4;
    this.bubble = new Sprite(art.get('ui/bubble-water'));
    this.bubble.y = SLOT_GEOM.bubbleY;
    this.bubble.visible = false;
    this.bug = new Sprite();
    this.bug.anchor.set(0.5);
    this.bug.visible = false;
    this.bar = new Graphics();
    this.bar.y = SLOT_GEOM.timerY - 12;
    this.timer = new Text({
      text: '',
      style: { fontFamily: '"Baloo 2", sans-serif', fontWeight: '700', fontSize: 20, fill: 0x5b3a29, stroke: { color: 0xfff6e3, width: 5, join: 'round' } },
      resolution: 2,
    });
    this.timer.anchor.set(0.5, 0);
    this.timer.y = SLOT_GEOM.timerY - 2;
    this.addChild(this.pedestal, this.pot, this.plant, this.bug, this.bubble, this.bar, this.timer);

    const g = SLOT_GEOM.hit;
    this.hitArea = new Rectangle(g.x, g.y, g.w, g.h);
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  setPot(potSprite: string, level: number): void {
    const key = `${potSprite}/${level}`;
    if (key === this.potKey) return;
    const upgraded = this.potKey !== '' && this.potKey.startsWith(potSprite);
    this.potKey = key;
    this.pedestal.texture = this.art.get(`${potSprite}/pedestal`);
    this.pot.texture = this.art.get(key);
    this.pot.anchor.copyFrom(this.pot.texture.defaultAnchor);
    if (upgraded) this.popPot();
  }

  /** Updates the plant, bubble, bug and timer from the current status (null = empty pot). */
  setStatus(status: CropStatus | null): void {
    const key = status ? `${status.crop.sprite}/${status.stage}` : '';
    if (key !== this.plantKey) {
      const grew = this.plantKey !== '' && key !== '';
      this.plantKey = key;
      this.plant.visible = key !== '';
      if (key) {
        this.plant.texture = this.art.get(key);
        this.plant.anchor.copyFrom(this.plant.texture.defaultAnchor);
        if (grew) this.popPlant(0.85);
      }
      this.swayAmount = status && status.stage >= 2 ? 0.035 : 0.015;
    }

    const kind = !status ? 'none' : status.ripe ? 'ripe' : status.thirsty ? 'water' : 'none';
    if (kind !== this.bubbleKind) {
      this.bubbleKind = kind;
      this.bubble.visible = kind !== 'none';
      if (kind !== 'none') {
        this.bubble.texture = this.art.get(kind === 'ripe' ? 'ui/bubble-ripe' : 'ui/bubble-water');
        this.bubble.anchor.copyFrom(this.bubble.texture.defaultAnchor);
        this.tweens.add(420, ease.outBack, (v) => (this.bubbleScale = v));
      }
    }

    const bug = status?.bug ?? null;
    if (bug && !this.hasBug) {
      this.bugTextures = [this.art.get(`${bug.bug.sprite}/0`), this.art.get(`${bug.bug.sprite}/1`)];
      this.bug.visible = true;
      this.tweens.add(380, ease.outBack, (v) => this.bug.scale.set(v));
    } else if (!bug && this.hasBug) {
      this.bug.visible = false;
    }
    this.hasBug = bug !== null;

    this.updateTimer(status);
  }

  private updateTimer(status: CropStatus | null): void {
    const growing = status !== null && !status.ripe;
    const label = growing ? formatClock(status.remainingMs) : '';
    if (label !== this.lastTimerText) {
      this.lastTimerText = label;
      this.timer.text = label;
    }
    const progress = growing ? Math.round(status.progress * 50) / 50 : -1;
    if (progress === this.lastBarProgress) return;
    this.lastBarProgress = progress;
    const w = SLOT_GEOM.barWidth;
    this.bar.clear();
    if (progress < 0) return;
    this.bar.roundRect(-w / 2, 0, w, 10, 5).fill({ color: 0x5b3a29, alpha: 0.35 });
    this.bar.roundRect(-w / 2 + 2, 2, Math.max(6, (w - 4) * progress), 6, 3).fill(0x8bd15a);
  }

  popPlant(from = 0.6): void {
    this.tweens.add(450, ease.outElastic, (v) => (this.plantPop = from + (1 - from) * v));
  }

  popPot(): void {
    this.tweens.add(600, ease.outElastic, (v) => (this.potPop = 0.8 + 0.2 * v));
  }

  /** Point (in this view's parent space) where feedback for this pot should appear. */
  feedbackPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y + SLOT_GEOM.potMouthY - 90 };
  }

  bugPoint(): { x: number; y: number } {
    return { x: this.x + this.bug.x, y: this.y + this.bug.y };
  }

  /** Per-frame animation only; no game logic, no allocation. */
  animate(timeMs: number): void {
    const t = timeMs / 1000;
    this.plant.skew.x = Math.sin(t * 1.7 + this.phase) * this.swayAmount;
    const squash = 1 + Math.sin(t * 2.1 + this.phase) * 0.012;
    this.plant.scale.set(this.plantPop / squash, this.plantPop * squash);
    this.pot.scale.set(this.potPop);
    if (this.bubble.visible) {
      this.bubble.y = SLOT_GEOM.bubbleY + Math.sin(t * 3 + this.phase) * 6;
      this.bubble.scale.set(this.bubbleScale);
    }
    if (this.bug.visible && this.bugTextures) {
      this.bug.texture = this.bugTextures[Math.floor(t * 9) % 2]!;
      this.bug.x = SLOT_GEOM.bugOffset.x + Math.sin(t * 2.3 + this.phase) * 10;
      this.bug.y = SLOT_GEOM.bugOffset.y + Math.cos(t * 3.1 + this.phase) * 8;
    }
  }
}
