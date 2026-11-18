// Windows for orders, the stall, neighbours, the plant journal and letters (DESIGN_SYSTEM 6).
// They only read state and send commands through the actions interface.

import { itemIcon } from './icons.ts';
import { svgIcon } from './icons.ts';
import type { GameSession } from '../app/session.ts';
import { canDeliver } from '../systems/orders.ts';
import { lockedForPlayer, playerPrice, rankings, valuation } from '../systems/neighbors.ts';
import { localDay } from '../systems/missions.ts';
import { botAvatar } from './avatar.ts';
import { nextMilestone } from '../systems/surprises.ts';
import { sellPrice } from '../systems/economy.ts';
import { itemFrame } from '../render/assets.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { helpsLeft } from '../systems/visit.ts';
import { shake } from './potPanels.ts';
import { formatDuration, formatNumber, FAMILY_TEXT } from './text.ts';
import { masteryStars, nextMastery } from '../systems/cropExtras.ts';
import { bazaarOpen, bazaarRules, luckBars, nextFreeRefreshAt, rerollCost, wantedItems } from '../systems/bazaar.ts';
import { potIcon, rarityChip } from './potPanels.ts';
import { RARITY_TEXT } from './text.ts';
import { houseBonus } from '../systems/village.ts';

export interface WorldActions {
  deliverOrder(slot: number, birdId?: string): void;
  askNeighbors(slot: number): void;
  skipOrder(slot: number): void;
  rushOrder(slot: number): void;
  listItem(itemId: string, qty: number, price: number): void;
  cancelListing(id: number): void;
  buyFromNeighbor(botId: string, itemId: string, qty: number): void;
  rerollBazaar(): void;
  buyBazaar(slot: number): void;
  claimJournal(cropId: string): void;
}

export const coin = (size = 20) => svgIcon('coin', size + 4);
export const gem = (size = 20) => svgIcon('gem', size + 4);
export const star = (size = 20) => h('span', { class: 'ico-star', style: `width:${size}px;height:${size}px` });

function botName(session: GameSession, id: string): string {
  return session.content.bots.get(id)?.name.vi ?? 'Khách lạ';
}

/** "Bảng Đơn Khinh Khí Cầu": parchment notes pinned on a wooden board (6, up to 9 by level). */
export class OrdersPanel extends Panel {
  /** Bird chosen to escort the next balloon (chỉ thị 10 § 3.6), or null. */
  private escort: string | null = null;

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
    // Birds free to escort (placed or not, not already flying with a balloon).
    const escortOpen = state.player.level >= (content.orders.escortLevel ?? 1) && !!content.birds;
    const free = escortOpen ? state.birds.filter((b) => !(b.escort && b.escort.until > now)) : [];
    if (this.escort && !free.some((b) => b.id === this.escort)) this.escort = null;
    const helpOpen = state.player.level >= (content.orders.helpLevel ?? 1);
    const helpUsed = state.orders.helpDay === localDay(content, now);
    state.orders.slots.forEach((slot, i) => {
      const o = slot.order;
      if (!o) {
        const wait = Math.max(0, slot.readyAt - now);
        const f = slot.flight;
        const bird = f?.bird ? content.birds?.get(f.bird) : undefined;
        board.append(
          h(
            'div',
            { class: `note-card empty${f ? ' flying' : ''}`, 'data-test': `order-empty-${i}` },
            svgIcon('orders', 44),
            f
              ? h('span', { class: 'pack-info' }, `Đang bay, về sau ${formatDuration(wait)}`)
              : h('span', { class: 'pack-info' }, wait > 0 ? `Khinh khí cầu về sau ${formatDuration(wait)}` : 'Đang hạ cánh…'),
            f && h('span', { class: 'rewards' }, h('span', {}, coin(18), formatNumber(f.coins)), f.xp > 0 && h('span', {}, star(18), formatNumber(f.xp)), f.gems > 0 && h('span', {}, gem(18), String(f.gems)), ...Object.entries(f.items).map(([id, q]) => h('span', {}, itemIcon(content, id, 18), String(q)))),
            bird && h('span', { class: 'pack-info' }, icon(`bird/${f!.bird!.slice(f!.bird!.lastIndexOf('.') + 1)}/fly`, 26), `${bird.name.vi} dẫn đường`),
            wait > 0 && h('button', { class: 'candy plain small', onclick: () => this.actions.rushOrder(i) }, gem(16), `${content.orders.skipNowGems} · Gọi về ngay`),
          ),
        );
        return;
      }
      const ok = canDeliver(state, o);
      const lines = h('div', { class: 'order-lines' });
      for (const [id, qty] of Object.entries(o.items)) {
        const given = o.given?.[id] ?? 0;
        const have = (state.inventory[id] ?? 0) + given;
        lines.append(h('span', { class: `order-line${have >= qty ? ' done' : ''}` }, itemIcon(content, id, 44), h('span', { class: 'qty-tag' }, `${Math.min(have, qty)}/${qty}`), given > 0 && h('span', { class: 'given-tag' }, `+${given}`)));
      }
      const btn = h(
        'button',
        { class: `candy ${ok ? 'primary' : 'blocked'} small`, 'data-test': `deliver-${i}`, onclick: () => (ok ? this.actions.deliverOrder(i, this.escort ?? undefined) : shake(btn)) },
        this.escort ? 'Gửi cùng chim' : 'Gửi hàng',
      );
      const left = o.expiresAt !== undefined ? o.expiresAt - now : null;
      board.append(
        h(
          'div',
          { class: `note-card${o.rare ? ' rare' : ''}`, 'data-test': `order-${i}` },
          h('span', { class: 'pin' }),
          o.rare && h('span', { class: 'rare-tag' }, left !== null ? `Đơn quý · còn ${formatDuration(left)}` : 'Đơn quý'),
          h('span', { class: 'customer' }, botName(this.session, o.customer)),
          lines,
          h('span', { class: 'rewards' }, h('span', {}, coin(18), formatNumber(o.coins)), h('span', {}, star(18), formatNumber(o.xp)), o.gems > 0 && h('span', {}, gem(18), String(o.gems)), o.bonusItem && h('span', {}, itemIcon(content, o.bonusItem, 18), '1')),
          h(
            'span',
            { class: 'note-actions' },
            btn,
            helpOpen && !ok && !helpUsed && h('button', { class: 'link-btn', 'data-test': `help-${i}`, onclick: () => this.actions.askNeighbors(i) }, 'Nhờ góp'),
            h('button', { class: 'link-btn', 'data-test': `skip-${i}`, onclick: () => this.actions.skipOrder(i) }, 'Bỏ đơn'),
          ),
        ),
      );
    });
    const escortRow =
      free.length > 0 &&
      h(
        'div',
        { class: 'bird-tools escort-row' },
        h('span', { class: 'pack-info' }, 'Chim dẫn đường:'),
        h('button', { class: `chip${this.escort === null ? ' on' : ''}`, onclick: () => ((this.escort = null), this.render()) }, 'Không'),
        ...free.map((b) => {
          const def = content.birds!.get(b.species);
          const bonus = def ? [def.escort.coins ? `+${Math.round(def.escort.coins * 100)}% xu` : '', def.escort.xp ? `+${Math.round(def.escort.xp * 100)}% XP` : ''].filter(Boolean).join(' ') : '';
          return h('button', { class: `chip${this.escort === b.id ? ' on' : ''}`, 'data-test': `escort-${b.id}`, onclick: () => ((this.escort = b.id), this.render()) }, icon(`bird/${b.species.slice(b.species.lastIndexOf('.') + 1)}/perch`, 22), `${def?.name.vi ?? ''} ${bonus}`);
        }),
      );
    this.body.append(h('p', { class: 'lead' }, 'Gửi đủ hàng thì khinh khí cầu bay đi, về mới trả xu và kinh nghiệm. Chim dẫn đường cộng thêm thưởng nhưng không bắt sâu khi đi. Đơn quý có hạn, thưởng thêm Ngọc Mây và vật phẩm.'));
    if (escortRow) this.body.append(escortRow);
    this.body.append(board);
  }
}

export type MarketTab = 'mine' | 'market' | 'hunt';
type MarketFilter = 'all' | 'produce' | 'other' | 'orders';

/** "Chợ Mây" (chỉ thị 07): my own stall, and every Phú Bà's stall to buy from. */
export class StallPanel extends Panel {
  private itemId: string | null = null;
  private qty = 1;
  private price = 1;
  private filter: MarketFilter = 'all';
  /** Board already shown (new Sử Thi / Huyền Thoại slots shake only once). */
  private seenRoll = -1;

  constructor(
    private readonly session: GameSession,
    private readonly actions: WorldActions,
    private tab: MarketTab = 'mine',
    private focusBot: string | null = null,
  ) {
    super('Chợ Mây', 'stall-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    for (const [id, name] of [['mine', 'Sạp của tôi'], ['market', 'Đi chợ'], ['hunt', 'Săn hàng hiếm']] as const) {
      tabs.append(
        h('button', { class: `tab${this.tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': this.tab === id ? 'true' : 'false', 'data-test': `market-tab-${id}`, onclick: () => ((this.tab = id), (this.focusBot = null), this.render()) }, name),
      );
    }
    this.body.append(h('div', { class: 'filters' }, tabs));
    if (this.tab === 'market') this.renderMarket();
    else if (this.tab === 'hunt') this.renderHunt();
    else this.renderMine();
  }

  /** Chỉ thị 12 B2: the Sạp Săn Hàng — eight slots by rarity, reroll for coins, Vận May bars. */
  private renderHunt(): void {
    const { content, state } = this.session;
    const rules = bazaarRules(content);
    if (!rules) return;
    if (!bazaarOpen(content, state)) {
      this.body.append(h('p', { class: 'note' }, `Sạp Săn Hàng mở ở cấp ${rules.unlockLevel}.`));
      return;
    }
    const now = this.session.now();
    const z = state.bazaar;
    const cost = rerollCost(content, state, now);
    const fresh = z ? z.roll !== this.seenRoll : false;
    if (z) this.seenRoll = z.roll;
    const luck = h(
      'div',
      { class: 'luck-bars' },
      ...luckBars(content, state).map((l) =>
        h(
          'div',
          { class: `luck ${l.rarity}`, 'data-test': `luck-${l.rarity}` },
          h('span', { class: 'luck-label' }, `Vận May ${RARITY_TEXT[l.rarity]}`),
          h('span', { class: 'luck-track' }, h('span', { class: 'luck-fill', style: `width:${Math.round((100 * l.have) / l.at)}%` })),
          h('span', { class: 'luck-count' }, l.have >= l.at ? 'lần sau chắc trúng!' : `${l.have}/${l.at}`),
        ),
      ),
    );
    this.body.append(
      h('p', { class: 'lead' }, `Các Phú Bà bày hàng mới miễn phí mỗi ${rules.refreshHours} giờ. Muốn săn ngay thì đặt lại sạp: càng đặt nhiều trong ngày càng đắt, sang ngày mới giá về như cũ.`),
      h(
        'div',
        { class: 'hunt-head' },
        luck,
        h('span', { class: 'note' }, `Làm mới miễn phí sau ${formatDuration(nextFreeRefreshAt(content, now) - now)}`),
        h('button', { class: 'candy gold', 'data-test': 'bazaar-reroll', disabled: state.player.coins < cost ? true : undefined, onclick: () => this.actions.rerollBazaar() }, 'Đặt lại sạp · ', coin(16), formatNumber(cost)),
      ),
    );
    if (!z || z.slots.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Sạp đang bày hàng, quay lại sau một chút nhé.'));
      return;
    }
    const wanted = wantedItems(content, state);
    const grid = h('div', { class: 'hunt-grid' });
    z.slots.forEach((sl, i) => {
      const pot = sl.kind === 'pot' ? content.pots.get(sl.id) : undefined;
      const name = pot ? pot.name.vi : (content.items.get(sl.id)?.name.vi ?? sl.id);
      const seller = content.bots.get(sl.seller);
      const jackpot = fresh && !sl.sold && (sl.rarity === 'epic' || sl.rarity === 'legendary');
      const afford = sl.currency === 'gems' ? state.player.gems >= sl.price : state.player.coins >= sl.price;
      grid.append(
        h(
          'div',
          { class: `hunt-slot rar-${sl.rarity}${sl.sold ? ' sold' : ''}${jackpot ? ' jackpot' : ''}${wanted.has(sl.id) ? ' wanted' : ''}`, 'data-test': `bazaar-slot-${i}` },
          rarityChip(sl.rarity),
          pot ? potIcon(pot, 1, 64) : itemIcon(content, sl.id, 56),
          h('span', { class: 'ware-name' }, name),
          h('span', { class: 'ware-meta' }, sl.kind === 'pot' ? 'chậu nguyên' : `×${sl.qty}`, wanted.has(sl.id) && h('span', { class: 'ware-flag', title: 'Bạn đang thiếu món này để nâng chậu' }, 'đang thiếu')),
          seller && h('span', { class: 'hunt-seller' }, botAvatar(seller.id, 22), seller.name.vi),
          sl.sold
            ? h('span', { class: 'tag' }, 'Đã mua')
            : h('button', { class: `candy small${afford ? ' gold' : ''}`, 'data-test': `bazaar-buy-${i}`, disabled: afford ? undefined : true, onclick: () => this.actions.buyBazaar(i) }, sl.currency === 'gems' ? gem(14) : coin(14), formatNumber(sl.price)),
        ),
      );
    });
    this.body.append(grid);
  }

  /** Items still missing for the open balloon orders. */
  private orderNeeds(): Set<string> {
    const { state } = this.session;
    const need = new Set<string>();
    for (const sl of state.orders.slots) {
      for (const [id, q] of Object.entries(sl.order?.items ?? {})) if ((state.inventory[id] ?? 0) < q) need.add(id);
    }
    return need;
  }

  private renderMarket(): void {
    const { content, state } = this.session;
    const m = content.neighbors.market;
    const day = localDay(content, this.session.now());
    const used = state.market.day === day ? state.market.buys : 0;
    const need = this.orderNeeds();
    const chips = h('div', { class: 'chips' });
    const filters: Array<[MarketFilter, string]> = [
      ['all', 'Tất cả'],
      ['produce', 'Nông sản'],
      ['other', 'Bọ và nguyên liệu'],
      ['orders', `Tìm món cho đơn hàng${need.size ? ` · ${need.size}` : ''}`],
    ];
    for (const [id, name] of filters) {
      chips.append(h('button', { class: `chip${this.filter === id ? ' on' : ''}`, 'data-test': `market-filter-${id}`, onclick: () => ((this.filter = id), this.render()) }, name));
    }
    this.body.append(h('div', { class: 'market-head' }, chips, h('span', { class: 'market-quota' }, `Lượt mua hôm nay ${used}/${m.buysPerDay}`)));
    const keep = (itemId: string): boolean => {
      const item = content.items.get(itemId);
      if (this.filter === 'produce') return item?.kind === 'produce';
      if (this.filter === 'other') return item?.kind !== 'produce';
      if (this.filter === 'orders') return need.has(itemId);
      return true;
    };
    const focus = this.focusBot;
    const bots = [...content.bots.values()]
      .filter((b) => (state.neighbors[b.id]?.stall ?? []).some((l) => keep(l.itemId)))
      .sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0) || state.neighbors[b.id]!.friendship - state.neighbors[a.id]!.friendship);
    if (bots.length === 0) {
      this.body.append(
        h('p', { class: 'note' }, this.filter === 'orders' ? 'Chưa ai bày món đơn hàng đang cần. Hàng xóm bày hàng mới mỗi nửa giờ, quay lại sau nhé.' : 'Chợ đang vãn. Hàng xóm bày hàng mới mỗi nửa giờ.'),
      );
      return;
    }
    const grid = h('div', { class: 'market-grid' });
    for (const bot of bots) {
      const s = state.neighbors[bot.id]!;
      const wares = h('div', { class: 'wares' });
      for (const l of s.stall.filter((x) => keep(x.itemId))) {
        const price = playerPrice(content, state, l);
        const locked = lockedForPlayer(content, state, l.itemId);
        wares.append(
          h(
            'div',
            { class: `ware${need.has(l.itemId) ? ' wanted' : ''}`, 'data-test': `ware-${bot.id}-${l.itemId}` },
            itemIcon(content, l.itemId, 44),
            h('span', { class: 'ware-name' }, content.items.get(l.itemId)?.name.vi ?? l.itemId),
            h('span', { class: 'ware-meta' }, `×${l.qty}`, locked && h('span', { class: 'ware-flag', title: 'Bạn chưa mở khóa cây này nên giá cao hơn' }, 'hiếm')),
            h('span', { class: 'tag' }, coin(14), formatNumber(price)),
            h(
              'span',
              { class: 'ware-buy' },
              h('button', { class: 'candy small gold', 'data-test': `buy-${bot.id}-${l.itemId}`, onclick: () => this.actions.buyFromNeighbor(bot.id, l.itemId, 1) }, 'Mua 1'),
              l.qty > 1 && h('button', { class: 'candy small', onclick: () => this.actions.buyFromNeighbor(bot.id, l.itemId, l.qty) }, `Mua hết · ${formatNumber(price * l.qty)}`),
            ),
          ),
        );
      }
      grid.append(
        h(
          'section',
          { class: `market-stall${bot.id === focus ? ' focus' : ''}` },
          h('header', {}, botAvatar(bot.id, 44), h('span', { class: 'who' }, h('strong', {}, bot.name.vi), h('span', {}, `${bot.title?.vi ?? ''} · cấp ${s.level}`))),
          wares,
        ),
      );
    }
    this.body.append(grid);
  }

  private renderMine(): void {
    const { content, state } = this.session;
    const cfg = content.neighbors;
    const shelf = h('div', { class: 'stall-shelf' });
    const stallSlots = cfg.stallSlots + houseBonus(content, state, 'market', 'stallSlots');
    for (let i = 0; i < stallSlots; i++) {
      const l = state.stall[i];
      if (!l) {
        shelf.append(h('div', { class: 'stall-slot empty' }, h('span', { class: 'pack-info' }, 'Chỗ trống')));
        continue;
      }
      shelf.append(
        h(
          'div',
          { class: 'stall-slot', 'data-test': `listing-${l.id}` },
          itemIcon(content, l.itemId, 52),
          h('span', { class: 'count' }, `×${l.qty}`),
          h('span', { class: 'tag' }, coin(16), formatNumber(l.price)),
          h('button', { class: 'link-btn', onclick: () => this.actions.cancelListing(l.id) }, 'Gỡ'),
        ),
      );
    }
    this.body.append(h('p', { class: 'lead' }, 'Hàng xóm ghé qua sẽ mua món có giá hời. Giá càng thấp, bán càng nhanh.'), shelf);

    const sellable = Object.entries(state.inventory).filter(([id, q]) => q > 0 && content.items.get(id)?.sellPrice != null);
    if (state.stall.length >= stallSlots) {
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
      picker.append(h('button', { class: `cell${iid === id ? ' on' : ''}`, onclick: () => (this.pick(iid), this.render()) }, itemIcon(content, iid, 52), h('span', { class: 'count' }, String(count))));
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

type BoardTab = 'all' | 'near' | 'friends';

/** "Bảng Phú Bà" (chỉ thị 07): 40 neighbours + you; whole region, around me, close friends. */
export class NeighborsPanel extends Panel {
  private tab: BoardTab = 'all';

  constructor(
    private readonly session: GameSession,
    private readonly visit: (botId: string) => void,
    private readonly openStall: (botId: string) => void = () => {},
  ) {
    super('Bảng Phú Bà', 'neighbors-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    const order = rankings(content, state);
    const myRank = order.findIndex((r) => r.id === '') + 1;
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const names: Array<[BoardTab, string]> = [
      ['all', `Toàn vùng · ${order.length}`],
      ['near', 'Quanh tôi'],
      ['friends', 'Bạn thân'],
    ];
    for (const [id, name] of names) {
      tabs.append(
        h('button', { class: `tab${this.tab === id ? ' on' : ''}`, role: 'tab', 'aria-selected': this.tab === id ? 'true' : 'false', 'data-test': `board-tab-${id}`, onclick: () => ((this.tab = id), this.render()) }, name),
      );
    }
    this.body.append(
      h('div', { class: 'filters' }, tabs),
      h('p', { class: 'lead' }, `Bạn đang hạng ${myRank}/${order.length}. Tài sản = xu + giá trị vườn và chậu. Ghé vườn giúp tưới cây, bắt bọ để nhận xu; mua bán ở sạp để thêm thân thiết.`),
    );
    let rows = order.map((r, i) => ({ ...r, rank: i + 1 }));
    if (this.tab === 'near') rows = rows.filter((r) => Math.abs(r.rank - myRank) <= 5);
    if (this.tab === 'friends') {
      rows = rows
        .filter((r) => r.id === '' || (state.neighbors[r.id]?.friendship ?? 0) >= 4)
        .sort((a, b) => (state.neighbors[b.id]?.friendship ?? 999) - (state.neighbors[a.id]?.friendship ?? 999));
    }
    const list = h('div', { class: 'rank-list' });
    for (const r of rows) {
      const you = r.id === '';
      const bot = content.bots.get(r.id);
      const s = state.neighbors[r.id];
      const prev = state.ranks.prev[r.id];
      const move = prev ? prev - r.rank : 0;
      const helps = s ? helpsLeft(content, s, now) : 0;
      const moveText = move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–';
      const moveLabel = move > 0 ? `lên ${move} hạng` : move < 0 ? `xuống ${-move} hạng` : 'giữ hạng';
      list.append(
        h(
          'div',
          { class: `rank-row${you ? ' you' : ''}`, 'data-test': `rank-${r.id || 'me'}` },
          h('span', { class: `medal m${Math.min(r.rank, 4)}` }, String(r.rank)),
          h('span', { class: `rank-move ${move > 0 ? 'up' : move < 0 ? 'down' : 'same'}`, 'aria-label': moveLabel }, moveText),
          you || !bot ? h('span', { class: 'avatar me' }, 'Bạn') : botAvatar(r.id, 40),
          h(
            'span',
            { class: 'rank-main' },
            h('strong', {}, you || !bot || !s ? `Bạn · cấp ${state.player.level}` : `${bot.name.vi} · cấp ${s.level}`),
            !you && bot && s && h('span', { class: 'rank-doing' }, `${bot.title?.vi ?? ''} · thích cây ${FAMILY_TEXT[bot.likes] ?? bot.likes} · ${s.lastAction?.reason ?? 'Mới dọn đến'}`),
          ),
          !you && s && h('span', { class: 'hearts', title: 'Thân thiết' }, '♥'.repeat(Math.min(5, Math.floor(s.friendship / 2))) || '♡'),
          h('span', { class: 'tag' }, coin(16), formatNumber(r.wealth)),
          !you && s && s.stall.length > 0 && h('button', { class: 'candy small', 'data-test': `stall-of-${r.id}`, onclick: () => this.openStall(r.id) }, `Ghé sạp · ${s.stall.length}`),
          !you && h('button', { class: `candy small ${helps > 0 ? 'gold' : ''}`, 'data-test': `visit-${r.id}`, onclick: () => this.visit(r.id) }, helps > 0 ? `Ghé vườn · ${helps}` : 'Ghé vườn'),
        ),
      );
    }
    if (this.tab === 'friends' && rows.length <= 1) list.append(h('p', { class: 'note' }, 'Chưa có bạn thân. Giao đơn, mua bán và ghé vườn để thân hơn nhé.'));
    this.body.append(list);
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
          // Bổ sung A6.4: Thông Thạo stars and the harvests left to the next one.
          known && h('span', { class: 'mastery' }, `Thông Thạo ${'★'.repeat(masteryStars(content, state, crop.id))}${'☆'.repeat(Math.max(0, (content.cropExtras?.mastery.length ?? 0) - masteryStars(content, state, crop.id)))}`, (() => { const n = nextMastery(content, state, crop.id); return n ? ` · còn ${formatNumber(n - (e?.harvests ?? 0))} lần` : ''; })()),
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
