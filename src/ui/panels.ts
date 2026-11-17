// Fairy-tale windows (DESIGN_SYSTEM 6.5–6.7): the seed stall, the potter's bench (pot upgrade)
// and the cloud chest (storage + selling). Windows only read state and send commands.

import { itemIcon } from './icons.ts';
import { svgIcon } from './icons.ts';
import type { GameSession } from '../app/session.ts';
import type { SlotRef } from '../core/game.ts';
import { itemFrame } from '../render/assets.ts';
import { sellPrice, storageCapacity, storageUpgradeCost, storageUsed } from '../systems/economy.ts';
import { cropStatus } from '../systems/growth.ts';
import { canAfford, nextUpgradeCost, potLevelDef } from '../systems/pots.ts';
export { Panel } from './panel.ts';
import { clear, h, icon } from './dom.ts';
import { formatDuration, formatNumber, formatPercent } from './text.ts';
import { Panel } from './panel.ts';
import { potIcon, favText, statLines, rarityChip, shake } from './potPanels.ts';

export interface PanelActions {
  /** Plants one pot, or every empty pot when slot is null. Returns how many were planted. */
  plant(slot: SlotRef | null, cropId: string): number;
  sell(itemId: string, qty: number): void;
  upgradePot(potInstanceId: string): void;
  placePot(slot: SlotRef, potInstanceId: string): void;
  openBench(slot: SlotRef): void;
  upgradeStorage(): void;
}

const coin = (size = 22) => svgIcon('coin', size + 4);

/** "Sạp Hạt Giống Bà Mây": seed packets on a wooden shelf; locked ones are under cloth. */
export class SeedPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    /** null = opened from the HUD: the chosen seed is planted in every empty pot. */
    private readonly slot: SlotRef | null,
    private readonly actions: PanelActions,
  ) {
    super('Sạp Hạt Giống Bà Mây', 'seed-panel', 'win-seed');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const empty = state.floors.flatMap((f) => f.slots).filter((s) => !s.planting).length;
    this.body.append(h('p', { class: 'lead' }, this.slot ? `Gieo vào chậu số ${this.slot.slot + 1}` : empty > 0 ? `Gieo cả tầng: ${empty} chậu trống` : 'Tầng này không còn chậu trống'));
    const shelf = h('div', { class: 'shelf' });
    for (const crop of content.cropList) {
      const locked = crop.unlockLevel > state.player.level;
      const poor = crop.seedPrice > state.player.coins;
      const pack = h(
        'button',
        {
          class: `seed-pack${locked ? ' locked' : ''}${poor && !locked ? ' poor' : ''}`,
          'data-test': `seed-${crop.id}`,
          'aria-disabled': locked ? 'true' : undefined,
          onclick: () => {
            if (locked) return;
            if (this.actions.plant(this.slot, crop.id) > 0) this.close();
          },
        },
        icon(`${crop.sprite}/${crop.stages - 1}`, 64),
        h('span', { class: 'pack-name' }, crop.name.vi),
        h('span', { class: 'pack-info' }, `${formatDuration(crop.growSeconds * 1000)} · ${crop.harvests > 1 ? `thu ${crop.harvests} lần` : 'thu 1 lần'}`),
        h('span', { class: 'tag' }, coin(18), crop.seedPrice === 0 ? 'Miễn phí' : formatNumber(crop.seedPrice)),
        locked && h('span', { class: 'cloth' }, `Mở ở cấp ${crop.unlockLevel}`),
      );
      shelf.append(pack);
    }
    this.body.append(shelf);
    const slot = this.slot;
    if (slot && state.potStock.length > 0) {
      this.body.append(h('div', { class: 'candy-wrap' }, h('button', { class: 'candy gold', 'data-test': 'swap-pot', onclick: () => this.actions.openBench(slot) }, `Đổi chậu (${state.potStock.length} trong kho)`)));
    }
    if (!this.slot) this.body.append(h('p', { class: 'note' }, 'Mẹo: kéo tay qua các chậu trống để gieo lại giống vừa chọn.'));
  }
}

/** "Rương Mây": velvet compartments, capacity as a row of baskets, a scale to sell. */
export class StoragePanel extends Panel {
  private selected: string | null = null;
  private qty = 0;

  constructor(
    private readonly session: GameSession,
    private readonly actions: PanelActions,
  ) {
    super('Rương Mây', 'storage-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const cap = storageCapacity(content, state);
    const used = storageUsed(content, state);
    const baskets = h('span', { class: 'baskets' });
    const per = cap / 10;
    for (let i = 0; i < 10; i++) {
      const fill = Math.max(0, Math.min(1, (used - i * per) / per));
      baskets.append(h('span', { class: `basket${fill >= 1 ? ' full' : fill > 0 ? ' half' : ''}` }));
    }
    // Rương Mây upgrade (nâng cấp v3 đợt 1): always one more tier, each dearer.
    const upCost = storageUpgradeCost(content, state);
    const canUp = state.player.coins >= upCost;
    const upBtn = h(
      'button',
      { class: `candy small ${canUp ? 'primary' : 'blocked'}`, 'data-test': 'upgrade-storage', onclick: () => (canUp ? this.actions.upgradeStorage() : shake(upBtn)) },
      `Nâng rương +${content.config.storageUpgrade.perTier} ô · `,
      coin(18),
      formatNumber(upCost),
    );
    this.body.append(h('div', { class: 'cap-row' }, baskets, h('span', { class: 'cap-text' }, `${used}/${cap}`), upBtn));

    const entries = Object.entries(state.inventory).filter(([, q]) => q > 0);
    if (entries.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Rương đang trống. Thu hoạch cây chín để có nông sản.'));
      return;
    }
    const sellable = entries.filter(([id]) => content.items.get(id)?.sellPrice != null);
    if (!this.selected || !(state.inventory[this.selected]! > 0)) {
      this.selected = (sellable[0] ?? entries[0])![0];
      this.qty = state.inventory[this.selected] ?? 0;
    }
    this.qty = Math.min(Math.max(1, this.qty), state.inventory[this.selected]!);

    const grid = h('div', { class: 'compartments' });
    for (const [itemId, count] of entries) {
      grid.append(
        h(
          'button',
          {
            class: `cell${itemId === this.selected ? ' on' : ''}`,
            'data-test': `item-${itemId}`,
            'aria-label': content.items.get(itemId)?.name.vi ?? itemId,
            onclick: () => {
              this.selected = itemId;
              this.qty = count;
              this.render();
            },
          },
          itemIcon(content, itemId, 60),
          h('span', { class: 'count' }, String(count)),
        ),
      );
    }
    this.body.append(grid);
    this.body.append(this.scale());
  }

  private scale(): HTMLElement {
    const { content, state } = this.session;
    const id = this.selected!;
    const item = content.items.get(id)!;
    const have = state.inventory[id] ?? 0;
    const price = sellPrice(content, state, id, this.session.now());
    const box = h('div', { class: 'scale' }, h('div', { class: 'pack-name' }, `${item.name.vi} ×${have}`));
    if (price === null) {
      // Materials say what they are for (materials.json desc); bugs are pot-upgrade material.
      const desc = content.materials.get(id)?.desc?.vi ?? (content.bugs.has(id) ? `${item.name.vi} là nguyên liệu nâng cấp chậu ở Lò Gốm.` : null);
      box.append(h('p', { class: 'note' }, `${desc ?? 'Vật phẩm dùng trong game.'} Không bán được.`));
      return box;
    }
    const qtyEl = h('span', { class: 'qty' }, String(this.qty));
    const total = h('span', { class: 'total' }, coin(), formatNumber(price * this.qty));
    const slider = h('input', { class: 'slider', type: 'range', min: 1, max: have, value: this.qty, 'aria-label': 'Số lượng bán' });
    slider.addEventListener('input', () => {
      this.qty = Number(slider.value);
      qtyEl.textContent = String(this.qty);
      total.replaceChildren(coin(), formatNumber(price * this.qty));
    });
    box.append(
      h('div', { class: 'scale-row' }, qtyEl, slider, total),
      h('p', { class: 'note' }, `${formatNumber(price)} xu mỗi cái hôm nay (giá đổi nhẹ mỗi ngày)`),
      h('div', { class: 'candy-wrap' }, h('button', { class: 'candy gold', 'data-test': `sell-${id}`, onclick: () => this.actions.sell(id, this.qty) }, 'Bán')),
    );
    return box;
  }
}
