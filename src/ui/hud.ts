// Always-visible HUD: level + XP, coins, next-action hint, Kho and Cài đặt buttons.
// Takes under 15% of the screen (ART_STYLE_GUIDE 8).

import type { GameSession } from '../app/session.ts';
import { storageUsed, xpToNextLevel } from '../systems/economy.ts';
import { h, icon } from './dom.ts';
import { nextHint } from './hint.ts';
import { formatNumber } from './text.ts';

export class Hud {
  readonly el: HTMLElement;
  private readonly level = h('span', { class: 'level-num' });
  private readonly xpFill = h('span', { class: 'xp-fill' });
  private readonly xpText = h('span', { class: 'xp-text' });
  private readonly coins = h('span', { class: 'coin-num' });
  private readonly hint = h('div', { class: 'hint', role: 'status' });
  private readonly storageBadge = h('span', { class: 'badge' });
  private lastCoins = -1;

  constructor(
    private readonly session: GameSession,
    actions: { openStorage(): void; openSettings(): void },
  ) {
    const levelBox = h(
      'div',
      { class: 'pill level-pill' },
      h('span', { class: 'level-badge' }, icon('icons/xp', 34), this.level),
      h('span', { class: 'xp-bar' }, this.xpFill, this.xpText),
    );
    const coinBox = h('div', { class: 'pill coin-pill', 'data-test': 'coins' }, icon('icons/coin', 34), this.coins);
    const settingsBtn = h('button', { class: 'round-btn settings-btn', 'aria-label': 'Cài đặt', onclick: () => actions.openSettings() }, h('span', { class: 'gear' }, '⚙︎'));
    const storageBtn = h(
      'button',
      { class: 'big-btn storage-btn', 'aria-label': 'Kho', 'data-test': 'open-storage', onclick: () => actions.openStorage() },
      icon('icons/storage', 54),
      h('span', { class: 'big-btn-label' }, 'Kho'),
      this.storageBadge,
    );
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-top' }, levelBox, coinBox, settingsBtn),
      this.hint,
      h('div', { class: 'hud-bottom' }, storageBtn),
    );
  }

  update(): void {
    const { content, state } = this.session;
    const p = state.player;
    const need = xpToNextLevel(content, p.level);
    const maxed = p.level >= content.config.levels.maxLevel;
    this.level.textContent = String(p.level);
    this.xpFill.style.width = maxed ? '100%' : `${Math.min(100, (p.xp / need) * 100)}%`;
    this.xpText.textContent = maxed ? 'Tối đa' : `${formatNumber(p.xp)}/${formatNumber(need)}`;
    if (p.coins !== this.lastCoins) {
      if (this.lastCoins >= 0 && p.coins > this.lastCoins) {
        this.coins.parentElement?.classList.remove('bump');
        void this.coins.parentElement?.offsetWidth;
        this.coins.parentElement?.classList.add('bump');
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
