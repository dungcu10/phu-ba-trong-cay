// Small synthesized sound effects (Web Audio). No audio files are needed.
// The AudioContext is created only after the first touch, as iOS requires.

export type SfxName = 'tap' | 'plant' | 'water' | 'bug' | 'harvest' | 'coin' | 'levelUp' | 'upgrade' | 'error';

interface Note {
  freq: number;
  at: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  slideTo?: number;
}

const SOUNDS: Record<SfxName, Note[]> = {
  tap: [{ freq: 660, at: 0, dur: 0.05, type: 'sine', gain: 0.12 }],
  plant: [{ freq: 300, at: 0, dur: 0.12, type: 'sine', gain: 0.25, slideTo: 520 }],
  water: [
    { freq: 900, at: 0, dur: 0.08, type: 'sine', gain: 0.14, slideTo: 1400 },
    { freq: 700, at: 0.07, dur: 0.08, type: 'sine', gain: 0.12, slideTo: 1200 },
    { freq: 1000, at: 0.14, dur: 0.08, type: 'sine', gain: 0.1, slideTo: 1500 },
  ],
  bug: [
    { freq: 1800, at: 0, dur: 0.05, type: 'triangle', gain: 0.1 },
    { freq: 2200, at: 0.06, dur: 0.05, type: 'triangle', gain: 0.1 },
  ],
  harvest: [
    { freq: 523, at: 0, dur: 0.1, type: 'triangle', gain: 0.22 },
    { freq: 784, at: 0.08, dur: 0.16, type: 'triangle', gain: 0.2 },
  ],
  coin: [
    { freq: 988, at: 0, dur: 0.08, type: 'square', gain: 0.06 },
    { freq: 1319, at: 0.07, dur: 0.22, type: 'square', gain: 0.06 },
  ],
  levelUp: [
    { freq: 523, at: 0, dur: 0.14, type: 'triangle', gain: 0.22 },
    { freq: 659, at: 0.12, dur: 0.14, type: 'triangle', gain: 0.22 },
    { freq: 784, at: 0.24, dur: 0.14, type: 'triangle', gain: 0.22 },
    { freq: 1047, at: 0.36, dur: 0.4, type: 'triangle', gain: 0.24 },
  ],
  upgrade: [
    { freq: 392, at: 0, dur: 0.12, type: 'sine', gain: 0.2, slideTo: 784 },
    { freq: 1175, at: 0.12, dur: 0.3, type: 'triangle', gain: 0.16 },
  ],
  error: [{ freq: 200, at: 0, dur: 0.14, type: 'sine', gain: 0.2, slideTo: 140 }],
};

export class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Call once; creates the audio context on the first touch anywhere. */
  armOnFirstTouch(target: EventTarget = window): void {
    const unlock = () => {
      this.unlock();
      target.removeEventListener('pointerdown', unlock);
    };
    target.addEventListener('pointerdown', unlock);
  }

  private unlock(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const n of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, t0 + n.at);
      if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur);
      gain.gain.setValueAtTime(0.0001, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(n.gain, t0 + n.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
  }
}
