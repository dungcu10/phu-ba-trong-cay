// Minimal tweening with easing. Tweens are created on game events (not every frame) and
// stepped from the render loop.

export type Ease = (t: number) => number;

export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBounce: (t: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
} satisfies Record<string, Ease>;

interface Tween {
  owner: { destroyed: boolean } | null;
  elapsed: number;
  duration: number;
  ease: Ease;
  apply: (v: number) => void;
  done?: () => void;
}

export class Tweens {
  private active: Tween[] = [];

  /** Animates v from 0 to 1 over durationMs, calling apply with the eased value. With an owner
   *  (a display object), the tween stops silently once the owner is destroyed — floors and signs
   *  are rebuilt when they change, possibly in the middle of an animation. */
  add(durationMs: number, easeFn: Ease, apply: (v: number) => void, done?: () => void, owner: { destroyed: boolean } | null = null): void {
    apply(0);
    this.active.push({ owner, elapsed: 0, duration: durationMs, ease: easeFn, apply, done });
  }

  update(dtMs: number): void {
    let w = 0;
    for (let i = 0; i < this.active.length; i++) {
      const tw = this.active[i]!;
      if (tw.owner?.destroyed) continue;
      tw.elapsed += dtMs;
      const t = Math.min(1, tw.elapsed / tw.duration);
      // One broken animation must never stop the render loop (a frozen game is far worse).
      try {
        tw.apply(tw.ease(t));
        if (t >= 1) tw.done?.();
      } catch (e) {
        console.warn('Bỏ một hoạt ảnh lỗi', e);
        continue;
      }
      if (t < 1) this.active[w++] = tw;
    }
    this.active.length = w;
  }
}
