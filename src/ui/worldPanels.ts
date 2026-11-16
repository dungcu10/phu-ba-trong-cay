// Windows for orders, the stall, neighbours, the plant journal and letters (DESIGN_SYSTEM 6).
// They only read state and send commands through the actions interface.

import type { GameSession } from '../app/session.ts';
import { canDeliver } from '../systems/orders.ts';
import { botWealth, playerWealth, valuation } from '../systems/neighbors.ts';
import { nextMilestone } from '../systems/surprises.ts';
import { sellPrice } from '../systems/economy.ts';
import { itemFrame } from '../render/assets.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { formatDuration, formatNumber, FAMILY_TEXT } from './text.ts';

export interface WorldActions {
  deliverOrder(slot: number): void;
  skipOrder(slot: number): void;
  rushOrder(slot: number): void;
  listItem(itemId: string, qty: number, price: number): void;
  cancelListing(id: number): void;
  claimJournal(cropId: string): void;
}

export const coin = (size = 20) => h('span', { class: 'ico-coin', style: `width:${size}px;height:${size}px` });
export const gem = (size = 20) => h('span', { class: 'ico-gem', style: `width:${size}px;height:${size}px` });
export const star = (size = 20) => h('span', { class: 'ico-star', style: `width:${size}px;height:${size}px` });

function botName(session: GameSession, id: string): string {
  return session.content.bots.get(id)?.name.vi ?? 'Khách lạ';
}

/** "Bảng Đơn Khinh Khí Cầu": six parchment notes pinned on a wooden board. */
export class OrdersPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: WorldActions,
  ) {
    super('Bảng Đơn Khinh Khí Cầu', 'orders-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    const board = h('div', { class: 'board' });
    state.orders.slots.forEach((slot, i) => {
      const o = slot.order;
      if (!o) {
        const wait = Math.max(0, slot.readyAt - now);
        board.append(
          h(
            'div',
            { class: 'note-card empty', 'data-test': `order-empty-${i}` },
            h('span', { class: 'balloon-mini' }),
            h('span', { class: 'pack-info' }, wait > 0 ? `Khinh khí cầu về sau ${formatDuration(wait)}` : 'Đang hạ cánh…'),
            wait > 0 && h('button', { class: 'candy plain small', onclick: () => this.actions.rushOrder(i) }, gem(16), `${content.orders.skipNowGems} · Gọi về ngay`),
          ),
        );
        return;
      }
      const ok = canDeliver(state, o);
      const lines = h('div', { class: 'order-lines' });
      for (const [id, qty] of Object.entries(o.items)) {
        const have = state.inventory[id] ?? 0;
        lines.append(h('span', { class: `order-line${have >= qty ? ' done' : ''}` }, icon(itemFrame(content, id), 44), h('span', { class: 'qty-tag' }, `${Math.min(have, qty)}/${qty}`)));
      }
      const btn = h(
        'button',
        { class: `candy ${ok ? 'primary' : 'blocked'} small`, 'data-test': `deliver-${i}`, onclick: () => (ok ? this.actions.deliverOrder(i) : shake(btn)) },
        'Giao hàng',
      );
      board.append(
        h(
          'div',
          { class: `note-card${o.rare ? ' rare' : ''}`, 'data-test': `order-${i}` },
          h('span', { class: 'pin' }),
          o.rare && h('span', { class: 'rare-tag' }, 'Đơn quý'),
          h('span', { class: 'customer' }, botName(this.session, o.customer)),
          lines,
          h('span', { class: 'rewards' }, h('span', {}, coin(18), formatNumber(o.coins)), h('span', {}, star(18), formatNumber(o.xp)), o.gems > 0 && h('span', {}, gem(18), String(o.gems))),
          h('span', { class: 'note-actions' }, btn, h('button', { class: 'link-btn', 'data-test': `skip-${i}`, onclick: () => this.actions.skipOrder(i) }, 'Bỏ đơn')),
        ),
      );
    });
    this.body.append(h('p', { class: 'lead' }, 'Giao đơn được nhiều xu và kinh nghiệm hơn bán ở Rương. Đơn quý có thêm Ngọc Mây.'), board);
  }
}

/** "Sạp Phú Bà": the player's own stall; neighbours drop by and buy what is fairly priced. */
export class StallPanel extends Panel {
  private itemId: string | null = null;
  private qty = 1;
  private price = 1;

  constructor(
    private readonly session: GameSession,
    private readonly actions: WorldActions,
  ) {
    super('Sạp Phú Bà', 'stall-panel', 'win-seed');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const cfg = content.neighbors;
    const shelf = h('div', { class: 'stall-shelf' });
    for (let i = 0; i < cfg.stallSlots; i++) {
      const l = state.stall[i];
      if (!l) {
        shelf.append(h('div', { class: 'stall-slot empty' }, h('span', { class: 'pack-info' }, 'Chỗ trống')));
        continue;
      }
      shelf.append(
        h(
          'div',
          { class: 'stall-slot', 'data-test': `listing-${l.id}` },
          icon(itemFrame(content, l.itemId), 52),
          h('span', { class: 'count' }, `×${l.qty}`),
          h('span', { class: 'tag' }, coin(16), formatNumber(l.price)),
          h('button', { class: 'link-btn', onclick: () => this.actions.cancelListing(l.id) }, 'Gỡ'),
        ),
      );
    }
    this.body.append(h('p', { class: 'lead' }, 'Hàng xóm ghé qua sẽ mua món có giá hời. Giá càng thấp, bán càng nhanh.'), shelf);

    const sellable = Object.entries(state.inventory).filter(([id, q]) => q > 0 && content.items.get(id)?.sellPrice != null);
    if (state.stall.length >= cfg.stallSlots) {
      this.body.append(h('p', { class: 'note' }, 'Sạp đã kín chỗ.'));
      return;
    }
    if (sellable.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Rương chưa có nông sản để bày bán.'));
      return;
    }
    if (!this.itemId || !(state.inventory[this.itemId]! > 0)) this.pick(sellable[0]![0]);
    const id = this.itemId!;
    const base = content.items.get(id)!.sellPrice!;
    const have = state.inventory[id] ?? 0;
    const minP = Math.max(1, Math.floor(base * cfg.priceRange[0]));
    const maxP = Math.ceil(base * cfg.priceRange[1]);
    this.qty = Math.min(Math.max(1, this.qty), Math.min(have, cfg.maxListingQty));
    this.price = Math.min(Math.max(minP, this.price), maxP);
    const willing = Math.max(...[...content.bots.values()].map((b) => valuation(content, b, id)));

    const picker = h('div', { class: 'compartments' });
    for (const [iid, count] of sellable) {
      picker.append(h('button', { class: `cell${iid === id ? ' on' : ''}`, onclick: () => (this.pick(iid), this.render()) }, icon(itemFrame(content, iid), 52), h('span', { class: 'count' }, String(count))));
    }
    const qtyEl = h('span', { class: 'qty' }, String(this.qty));
    const priceEl = h('span', { class: 'qty' }, coin(18), String(this.price));
    const total = h('span', { class: 'total' }, coin(), formatNumber(this.qty * this.price));
    const update = () => {
      qtyEl.textContent = String(this.qty);
      priceEl.replaceChildren(coin(18), String(this.price));
      total.replaceChildren(coin(), formatNumber(this.qty * this.price));
    };
    const qtySlider = h('input', { class: 'slider', type: 'range', min: 1, max: Math.min(have, cfg.maxListingQty), value: this.qty, 'aria-label': 'Số lượng bày bán' });
    qtySlider.addEventListener('input', () => ((this.qty = Number(qtySlider.value)), update()));
    const priceSlider = h('input', { class: 'slider', type: 'range', min: minP, max: maxP, value: this.price, 'aria-label': 'Giá mỗi món' });
    priceSlider.addEventListener('input', () => ((this.price = Number(priceSlider.value)), update()));
    this.body.append(
      picker,
      h(
        'div',
        { class: 'scale' },
        h('div', { class: 'scale-row' }, h('span', { class: 'scale-label' }, 'Số lượng'), qtySlider, qtyEl),
        h('div', { class: 'scale-row' }, h('span', { class: 'scale-label' }, 'Giá mỗi món'), priceSlider, priceEl),
        h('p', { class: 'note' }, `Rương mua ${formatNumber(sellPrice(content, state, id, this.session.now()) ?? base)} xu · hàng xóm hào phóng nhất trả tới khoảng ${formatNumber(Math.floor(willing))} xu`),
        h('div', { class: 'scale-row center' }, total),
        h('div', { class: 'candy-wrap' }, h('button', { class: 'candy gold', 'data-test': 'list-item', onclick: () => this.actions.listItem(id, this.qty, this.price) }, 'Bày lên sạp')),
      ),
    );
  }

  private pick(id: string): void {
    const { content, state } = this.session;
    this.itemId = id;
    const base = content.items.get(id)!.sellPrice!;
    this.qty = Math.min(state.inventory[id] ?? 1, content.neighbors.maxListingQty);
    this.price = Math.max(1, Math.round(base * 1.3));
  }
}

/** "Bảng Phú Bà": everyone's wealth, with what each neighbour is up to and why. */
export class NeighborsPanel extends Panel {
  constructor(private readonly session: GameSession) {
    super('Bảng Phú Bà', 'neighbors-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    type Row = { name: string; level: number; wealth: number; you: boolean; friendship: number; doing: string; likes: string };
    const rows: Row[] = [{ name: 'Bạn', level: state.player.level, wealth: playerWealth(content, state), you: true, friendship: 0, doing: '', likes: '' }];
    for (const bot of content.bots.values()) {
      const s = state.neighbors[bot.id];
      if (!s) continue;
      rows.push({ name: bot.name.vi, level: s.level, wealth: botWealth(s), you: false, friendship: s.friendship, doing: s.lastAction?.reason ?? 'Mới dọn đến', likes: FAMILY_TEXT[bot.likes] ?? bot.likes });
    }
    rows.sort((a, b) => b.wealth - a.wealth);
    const list = h('div', { class: 'rank-list' });
    rows.forEach((r, i) => {
      list.append(
        h(
          'div',
          { class: `rank-row${r.you ? ' you' : ''}` },
          h('span', { class: `medal m${Math.min(i + 1, 4)}` }, String(i + 1)),
          h(
            'span',
            { class: 'rank-main' },
            h('strong', {}, `${r.name} · cấp ${r.level}`),
            !r.you && h('span', { class: 'rank-doing' }, `${r.doing} · thích cây ${r.likes}`),
          ),
          !r.you && h('span', { class: 'hearts', title: 'Thân thiết' }, '♥'.repeat(Math.min(5, Math.floor(r.friendship / 2))) || '♡'),
          h('span', { class: 'tag' }, coin(16), formatNumber(r.wealth)),
        ),
      );
    });
    this.body.append(h('p', { class: 'lead' }, 'Tài sản = xu + giá trị vườn. Giao đơn và bán sạp cho hàng xóm để thêm thân thiết, họ sẽ ghé tặng quà.'), list);
  }
}

/** "Sổ Tay Thực Vật": every crop, harvest count, rare variants found, milestone rewards. */
export class JournalPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: WorldActions,
  ) {
    super('Sổ Tay Thực Vật', 'journal-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const { milestones } = content.surprises.journal;
    const grid = h('div', { class: 'journal' });
    for (const crop of content.cropList) {
      const e = state.journal[crop.id];
      const known = (e?.harvests ?? 0) > 0;
      const m = nextMilestone(content, state, crop.id);
      const target = milestones[e?.claimed ?? 0];
      const pct = target ? Math.min(100, ((e?.harvests ?? 0) / target) * 100) : 100;
      const muts = content.surprises.mutations.map((mu) => h('span', { class: `mut ${mu.id}${(e?.mutations[mu.id] ?? 0) > 0 ? ' found' : ''}` }, `${mu.name.vi} ×${e?.mutations[mu.id] ?? 0}`));
      grid.append(
        h(
          'div',
          { class: `page${known ? '' : ' unknown'}` },
          icon(`${crop.sprite}/${crop.stages - 1}`, 72, 'sprites'),
          h('strong', {}, known ? crop.name.vi : '? ? ?'),
          h('span', { class: 'pack-info' }, known ? `Đã thu ${formatNumber(e!.harvests)} lần` : `Mở ở cấp ${crop.unlockLevel}`),
          h('span', { class: 'muts' }, ...muts),
          h('span', { class: 'vine small' }, h('span', { class: 'vine-fill', style: `width:${pct}%` }), h('span', { class: 'xp-text' }, target ? `${e?.harvests ?? 0}/${target}` : 'Hoàn thành')),
          m && h('button', { class: 'candy gold small', 'data-test': `claim-${crop.id}`, onclick: () => this.actions.claimJournal(crop.id) }, gem(16), `Nhận ${m.gems}`),
        ),
      );
    }
    this.body.append(h('p', { class: 'lead' }, 'Thu hoạch đủ mốc để nhận Ngọc Mây. Quả Vàng, quả Ngọc hiếm lắm — chậu May mắn giúp gặp nhiều hơn.'), grid);
  }
}

/** "Thư Mây": letters about what happened while away. Opening marks them read. */
export class LettersPanel extends Panel {
  constructor(private readonly session: GameSession) {
    super('Thư Mây', 'letters-panel', 'win-confirm');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { state } = this.session;
    const now = this.session.now();
    if (state.notices.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Chưa có thư nào.'));
      return;
    }
    const list = h('div', { class: 'letters' });
    for (const n of state.notices) {
      list.append(h('div', { class: `letter${n.read ? '' : ' unread'}` }, h('span', {}, n.text), h('span', { class: 'pack-info' }, `${formatDuration(Math.max(1000, now - n.at))} trước`)));
    }
    this.body.append(list);
  }
}
