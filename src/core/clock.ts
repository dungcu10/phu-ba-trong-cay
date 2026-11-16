// Time source and guard against changing the device clock.
// Game rules never call Date.now() themselves: they receive "now" from here.

export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A clock tests and dev tools can move by hand. */
export class ManualClock implements Clock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

/** Real clock plus an offset, used by the dev fast-forward tool only. */
export class OffsetClock implements Clock {
  private offsetMs = 0;
  constructor(private readonly base: Clock) {}
  now(): number {
    return this.base.now() + this.offsetMs;
  }
  advance(ms: number): void {
    this.offsetMs += ms;
  }
}

/**
 * Game time never moves backwards. If the device clock is set back, game time stays at the
 * latest moment ever seen until the real clock passes it again, so rolling back the clock
 * cannot re-run timers or produce anything twice.
 */
export function guardedNow(realNow: number, maxSeenAt: number): number {
  return Math.max(realNow, maxSeenAt);
}
