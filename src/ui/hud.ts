// Always-visible HUD (DESIGN_SYSTEM 6.3): flower level badge + vine XP bar and the side shelf of
// garden services (top-left), embroidered coin and gem pouches (top-centre), letters and gear
// (top-right), main buttons in a thumb arc (bottom-right). Under 15% of the screen.

import type { GameSession } from '../app/session.ts';
import { storageUsed, xpToNextLevel } from '../systems/economy.ts';
import { canDeliver } from '../systems/orders.ts';
import { nextMilestone } from '../systems/surprises.ts';
import { missionsReady } from '../systems/missions.ts';
import { itemFrame } from '../render/assets.ts';
import { h, icon } from './dom.ts';
import { nextHint } from './hint.ts';
import { formatNumber } from './text.ts';

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
  private readonly seeds: HTMLElement;
  private last = { coins: -1, gems: -1 };
  /** Screen position of the storage button, where harvested produce flies to. */
  readonly storageButton: HTMLElement;

  constructor(
    private readonly session: GameSession,
    actions: HudActions,
  ) {
    const { content } = session;
    this.pouch = h('div', { class: 'plaque pouch', 'data-test': 'coins' }, h('span', { class: 'ico-coin', style: 'width:30px;height:30px' }), this.coins);
    this.gemPouch = h('div', { class: 'plaque pouch gems', 'data-test': 'gems' }, h('span', { class: 'ico-gem', style: 'width:26px;height:26px' }), this.gems);
    const levelBox = h('div', { class: 'plaque' }, this.level, h('span', { class: 'vine' }, this.vineFill, this.xpText));
    const letters = h('button', { class: 'knob letter-knob', 'aria-label': 'Thư Mây', 'data-test': 'open-letters', onclick: () => actions.openLetters() }, this.letterBadge);
    const gear = h('button', { class: 'knob gear', 'aria-label': 'Cài đặt', onclick: () => actions.openSettings() });
    const firstCrop = content.cropList[0]!;
    const seeds = (this.seeds = h('button', { class: 'round-big seeds', 'aria-label': 'Hạt giống', 'data-test': 'open-seeds', onclick: () => actions.toggleTray() }, icon(`${firstCrop.sprite}/${firstCrop.stages - 1}`, 56), h('span', { class: 'round-label' }, 'Hạt giống')));
    this.storageButton = h(
      'button',
      { class: 'round-big', 'aria-label': 'Rương Mây', 'data-test': 'open-storage', onclick: () => actions.openStorage() },
      icon(itemFrame(content, content.cropList[1]?.produce.id ?? ''), 52),
      h('span', { class: 'round-label' }, 'Rương Mây'),
      this.storageBadge,
    );
    const shop = h('button', { class: 'round-big', 'aria-label': 'Lò Gốm', 'data-test': 'open-shop', onclick: () => actions.openShop() }, icon('pots/terracotta/5', 58), h('span', { class: 'round-label' }, 'Lò Gốm'));
    const side = (label: string, test: string, art: HTMLElement, badge: HTMLElement | null, run: () => void) =>
      h('button', { class: 'side-btn', 'aria-label': label, 'data-test': test, onclick: run }, art, h('span', { class: 'side-label' }, label), badge);
    const services = h(
      'div',
      { class: 'hud-side' },
      side('Nhiệm vụ', 'open-missions', h('span', { class: 'scroll-mini' }), this.missionBadge, () => actions.openMissions()),
      side('Đơn hàng', 'open-orders', h('span', { class: 'balloon-mini' }), this.orderBadge, () => actions.openOrders()),
      side('Sạp', 'open-stall', icon(itemFrame(content, content.cropList[4]?.produce.id ?? ''), 40), this.stallBadge, () => actions.openStall()),
      side('Phú Bà', 'open-neighbors', h('span', { class: 'crown' }), null, () => actions.openNeighbors()),
      side('Sổ Tay', 'open-journal', h('span', { class: 'book' }), this.journalBadge, () => actions.openJournal()),
    );
    this.el = h(
      'div',
      { class: 'hud' },
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
    const maxed = p.level >= content.config.levels.maxLevel;
    this.level.textContent = String(p.level);
    this.vineFill.style.width = maxed ? '100%' : `${Math.min(100, (p.xp / need) * 100)}%`;
    this.xpText.textContent = maxed ? 'Tối đa' : `${formatNumber(p.xp)}/${formatNumber(need)}`;
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
    this.storageBadge.textContent = `${used}/${content.config.storageCapacity}`;
    this.storageBadge.classList.toggle('full', used >= content.config.storageCapacity);
    this.badge(this.orderBadge, state.orders.slots.filter((s) => s.order && canDeliver(state, s.order)).length);
    this.badge(this.stallBadge, state.stall.length);
    this.badge(this.journalBadge, content.cropList.filter((c) => nextMilestone(content, state, c.id)).length);
    this.badge(this.letterBadge, state.notices.filter((n) => !n.read).length);
    this.badge(this.missionBadge, missionsReady(content, state));
    const hint = nextHint(content, state, this.session.now());
    this.hint.textContent = hint.text;
    this.hint.dataset.kind = hint.kind;
  }
}
