// Chỉ thị 10 § 3.8: "Đúc Chậu" window (opened from the Lò Gốm; chỉ thị 11: the village kiln calls the
// same openCasting()). Lists the crafted pots the player can cast, by rarity; the chosen pot shows its
// recipe clearly: every ingredient with have/need and where to get it, the coins, the 10% "Hoàn Mỹ".

import type { GameSession } from '../app/session.ts';
import { castablePots, castRecipe } from '../systems/casting.ts';
import { itemIcon } from './icons.ts';
import { clear, h } from './dom.ts';
import { Panel } from './panel.ts';
import { potIcon, rarityChip, shake } from './potPanels.ts';
import { formatNumber, RARITY_TEXT } from './text.ts';
import { coin } from './worldPanels.ts';

export interface CastingActions {
  castPot(potId: string): void;
}

const ORDER = ['rare', 'epic', 'legendary'];

export class CastingPanel extends Panel {
  private selected: string | null = null;
  private rarity = 'rare';

  constructor(
    private readonly session: GameSession,
    private readonly actions: CastingActions,
  ) {
    super('Đúc Chậu', 'casting-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const rules = content.casting;
    if (!rules) return;
    if (state.player.level < rules.unlockLevel) {
      this.body.append(h('p', { class: 'lead' }, `Đúc chậu mở ở cấp ${rules.unlockLevel}.`));
      return;
    }
    const pots = content.potList.filter((p) => p.group === 'crafted' && castRecipe(content, p));
    const open = new Set(castablePots(content, state.player.level).map((p) => p.id));
    const tabs = h(
      'div',
      { class: 'tabs' },
      ...ORDER.filter((r) => pots.some((p) => p.rarity === r)).map((r) => h('button', { class: `chip${this.rarity === r ? ' on' : ''}`, onclick: () => ((this.rarity = r), (this.selected = null), this.render()) }, RARITY_TEXT[r] ?? r)),
    );
    const grid = h('div', { class: 'journal casting-grid' });
    const list = pots.filter((p) => p.rarity === this.rarity);
    if (!this.selected || !list.some((p) => p.id === this.selected)) this.selected = list.find((p) => open.has(p.id))?.id ?? list[0]?.id ?? null;
    for (const p of list) {
      const owned = Object.values(state.pots).filter((x) => x.potId === p.id).length;
      grid.append(
        h(
          'button',
          { class: `page cast-pot${this.selected === p.id ? ' on' : ''}${open.has(p.id) ? '' : ' unknown'}`, 'data-test': `cast-${p.id}`, onclick: () => ((this.selected = p.id), this.render()) },
          potIcon(p, 1, 60),
          h('span', { class: 'pack-info' }, p.name.vi),
          h('span', { class: 'pack-info' }, open.has(p.id) ? (owned > 0 ? `Đang có ${owned}` : 'Chưa có') : `Mở ở cấp ${p.unlockLevel}`),
        ),
      );
    }
    const box = h('div', { class: 'scale cast-recipe' });
    const def = this.selected ? content.pots.get(this.selected) : undefined;
    const recipe = def ? castRecipe(content, def) : null;
    if (def && recipe) {
      const needs = Object.entries(recipe.items).map(([id, q]) => {
        const have = state.inventory[id] ?? 0;
        return h(
          'div',
          { class: `cast-need${have >= q ? ' done' : ''}` },
          itemIcon(content, id, 34),
          h('strong', {}, `${content.items.get(id)?.name.vi ?? id} ${Math.min(have, q)}/${q}`),
          have < q && h('span', { class: 'pack-info' }, `Thiếu ${q - have} · ${rules.sources[id] ?? ''}`),
        );
      });
      const short = Object.entries(recipe.items).some(([id, q]) => (state.inventory[id] ?? 0) < q) || state.player.coins < recipe.coins || !open.has(def.id);
      const btn = h('button', { class: `candy ${short ? 'blocked' : 'gold'}`, 'data-test': 'cast-go', onclick: () => (short ? shake(btn) : this.actions.castPot(def.id)) }, coin(18), `${formatNumber(recipe.coins)} · Đúc chậu`);
      box.append(
        h('div', { class: 'pack-name' }, potIcon(def, 1, 48), def.name.vi, rarityChip(def.rarity)),
        ...needs,
        h('p', { class: 'note' }, `${Math.round(rules.perfectChance * 100)}% ra chậu Hoàn Mỹ: thêm ${rules.perfectStars} sao, mọi chỉ số cao hơn ${Math.round(rules.starStatBonus * 100 * rules.perfectStars)}%.`),
        h('div', { class: 'candy-wrap' }, btn),
      );
    }
    this.body.append(h('p', { class: 'lead' }, 'Đúc chậu hiếm từ khoáng sản, Ngọc Mây và xu. Khoáng càng hiếm thì chậu càng hiếm.'), tabs, h('div', { class: 'cast-layout' }, grid, box));
  }
}
