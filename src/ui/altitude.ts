// Chỉ thị 11 TỔNG § C3: the altitude gauge on the right edge — a dot for the village and one for each
// open floor, the floor in view lit, floors with something to do (ripe crop, hungry bird) ringed in
// gold. "Độ cao: 1.250 m" (250 m a floor). A tap flies the camera there in 0,6 s; the house opens
// the village. The first time the camera enters a new sky zone its name shows large and fades in 2 s.
// Updated on game events and camera moves, not every frame.

import type { GameSession } from '../app/session.ts';
import { cropStatus } from '../systems/growth.ts';
import { foodAt as birdFood } from '../systems/birds.ts';
import { ZONES, zoneOf } from '../render/zones.ts';
import { h } from './dom.ts';
import { lineIcon } from './lineIcons.ts';
import { formatNumber } from './text.ts';

export const METERS_PER_FLOOR = 250;
const SEEN_KEY = 'pbtc.zonesSeen';

function readSeen(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[0]') as number[]);
  } catch {
    return new Set([0]);
  }
}

export interface AltitudeActions {
  goFloor(index: number): void;
  openVillage(): void;
}

export class AltitudeGauge {
  readonly el: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly label: HTMLElement;
  private readonly banner: HTMLElement;
  private current = 0;
  private seen = readSeen();

  constructor(
    private readonly session: GameSession,
    private readonly actions: AltitudeActions,
  ) {
    this.dots = h('div', { class: 'alt-dots' });
    this.label = h('div', { class: 'alt-label' });
    this.el = h('div', { class: 'alt-gauge', 'data-test': 'altitude' }, this.label, h('div', { class: 'alt-rail' }), this.dots);
    this.banner = h('div', { class: 'zone-banner', 'aria-live': 'polite' });
    // Chỉ thị 12 A7 G3: "Có X chậu chín" flies straight to the floor with the most ripe pots.
    this.ripe = h('button', { class: 'ripe-pill hidden', 'data-test': 'ripe-pill', onclick: () => this.ripeFloor !== null && this.actions.goFloor(this.ripeFloor) });
  }

  private readonly ripe: HTMLElement;
  private ripeFloor: number | null = null;

  /** The floating "Có X chậu chín" button (placed by the controller). */
  get ripeEl(): HTMLElement {
    return this.ripe;
  }

  /** The zone banner lives in the overlay, not inside the gauge. */
  get bannerEl(): HTMLElement {
    return this.banner;
  }

  setCamera(floor: number): void {
    this.current = floor;
    this.update();
    if (floor < 0) return;
    const z = zoneOf(this.current);
    if (!this.seen.has(z)) {
      this.seen.add(z);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...this.seen]));
      } catch {
        /* storage may be unavailable */
      }
      this.showZone(z);
    }
  }

  private showZone(z: number): void {
    const zone = ZONES[z]!;
    this.banner.replaceChildren(h('small', {}, `Tầng ${z * 5 + 1}–${z * 5 + 5}`), h('strong', {}, zone.name));
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  update(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    const busy = new Set<number>();
    const ripeCount: number[] = [];
    state.floors.forEach((f, i) => {
      ripeCount[i] = f.slots.filter((s) => s.planting && cropStatus(content, state, s, now)?.ripe).length;
      if (ripeCount[i]! > 0) busy.add(i);
    });
    // Ripe pots on floors other than the one in view.
    let best = -1;
    let total = 0;
    ripeCount.forEach((n, i) => {
      if (i === this.current || n === 0) return;
      total += n;
      if (best < 0 || n > ripeCount[best]!) best = i;
    });
    this.ripeFloor = best >= 0 ? best : null;
    this.ripe.classList.toggle('hidden', total === 0 || this.el.hidden === true);
    if (total > 0) this.ripe.textContent = `Có ${total} chậu chín · Tầng ${best + 1} ${best > this.current ? '↑' : '↓'}`;
    for (const b of state.birds) if (b.floor !== null && birdFood(content, b, now) <= 0) busy.add(b.floor);
    const n = state.floors.length;
    const list: HTMLElement[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const cls = `alt-dot z${zoneOf(i)}${i === this.current ? ' on' : ''}${busy.has(i) ? ' busy' : ''}`;
      list.push(h('button', { class: cls, 'aria-label': `Tầng ${i + 1}`, title: `Tầng ${i + 1}`, 'data-test': `alt-${i}`, onclick: () => this.actions.goFloor(i) }));
    }
    list.push(h('button', { class: `alt-home${this.current < 0 ? ' on' : ''}`, 'data-test': 'alt-home', 'aria-label': 'Về làng', title: 'Làng Phú Bà', onclick: () => this.actions.openVillage() }, lineIcon('house', 16)));
    this.dots.replaceChildren(...list);
    this.label.textContent = this.current < 0 ? 'Làng Phú Bà · 0 m' : `Độ cao: ${formatNumber((this.current + 1) * METERS_PER_FLOOR)} m`;
  }
}
