// Chỉ thị 10 § 3.7: the Biển Mây Bí Ẩn window. A 6×8 grid of cloud clumps (cut from the approved
// cloud rings and floor undersides by tools/art/make-sea-clouds.py, each turned, flipped and sized at
// random so none repeat); tapping one sends blowCloud. Under the clouds lie minerals, Sợi Mây, Giọt
// Sương, rare bugs and 2×2 chests (drawn under the cloud layer so they peek out as the clouds clear).
// Xu Xu waves while blowing, is surprised by a chest, happy when the map is cleared and asleep when
// the wind runs out. Reads state, sends commands only. Opened by openSea() (chỉ thị 11: the Cổng
// Biển Mây in the village will call the same function).

import type { GameSession } from '../app/session.ts';
import type { GameEvent } from '../core/game.ts';
import { randomFor } from '../core/rng.ts';
import { ensureSeaMap, nextEnergyAt, seaCells, seaRules, settleEnergy } from '../systems/sea.ts';
import cloudData from '../../assets/art/sea_clouds.json';
import cloudUrl from '../../assets/art/sea_clouds.webp?url';
import { itemIcon } from './icons.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { formatClock } from './text.ts';
import { FishingView, type FishingActions } from './fishingView.ts';

export interface SeaActions extends FishingActions {
  blowCloud(cell: number): void;
}

type Pose = 'wave' | 'surprised' | 'happy' | 'sleep';
const CELL = 64;
const CLOUDS = Object.values((cloudData as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> }).frames).map((f) => f.frame);
const SHEET = (cloudData as { meta: { size: { w: number; h: number } } }).meta.size;

export class SeaPanel extends Panel {
  private pose: Pose = 'wave';
  private justOpened = -1;
  private readonly energyText = h('span', { class: 'sea-energy-num', 'data-test': 'sea-energy' });
  private readonly energyNext = h('span', { class: 'note' });
  private readonly energyFill = h('span', { class: 'luck-fill' });

  private readonly fishing: FishingView;

  constructor(
    private readonly session: GameSession,
    private readonly actions: SeaActions,
    private tab: 'dig' | 'fish' = 'dig',
  ) {
    super('Biển Mây', 'sea-panel', 'win-wide');
    this.fishing = new FishingView(session, actions);
    this.render();
  }

  override close(): void {
    this.fishing.stop();
    super.close();
  }

  /** Called by the controller with each command's events. */
  react(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'lineCast') this.fishing.react('lineCast');
      if (e.type === 'fishReeled') this.fishing.react('fishReeled', e.fishId, e.landed);
      if (e.type !== 'cloudBlown') continue;
      this.justOpened = e.cell;
      this.pose = e.cleared ? 'happy' : e.chest !== undefined ? 'surprised' : 'wave';
    }
  }

  /** Energy and its countdown, without rebuilding the map (every second). */
  tick(): void {
    const { content, state } = this.session;
    const r = seaRules(content);
    if (!r) return;
    // Show the refill as it stands now without changing the save outside a command.
    const view = { ...state, energy: { ...state.energy } };
    settleEnergy(content, view, this.session.now());
    const e = view.energy;
    this.energyText.textContent = `${e.value}/${r.energy.max}`;
    this.energyFill.style.width = `${Math.min(100, (100 * e.value) / r.energy.max)}%`;
    const next = nextEnergyAt(content, view);
    this.energyNext.textContent = next === null ? 'Gió đầy' : `+1 sau ${formatClock(next - this.session.now())}`;
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const r = seaRules(content);
    if (!r) return;
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    for (const [id, name] of [['dig', 'Thổi mây tìm đồ'], ['fish', 'Câu cá']] as const) {
      tabs.append(h('button', { class: `tab${this.tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': this.tab === id ? 'true' : 'false', 'data-test': `sea-tab-${id}`, onclick: () => ((this.tab = id), this.render()) }, name));
    }
    this.body.append(h('div', { class: 'filters' }, tabs));
    if (this.tab === 'fish') return void this.body.append(this.fishing.render());
    const now = this.session.now();
    if (state.player.level < r.unlockLevel) {
      this.body.append(h('p', { class: 'note' }, `Biển Mây mở ở cấp ${r.unlockLevel}.`));
      return;
    }
    // The first map is laid by the first tap; until then show the one it will be (no save change here).
    const view = { ...state, seaMap: { ...state.seaMap } };
    ensureSeaMap(content, view, now);
    this.tick();
    const sm = view.seaMap;
    const cells = seaCells(content, view);
    const open = new Set(sm.open);
    const total = r.cols * r.rows;
    const pose: Pose = state.energy.value < 1 && this.pose === 'wave' ? 'sleep' : this.pose;
    const xuxu = icon(`xuxu/${pose}`, 120);
    xuxu.classList.add('sea-xuxu', `pose-${pose}`);
    const chestsLeft = new Set(cells.filter((c) => c.kind === 'chest').map((c) => c.chest!)).size - sm.chests.length;
    const side = h(
      'div',
      { class: 'sea-side' },
      xuxu,
      h('div', { class: 'sea-energy' }, icon('icon/wind-energy', 34), h('span', {}, 'Năng Lượng Gió'), this.energyText),
      h('span', { class: 'luck-track sea-track' }, this.energyFill),
      this.energyNext,
      h('p', { class: 'note' }, `Mỗi ngày tặng thêm ${r.energy.daily} gió.`),
      h('div', { class: 'sea-stats' }, h('span', {}, `Bản đồ số ${sm.index + 1}`), h('span', {}, `Đã thổi ${open.size}/${total}`), h('span', {}, icon('icon/drift-chest', 22), `Rương còn ${chestsLeft}`)),
      h('p', { class: 'note' }, 'Thổi tan hết mây để nhận thưởng lớn và mở bản đồ mới. Rương nằm dưới 4 cụm mây, thổi tan cả 4 mới mở được.'),
    );
    const grid = h('div', { class: 'sea-grid', style: `grid-template-columns:repeat(${r.cols},${CELL}px);grid-template-rows:repeat(${r.rows},${CELL}px)` });
    // Chests under the clouds.
    for (const at of new Set(cells.filter((c) => c.kind === 'chest').map((c) => c.chest!))) {
      const done = sm.chests.includes(at);
      const pic = icon('icon/drift-chest', CELL * 1.6);
      grid.append(h('div', { class: `sea-chest${done ? ' opened' : ''}`, style: `grid-column:${(at % r.cols) + 1} / span 2;grid-row:${Math.floor(at / r.cols) + 1} / span 2` }, pic));
    }
    cells.forEach((c, i) => {
      const style = `grid-column:${(i % r.cols) + 1};grid-row:${Math.floor(i / r.cols) + 1}`;
      if (open.has(i)) {
        const fresh = i === this.justOpened;
        const inner = c.kind === 'item' ? [itemIcon(content, c.itemId!, 40), c.qty! > 1 ? h('span', { class: 'qty-tag' }, `×${c.qty}`) : null] : [];
        grid.append(h('div', { class: `sea-cell open${fresh ? ' fresh' : ''}${c.kind === 'chest' ? ' chest' : ''}`, style, 'data-test': `sea-cell-${i}` }, ...inner));
        return;
      }
      const btn = h('button', { class: 'sea-cell cloud', style, 'aria-label': 'Thổi tan cụm mây', 'data-test': `sea-cell-${i}`, onclick: () => (state.energy.value < 1 && this.energyEmpty() ? shake(btn) : this.actions.blowCloud(i)) }, this.cloud(i, sm));
      grid.append(btn);
    });
    this.justOpened = -1;
    this.pose = 'wave';
    this.body.append(h('div', { class: 'sea-layout' }, side, h('div', { class: 'sea-board' }, grid)));
  }

  private energyEmpty(): boolean {
    const view = { ...this.session.state, energy: { ...this.session.state.energy } };
    settleEnergy(this.session.content, view, this.session.now());
    return view.energy.value < 1;
  }

  /** One cloud clump: a crop picked, turned, flipped and sized from the map's seed. */
  private cloud(i: number, sm: { day: number; index: number }): HTMLElement {
    const { state } = this.session;
    const r = (k: string) => randomFor(state.seed, 'seaLook', sm.day, sm.index, i, k);
    const f = CLOUDS[Math.floor(r('frame') * CLOUDS.length)]!;
    const size = CELL * (1.25 + r('size') * 0.35);
    const k = size / f.w;
    const el = h('span', { class: 'sea-puff', 'aria-hidden': 'true' });
    Object.assign(el.style, {
      width: `${f.w * k}px`,
      height: `${f.h * k}px`,
      backgroundImage: `url("${cloudUrl}")`,
      backgroundSize: `${SHEET.w * k}px ${SHEET.h * k}px`,
      backgroundPosition: `${-f.x * k}px ${-f.y * k}px`,
      transform: `translate(-50%, -50%) rotate(${Math.round((r('rot') - 0.5) * 30)}deg) scaleX(${r('flip') < 0.5 ? -1 : 1})`,
    });
    return el;
  }
}
