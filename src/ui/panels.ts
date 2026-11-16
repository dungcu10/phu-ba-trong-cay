// Bottom-sheet panels: choose a seed, look after a pot (upgrade), and the storage/sell panel.

import type { GameSession } from '../app/session.ts';
import type { SlotRef } from '../core/game.ts';
import { itemFrame } from '../render/assets.ts';
import { sellPrice, storageUsed } from '../systems/economy.ts';
import { cropStatus } from '../systems/growth.ts';
import { canAfford, nextUpgradeCost, potLevelDef } from '../systems/pots.ts';
import { clear, h, icon } from './dom.ts';
import { formatDuration, formatNumber, formatPercent } from './text.ts';

export interface PanelActions {
  plant(slot: SlotRef, cropId: string): boolean;
  sell(itemId: string, qty: number): void;
  upgradePot(potInstanceId: string): void;
}

export abstract class Panel {
  readonly el: HTMLElement;
  protected readonly body = h('div', { class: 'sheet-body scroll' });
  onClose: (() => void) | null = null;

  constructor(title: string, testId: string) {
    const close = h('button', { class: 'round-btn close-btn', 'aria-label': 'Đóng', onclick: () => this.close() }, '✕');
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': title, 'data-test': testId }, h('div', { class: 'sheet-head' }, h('h2', {}, title), close), this.body);
    this.el = h('div', { class: 'backdrop' }, sheet);
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  abstract render(): void;

  close(): void {
    this.el.classList.add('closing');
    setTimeout(() => this.el.remove(), 160);
    this.onClose?.();
  }
}

export class SeedPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly slot: SlotRef,
    private readonly actions: PanelActions,
  ) {
    super('Chọn hạt giống', 'seed-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const emptyCount = state.floors.flatMap((f) => f.slots).filter((s) => !s.planting).length;
    const grid = h('div', { class: 'card-grid' });
    for (const crop of content.cropList) {
      const locked = crop.unlockLevel > state.player.level;
      const poor = crop.seedPrice > state.player.coins;
      const seconds = crop.growSeconds;
      const card = h(
        'button',
        {
          class: `card${locked ? ' locked' : ''}${poor && !locked ? ' poor' : ''}`,
          'data-test': `seed-${crop.id}`,
          disabled: locked,
          onclick: () => {
            if (this.actions.plant(this.slot, crop.id)) this.close();
          },
        },
        icon(`${crop.sprite}/${crop.stages - 1}`, 76, 'crops'),
        h('span', { class: 'card-title' }, crop.name.vi),
        locked
          ? h('span', { class: 'card-sub' }, `Mở ở cấp ${crop.unlockLevel}`)
          : h(
              'span',
              { class: 'card-sub' },
              `${formatDuration(seconds * 1000)} · ${crop.harvests > 1 ? `${crop.harvests} lần thu` : '1 lần thu'}`,
            ),
        !locked && h('span', { class: 'price' }, icon('icons/coin', 22), formatNumber(crop.seedPrice)),
      );
      grid.append(card);
    }
    this.body.append(grid);
    if (emptyCount > 1) {
      this.body.append(h('p', { class: 'note' }, `Mẹo: kéo tay qua các chậu trống để gieo lại giống vừa chọn. Có ${emptyCount} chậu trống.`));
    }
  }
}

export class PotPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly slot: SlotRef,
    private readonly actions: PanelActions,
  ) {
    super(`Chậu số ${slot.slot + 1}`, 'pot-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const slotState = state.floors[this.slot.floor]!.slots[this.slot.slot]!;
    const pot = state.pots[slotState.potInstanceId]!;
    const def = content.pots.get(pot.potId)!;
    const lv = potLevelDef(content, pot);
    const status = cropStatus(content, state, slotState, this.session.now());

    if (status) {
      const line = status.ripe ? 'Đã chín — chạm vào chậu để thu hoạch.' : `${status.crop.name.vi}: chín sau ${formatDuration(status.remainingMs)}.`;
      this.body.append(h('p', { class: 'lead' }, line));
    }

    const stats = h(
      'div',
      { class: 'pot-row' },
      icon(`${def.sprite}/${pot.level}`, 96),
      h(
        'div',
        { class: 'pot-info' },
        h('div', { class: 'card-title' }, `${def.name.vi} · cấp ${pot.level}/${def.levels.length}`),
        h('div', { class: 'stat' }, `Tốc độ lớn: +${formatPercent(lv.stats.speed)}`),
        h('div', { class: 'stat' }, `Sản lượng: +${formatPercent(lv.stats.yield)}`),
      ),
    );
    this.body.append(stats);

    const cost = nextUpgradeCost(content, pot);
    if (!cost) {
      this.body.append(h('p', { class: 'note' }, 'Chậu đã đạt cấp tối đa.'));
      return;
    }
    const next = def.levels[pot.level]!;
    const needs = h('div', { class: 'cost-row' }, h('span', { class: 'price' }, icon('icons/coin', 24), formatNumber(cost.coins)));
    for (const [itemId, qty] of Object.entries(cost.items)) {
      const have = state.inventory[itemId] ?? 0;
      needs.append(h('span', { class: `price${have < qty ? ' short' : ''}` }, icon(itemFrame(content, itemId), 28), `${have}/${qty}`));
    }
    const affordable = canAfford(state, cost);
    this.body.append(
      h('p', { class: 'note' }, `Lên cấp ${pot.level + 1}: tốc độ +${formatPercent(next.stats.speed)}, sản lượng +${formatPercent(next.stats.yield)}.`),
      needs,
      h(
        'button',
        { class: 'primary-btn', 'data-test': 'upgrade-pot', disabled: !affordable, onclick: () => this.actions.upgradePot(slotState.potInstanceId) },
        affordable ? 'Nâng cấp chậu' : 'Chưa đủ xu hoặc Bọ Mây',
      ),
    );
    if (!affordable) this.body.append(h('p', { class: 'note' }, 'Bắt Bọ Mây đậu trên cây để có nguyên liệu nâng cấp.'));
  }
}

export class StoragePanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: PanelActions,
  ) {
    super('Kho', 'storage-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    const used = storageUsed(content, state);
    this.body.append(h('p', { class: 'lead' }, `Đã dùng ${used}/${content.config.storageCapacity} chỗ. Giá bán đổi nhẹ mỗi ngày.`));
    const entries = Object.entries(state.inventory).filter(([, q]) => q > 0);
    if (entries.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Kho đang trống. Thu hoạch cây chín để có nông sản bán.'));
      return;
    }
    const list = h('div', { class: 'item-list' });
    for (const [itemId, qty] of entries) {
      const item = content.items.get(itemId);
      if (!item) continue;
      const price = sellPrice(content, state, itemId, now);
      const row = h(
        'div',
        { class: 'item-row', 'data-test': `item-${itemId}` },
        icon(itemFrame(content, itemId), 56),
        h('div', { class: 'item-info' }, h('div', { class: 'card-title' }, `${item.name.vi} ×${qty}`), h('div', { class: 'stat' }, price === null ? 'Dùng để nâng cấp chậu' : `${formatNumber(price)} xu mỗi cái`)),
      );
      if (price !== null) {
        row.append(
          h('button', { class: 'small-btn', onclick: () => this.actions.sell(itemId, 1) }, 'Bán 1'),
          h('button', { class: 'small-btn gold', 'data-test': `sell-all-${itemId}`, onclick: () => this.actions.sell(itemId, qty) }, `Bán hết · ${formatNumber(price * qty)}`),
        );
      }
      list.append(row);
    }
    this.body.append(list);
  }
}
