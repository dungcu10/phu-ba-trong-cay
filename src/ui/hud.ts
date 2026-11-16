// Always-visible HUD (DESIGN_SYSTEM 6.3): flower level badge + vine XP bar (top-left),
// embroidered coin pouch (top-centre), gear (top-right), main buttons in a thumb arc
// (bottom-right). Under 15% of the screen.

import type { GameSession } from '../app/session.ts';
import { storageUsed, xpToNextLevel } from '../systems/economy.ts';
import { h, icon } from './dom.ts';
import { nextHint } from './hint.ts';
import { formatNumber } from './text.ts';

export class Hud {
  readonly el: HTMLElement;
  private readonly level = h('span', { class: 'flower', 'data-test': 'level' });
  private readonly vineFill = h('span', { class: 'vine-fill' });
  private readonly xpText = h('span', { class: 'xp-text' });
  private readonly coins = h('span', {});
  private readonly pouch: HTMLElement;
  private readonly hint = h('div', { class: 'hint', role: 'status' });
  private readonly storageBadge = h('span', { class: 'badge' });
  private lastCoins = -1;

  constructor(
    private readonly session: GameSession,
    actions: { openSeeds(): void; openStorage(): void; openSettings(): void },
  ) {
    this.pouch = h('div', { class: 'plaque pouch', 'data-test': 'coins' }, h('span', { class: 'ico-coin', style: 'width:30px;height:30px' }), this.coins);
    const levelBox = h('div', { class: 'plaque' }, this.level, h('span', { class: 'vine' }, this.vineFill, this.xpText));
    const gear = h('button', { class: 'knob gear', 'aria-label': 'Cài đặt', onclick: () => actions.openSettings() });
    const seedFrame = session.content.cropList[0]!;
    const seeds = h(
      'button',
      { class: 'round-big seeds', 'aria-label': 'Hạt giống', 'data-test': 'open-seeds', onclick: () => actions.openSeeds() },
      icon(`${seedFrame.sprite}/${seedFrame.stages - 1}`, 56),
      h('span', { class: 'round-label' }, 'Hạt giống'),
    );
    const storage = h(
      'button',
      { class: 'round-big', 'aria-label': 'Kho', 'data-test': 'open-storage', onclick: () => actions.openStorage() },
      icon('items/cherry-tomato', 52),
      h('span', { class: 'round-label' }, 'Rương Mây'),
      this.storageBadge,
    );
    this.el = h('div', { class: 'hud' }, h('div', { class: 'hud-top' }, levelBox, this.pouch, gear), this.hint, h('div', { class: 'hud-arc' }, seeds, storage));
  }

  update(): void {
    const { content, state } = this.session;
    const p = state.player;
    const need = xpToNextLevel(content, p.level);
    const maxed = p.level >= content.config.levels.maxLevel;
    this.level.textContent = String(p.level);
    this.vineFill.style.width = maxed ? '100%' : `${Math.min(100, (p.xp / need) * 100)}%`;
    this.xpText.textContent = maxed ? 'Tối đa' : `${formatNumber(p.xp)}/${formatNumber(need)}`;
    if (p.coins !== this.lastCoins) {
      if (this.lastCoins >= 0 && p.coins > this.lastCoins) {
        this.pouch.classList.remove('bump');
        void this.pouch.offsetWidth;
        this.pouch.classList.add('bump');
      }
      this.lastCoins = p.coins;
      this.coins.textContent = formatNumber(p.coins);
    }
    const used = storageUsed(content, state);
    this.storageBadge.textContent = `${used}/${content.config.storageCapacity}`;
    this.storageBadge.classList.toggle('full', used >= content.config.storageCapacity);
    const hint = nextHint(content, state, this.session.now());
    this.hint.textContent = hint.text;
    this.hint.dataset.kind = hint.kind;
  }
}
