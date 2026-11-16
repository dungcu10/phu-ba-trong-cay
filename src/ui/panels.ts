// Fairy-tale windows (DESIGN_SYSTEM 6.5–6.7): the seed stall, the potter's bench (pot upgrade)
// and the cloud chest (storage + selling). Windows only read state and send commands.

import type { GameSession } from '../app/session.ts';
import type { SlotRef } from '../core/game.ts';
import { itemFrame } from '../render/assets.ts';
import { sellPrice, storageUsed } from '../systems/economy.ts';
import { cropStatus } from '../systems/growth.ts';
import { canAfford, nextUpgradeCost, potLevelDef } from '../systems/pots.ts';
import { clear, h, icon } from './dom.ts';
import { formatDuration, formatNumber, formatPercent } from './text.ts';
import { TOKENS } from './tokens.ts';

export interface PanelActions {
  /** Plants one pot, or every empty pot when slot is null. Returns how many were planted. */
  plant(slot: SlotRef | null, cropId: string): number;
  sell(itemId: string, qty: number): void;
  upgradePot(potInstanceId: string): void;
}

const coin = (size = 22) => h('span', { class: 'ico-coin', style: `width:${size}px;height:${size}px` });

/** A window: dark wood frame, paper face, ribbon title, round close knob. */
export abstract class Panel {
  readonly el: HTMLElement;
  protected readonly body = h('div', { class: 'win-body scroll' });
  onClose: (() => void) | null = null;
  private closed = false;

  constructor(title: string, testId: string, extraClass = '') {
    const close = h('button', { class: 'knob close', 'aria-label': 'Đóng', onclick: () => this.close() });
    const win = h('div', { class: `win ${extraClass}`, role: 'dialog', 'aria-label': title, 'data-test': testId }, h('div', { class: 'ribbon' }, h('h2', {}, title)), close, this.body);
    this.el = h('div', { class: 'veil' }, win);
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  abstract render(): void;

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.el.classList.add('closing');
    setTimeout(() => this.el.remove(), TOKENS.motion.windowClose.ms);
    this.onClose?.();
  }
}

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
    if (!this.slot) this.body.append(h('p', { class: 'note' }, 'Mẹo: kéo tay qua các chậu trống để gieo lại giống vừa chọn.'));
  }
}

/** "Bàn Thợ Gốm": current pot on the left, the upgraded pot glowing on the right. */
export class PotPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly slot: SlotRef,
    private readonly actions: PanelActions,
  ) {
    super('Bàn Thợ Gốm', 'pot-panel');
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
      this.body.append(h('p', { class: 'lead' }, status.ripe ? `${status.crop.name.vi} đã chín — chạm vào chậu để thu hoạch.` : `${status.crop.name.vi} chín sau ${formatDuration(status.remainingMs)}`));
    }
    const statLines = (l: typeof lv) => h('span', { class: 'stats' }, h('span', {}, `Lớn nhanh +${formatPercent(l.stats.speed)}`), h('span', {}, `Sản lượng +${formatPercent(l.stats.yield)}`));
    const cost = nextUpgradeCost(content, pot);
    const current = h('div', { class: 'bench-side' }, icon(`${def.sprite}/${pot.level}`, 120), h('strong', {}, `${def.name.vi} · cấp ${pot.level}`), statLines(lv));
    if (!cost) {
      this.body.append(h('div', { class: 'bench' }, current), h('p', { class: 'note' }, 'Chậu đã đạt cấp cao nhất.'));
      return;
    }
    const next = def.levels[pot.level]!;
    const preview = h('div', { class: 'bench-side preview' }, icon(`${def.sprite}/${pot.level + 1}`, 120), h('strong', {}, `Cấp ${pot.level + 1}`), statLines(next));
    this.body.append(h('div', { class: 'bench' }, current, h('span', { class: 'bench-arrow' }), preview));

    const needs = h('div', { class: 'needs' }, h('span', { class: `need${state.player.coins < cost.coins ? ' short' : ''}` }, coin(), formatNumber(cost.coins)));
    const missing: string[] = [];
    if (state.player.coins < cost.coins) missing.push(`${formatNumber(cost.coins - state.player.coins)} xu`);
    for (const [itemId, qty] of Object.entries(cost.items)) {
      const have = state.inventory[itemId] ?? 0;
      needs.append(h('span', { class: `need${have < qty ? ' short' : ''}` }, icon(itemFrame(content, itemId), 30), `${have}/${qty}`));
      if (have < qty) missing.push(`${qty - have} ${content.items.get(itemId)?.name.vi ?? ''}`);
    }
    const ok = canAfford(state, cost);
    const reason = h('span', { class: 'reason' }, ok ? '' : `Thiếu ${missing.join(' và ')}`);
    const btn = h(
      'button',
      {
        class: `candy ${ok ? 'primary' : 'blocked'}`,
        'data-test': 'upgrade-pot',
        onclick: () => {
          if (ok) this.actions.upgradePot(slotState.potInstanceId);
          else {
            btn.classList.remove('shake');
            void btn.offsetWidth;
            btn.classList.add('shake');
          }
        },
      },
      'Nâng cấp chậu',
    );
    this.body.append(needs, h('div', { class: 'candy-wrap' }, btn, reason));
    if (!ok) this.body.append(h('p', { class: 'note' }, 'Bắt Bọ Mây đậu trên cây để có nguyên liệu nâng cấp. Nâng cấp luôn thành công.'));
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
    const cap = content.config.storageCapacity;
    const used = storageUsed(content, state);
    const baskets = h('span', { class: 'baskets' });
    const per = cap / 10;
    for (let i = 0; i < 10; i++) {
      const fill = Math.max(0, Math.min(1, (used - i * per) / per));
      baskets.append(h('span', { class: `basket${fill >= 1 ? ' full' : fill > 0 ? ' half' : ''}` }));
    }
    this.body.append(h('div', { class: 'cap-row' }, baskets, h('span', { class: 'cap-text' }, `${used}/${cap}`)));

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
          icon(itemFrame(content, itemId), 60),
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
      box.append(h('p', { class: 'note' }, 'Bọ Mây là nguyên liệu nâng cấp chậu ở Bàn Thợ Gốm, không bán được.'));
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
