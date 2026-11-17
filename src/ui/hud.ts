// Always-visible HUD (DESIGN_SYSTEM 6.3): flower level badge + vine XP bar and the side shelf of
// garden services (top-left), embroidered coin and gem pouches (top-centre), letters and gear
// (top-right), main buttons in a thumb arc (bottom-right). Under 15% of the screen.

import { svgIcon } from './icons.ts';
import type { GameSession } from '../app/session.ts';
import { storageCapacity, storageUsed, xpToNextLevel } from '../systems/economy.ts';
import { canDeliver } from '../systems/orders.ts';
import { nextMilestone } from '../systems/surprises.ts';
import { missionsReady } from '../systems/missions.ts';
import { claimableMilestones, visibleEvents } from '../systems/events.ts';
import { h } from './dom.ts';
import { nextHint } from './hint.ts';
import { formatNumber, formatTimeLeft } from './text.ts';

export interface HudActions {
  openSeeds(): void;
  openStorage(): void;
  openShop(): void;
  openSettings(): void;
  openOrders(): void;
  openStall(): void;
  openNeighbors(): void;
  openJournal(): void;
  openLetters(): void;
  openMissions(): void;
  openEvent(): void;
  toggleTray(): void;
}

export class Hud {
  readonly el: HTMLElement;
  private readonly level = h('span', { class: 'flower', 'data-test': 'level' });
  private readonly vineFill = h('span', { class: 'vine-fill' });
  private readonly xpText = h('span', { class: 'xp-text' });
  private readonly coins = h('span', {});
  private readonly gems = h('span', {});
  private readonly pouch: HTMLElement;
  private readonly gemPouch: HTMLElement;
  private readonly hint = h('div', { class: 'hint', role: 'status' });
  private readonly storageBadge = h('span', { class: 'badge' });
  private readonly orderBadge = h('span', { class: 'badge hidden' });
  private readonly stallBadge = h('span', { class: 'badge hidden' });
  private readonly journalBadge = h('span', { class: 'badge hidden' });
  private readonly letterBadge = h('span', { class: 'badge hidden' });
  private readonly missionBadge = h('span', { class: 'badge hidden' });
  private readonly eventBadge = h('span', { class: 'badge hidden' });
  private readonly eventTime = h('span', { class: 'ev-timer' });
  private readonly eventBtn: HTMLElement;
  private readonly seeds: HTMLElement;
  private last = { coins: -1, gems: -1 };
  /** Screen position of the storage button, where harvested produce flies to. */
  readonly storageButton: HTMLElement;

  constructor(
    private readonly session: GameSession,
    actions: HudActions,
  ) {
    const { content } = session;
    this.pouch = h('div', { class: 'plaque pouch', 'data-test': 'coins' }, svgIcon('coin', 40), this.coins);
    this.gemPouch = h('div', { class: 'plaque pouch gems', 'data-test': 'gems' }, svgIcon('gem', 36), this.gems);
    const levelBox = h('div', { class: 'plaque' }, this.level, h('span', { class: 'vine' }, this.vineFill, this.xpText));
    const letters = h('button', { class: 'knob icon-knob', 'aria-label': 'Thư Mây', 'data-test': 'open-letters', onclick: () => actions.openLetters() }, svgIcon('letter', 38), this.letterBadge);
    const gear = h('button', { class: 'knob icon-knob', 'aria-label': 'Cài đặt', onclick: () => actions.openSettings() }, svgIcon('gear', 36));
    const seeds = (this.seeds = h('button', { class: 'round-big seeds', 'aria-label': 'Hạt giống', 'data-test': 'open-seeds', onclick: () => actions.toggleTray() }, svgIcon('seeds', 62), h('span', { class: 'round-label' }, 'Hạt giống')));
    this.storageButton = h(
      'button',
      { class: 'round-big', 'aria-label': 'Rương Mây', 'data-test': 'open-storage', onclick: () => actions.openStorage() },
      svgIcon('chest', 60),
      h('span', { class: 'round-label' }, 'Rương Mây'),
      this.storageBadge,
    );
    const shop = h('button', { class: 'round-big', 'aria-label': 'Lò Gốm', 'data-test': 'open-shop', onclick: () => actions.openShop() }, svgIcon('kiln', 62), h('span', { class: 'round-label' }, 'Lò Gốm'));
    const side = (label: string, test: string, art: Element, badge: HTMLElement | null, run: () => void) =>
      h('button', { class: 'side-btn', 'aria-label': label, 'data-test': test, onclick: run }, art, h('span', { class: 'side-label' }, label), badge);
    const services = h(
      'div',
      { class: 'hud-side' },
      side('Nhiệm vụ', 'open-missions', svgIcon('missions', 46), this.missionBadge, () => actions.openMissions()),
      side('Đơn hàng', 'open-orders', svgIcon('orders', 46), this.orderBadge, () => actions.openOrders()),
      side('Sạp', 'open-stall', svgIcon('stall', 46), this.stallBadge, () => actions.openStall()),
      side('Phú Bà', 'open-neighbors', svgIcon('crown', 46), null, () => actions.openNeighbors()),
      side('Sổ Tay', 'open-journal', svgIcon('journal', 46), this.journalBadge, () => actions.openJournal()),
    );
    this.eventBtn = h('button', { class: 'side-btn event-btn', 'aria-label': 'Lễ Hội', 'data-test': 'open-event', onclick: () => actions.openEvent() }, svgIcon('moon', 50), h('span', { class: 'side-label' }, 'Lễ Hội'), this.eventTime, this.eventBadge);
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-right' }, this.eventBtn),
      h('div', { class: 'hud-top' }, levelBox, h('div', { class: 'pouches' }, this.pouch, this.gemPouch), letters, gear),
      this.hint,
      services,
      h('div', { class: 'hud-arc' }, seeds, this.storageButton, shop),
    );
  }

  setTrayOpen(on: boolean): void {
    this.seeds.classList.toggle('on', on);
  }

  private bump(el: HTMLElement): void {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  private badge(el: HTMLElement, n: number): void {
    el.textContent = String(n);
    el.classList.toggle('hidden', n <= 0);
  }

  update(): void {
    const { content, state } = this.session;
    const p = state.player;
    const need = xpToNextLevel(content, p.level);
    this.level.textContent = String(p.level);
    this.vineFill.style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
    this.xpText.textContent = `${formatNumber(p.xp)}/${formatNumber(need)}`;
    if (p.coins !== this.last.coins) {
      if (this.last.coins >= 0 && p.coins > this.last.coins) this.bump(this.pouch);
      this.last.coins = p.coins;
      this.coins.textContent = formatNumber(p.coins);
    }
    if (p.gems !== this.last.gems) {
      if (this.last.gems >= 0 && p.gems > this.last.gems) this.bump(this.gemPouch);
      this.last.gems = p.gems;
      this.gems.textContent = formatNumber(p.gems);
    }
    const used = storageUsed(content, state);
    const cap = storageCapacity(content, state);
    this.storageBadge.textContent = `${used}/${cap}`;
    this.storageBadge.classList.toggle('full', used >= cap);
    this.badge(this.orderBadge, state.orders.slots.filter((s) => s.order && canDeliver(state, s.order)).length);
    this.badge(this.stallBadge, state.stall.length);
    this.badge(this.journalBadge, content.cropList.filter((c) => nextMilestone(content, state, c.id)).length);
    this.badge(this.letterBadge, state.notices.filter((n) => !n.read).length);
    this.badge(this.missionBadge, missionsReady(content, state));
    const now = this.session.now();
    const evs = visibleEvents(content, state, now);
    this.eventBtn.classList.toggle('hidden', evs.length === 0);
    if (evs.length > 0) {
      const ev = evs[0]!;
      this.eventTime.textContent = now < ev.end ? formatTimeLeft(ev.end - now) : 'Hết hạn';
      this.badge(this.eventBadge, evs.reduce((n, e) => n + claimableMilestones(state, e), 0));
    }
    const hint = nextHint(content, state, this.session.now());
    this.hint.textContent = hint.text;
    this.hint.dataset.kind = hint.kind;
  }
}
