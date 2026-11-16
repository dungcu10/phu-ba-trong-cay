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
 * Game time = device clock + an offset kept in the save. It never moves backwards and never
 * stands still: if the device clock is found behind the latest game time ever seen (clock set
 * back, or set forward and then corrected), the offset grows so game time continues from that
 * moment and keeps flowing with the real clock. Rolling the clock back therefore cannot re-run
 * timers or produce anything twice, and correcting a clock set ahead does not freeze the game.
 */
export function gameTime(realNow: number, clockOffsetMs: number, maxSeenAt: number): number {
  return Math.max(realNow + clockOffsetMs, maxSeenAt);
}

/** Offset to store so that gameTime(realNow, offset) === the returned game time. */
export function adjustedOffset(realNow: number, clockOffsetMs: number, maxSeenAt: number): number {
  const t = realNow + clockOffsetMs;
  return t < maxSeenAt ? maxSeenAt - realNow : clockOffsetMs;
}
