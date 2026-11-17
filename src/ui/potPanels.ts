// Pot shop ("Lò Gốm Bà Mây") and the floor-opening window, plus shared pot pictures and stats.

import { itemIcon, svgIcon } from './icons.ts';
import { floorItemNeeds } from '../systems/floors.ts';
import type { GameSession } from '../app/session.ts';
import { isSoldInShop, type FloorDef, type PotDef, type PotLevelDef } from '../core/content.ts';
import { atlasData, potFrame } from '../render/assets.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { FAMILY_TEXT, formatNumber, formatPercent, RARITY_MARKS, RARITY_TEXT, STAT_TEXT } from './text.ts';

export interface PotShopActions {
  buyPot(potId: string): void;
  unlockFloor(floorId: string): void;
  openCollection(): void;
  openCasting(): void;
}

const coin = (size = 18) => svgIcon('coin', size + 4);

/** Pot picture: its own art when made, otherwise the terracotta of the same tier ("chờ đồ họa"). */
export function potIcon(def: PotDef, level: number, size: number): HTMLElement {
  const frame = potFrame(def, level);
  const img = icon(frame ?? 'pots/terracotta/0', size);
  // Stand-in colour per line until its own picture exists (chờ đồ họa).
  if (!frame) img.classList.add('pot-standin', `tint-${def.rarity}`);
  return h('span', { class: `pot-ring ${def.rarity}` }, img);
}

export function rarityChip(rarity: string): HTMLElement {
  const marks = Array.from({ length: RARITY_MARKS[rarity] ?? 0 }, () => h('i', {}));
  return h('span', { class: `rarity ${rarity}` }, RARITY_TEXT[rarity] ?? rarity, ...marks);
}

export function statLines(level: PotLevelDef): HTMLElement {
  const lines = Object.entries(level.stats)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => h('span', {}, `${STAT_TEXT[k] ?? k} +${formatPercent(v ?? 0)}`));
  return h('span', { class: 'stat-list' }, ...lines);
}

export function favText(def: PotDef): HTMLElement | null {
  return def.favoredFamily ? h('span', { class: 'fav' }, `Ưa cây ${FAMILY_TEXT[def.favoredFamily] ?? def.favoredFamily}: chỉ số mạnh hơn`) : null;
}

/** "Lò Gốm Bà Mây": every pot type on a wooden shelf; locked ones under cloth. */
/** Shop tab for pots that have no theme. */
const BASIC_THEME = 'Cơ bản';

export class PotShopPanel extends Panel {
  private theme = BASIC_THEME;

  constructor(
    private readonly session: GameSession,
    private readonly actions: PotShopActions,
  ) {
    super('Lò Gốm Bà Mây', 'pot-shop', 'win-seed');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const owned = (id: string) => Object.values(state.pots).filter((p) => p.potId === id).length;
    this.body.append(h('div', { class: 'book-head' }, h('span', { class: 'lead' }, `Chậu mua về nằm trong kho chậu (${state.potStock.length}). Chạm vào chậu trống trên tầng để đặt.`), h('button', { class: 'candy small gold', 'data-test': 'open-collection', onclick: () => this.actions.openCollection() }, 'Bộ Sưu Tập Chậu'), state.player.level >= (content.casting?.unlockLevel ?? Infinity) && h('button', { class: 'candy small gold', 'data-test': 'open-casting', onclick: () => this.actions.openCasting() }, 'Đúc Chậu')));
    // Directive 04: shop groups. Pots without a theme are the classic kiln line ("Cơ bản").
    const sold = content.potList.filter(isSoldInShop);
    const themes = [...new Set(sold.map((d) => d.theme ?? BASIC_THEME))];
    if (!themes.includes(this.theme)) this.theme = themes[0] ?? BASIC_THEME;
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    themes.forEach((t, i) =>
      tabs.append(
        h('button', { class: `tab${this.theme === t ? ' on' : ''}`, role: 'tab', 'aria-selected': this.theme === t ? 'true' : 'false', 'data-test': `shop-tab-${i}`, onclick: () => ((this.theme = t), this.render()) }, `${t} (${sold.filter((d) => (d.theme ?? BASIC_THEME) === t).length})`),
      ),
    );
    this.body.append(h('div', { class: 'filters' }, tabs));
    const shelf = h('div', { class: 'shelf' });
    for (const def of sold) {
      if ((def.theme ?? BASIC_THEME) !== this.theme) continue;
      const locked = def.unlockLevel > state.player.level;
      const poor = def.price > state.player.coins;
      shelf.append(
        h(
          'button',
          {
            class: `seed-pack${locked ? ' locked' : ''}${poor && !locked ? ' poor' : ''}`,
            'data-test': `buy-${def.id}`,
            'aria-disabled': locked ? 'true' : undefined,
            onclick: () => {
              if (!locked) this.actions.buyPot(def.id);
            },
          },
          potIcon(def, def.openTo, 64), // REVIEW 02 #5: best look the line can reach in this build
          h('span', { class: 'pack-name' }, def.name.vi),
          rarityChip(def.rarity),
          statLines(def.levels[0]!),
          h('span', { class: 'pack-info' }, `${def.openTo < def.levels.length ? `Mở tới cấp ${def.openTo}/${def.levels.length}` : `Tối đa cấp ${def.levels.length}`} · đang có ${owned(def.id)}`),
          h('span', { class: 'tag' }, coin(), formatNumber(def.price)),
          locked && h('span', { class: 'cloth' }, `Mở ở cấp ${def.unlockLevel}`),
        ),
      );
    }
    this.body.append(shelf);
  }
}

/** Opening the next cloud floor. */
export class FloorPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly def: FloorDef,
    private readonly actions: PotShopActions,
  ) {
    super('Mở Tầng Mây Mới', 'floor-panel', 'win-confirm');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { player } = this.session.state;
    const d = this.def;
    const night = d.nightSpeed ? `Ban đêm cây lớn nhanh hơn ${formatPercent(d.nightSpeed)}${d.bugBoost ? ', bọ đêm ghé nhiều hơn' : ''}` : null;
    const trait = night ?? (d.trait ? `${FAMILY_TEXT[d.trait.family] ?? d.trait.family} trồng ở đây: ${STAT_TEXT[d.trait.stat] ?? d.trait.stat} +${formatPercent(d.trait.value)}` : 'Tầng thường, chưa có đặc tính riêng');
    const items = floorItemNeeds(d, this.session.state.inventory);
    const short: string[] = [];
    if (player.level < d.unlockLevel) short.push(`cần cấp ${d.unlockLevel}`);
    if (player.coins < d.unlockCost) short.push(`thiếu ${formatNumber(d.unlockCost - player.coins)} xu`);
    for (const n of items) if (n.have < n.need) short.push(`thiếu ${n.need - n.have} ${this.session.content.items.get(n.itemId)?.name.vi ?? ''}`);
    const ok = short.length === 0;
    const btn = h('button', { class: `candy ${ok ? 'primary' : 'blocked'}`, 'data-test': 'unlock-floor', onclick: () => (ok ? this.actions.unlockFloor(d.id) : shake(btn)) }, 'Mở tầng');
    this.body.append(
      h('p', { class: 'lead' }, d.name.vi),
      h('div', { class: 'trait' }, trait),
      h('p', { class: 'note' }, `${d.slotCount} vị trí chậu, có sẵn chậu đất nung.`),
      h('div', { class: 'needs' }, h('span', { class: `need${player.coins < d.unlockCost ? ' short' : ''}` }, coin(22), formatNumber(d.unlockCost)), h('span', { class: `need${player.level < d.unlockLevel ? ' short' : ''}` }, `Cấp ${d.unlockLevel}`), ...items.map((n) => h('span', { class: `need${n.have < n.need ? ' short' : ''}` }, itemIcon(this.session.content, n.itemId, 26), `${Math.min(n.have, n.need)}/${n.need}`))),
      h('div', { class: 'candy-wrap' }, btn, h('span', { class: 'reason' }, ok ? '' : `Chưa mở được: ${short.join(', ')}`)),
    );
  }
}

export function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}
