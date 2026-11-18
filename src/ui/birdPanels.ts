// Chỉ thị 10 § 3.3: "Bảng chim" — fullness, level, bugs caught today, rent time, feed and feed-all;
// plus the bird shop (rent with coins, buy with in-game gems). Reads state, sends commands only.

import type { GameSession } from '../app/session.ts';
import { foodAt, perchesPerFloor, rentEndsSoon, rentPrice } from '../systems/birds.ts';
import { isNight } from '../systems/growth.ts';
import { localDay } from '../systems/missions.ts';
import { itemIcon } from './icons.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { FAMILY_TEXT, formatDuration, formatNumber } from './text.ts';
import { coin, gem } from './worldPanels.ts';
import { houseBonus } from '../systems/village.ts';

export interface BirdActions {
  obtainBird(species: string, how: 'rent' | 'buy'): void;
  feedBird(birdId: string, itemId: string): void;
  feedAllBirds(): void;
  placeBird(birdId: string, floor: number, branch: number): void;
  buyMillet(qty: number): void;
}

const slug = (id: string) => id.slice(id.lastIndexOf('.') + 1);

export class BirdsPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: BirdActions,
  ) {
    super('Chim Bắt Sâu', 'birds-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const rules = content.birdRules;
    if (!content.birds || !rules) return;
    const now = this.session.now();
    const millet = rules.millet.item;
    const have = state.inventory[millet] ?? 0;

    // Millet bar: stock, buy, feed every bird.
    const tools = h(
      'div',
      { class: 'bird-tools' },
      h('span', { class: 'bird-millet' }, itemIcon(content, millet, 36), `Hạt Kê Mây: ${formatNumber(have)}`),
      h('button', { class: 'candy plain small', 'data-test': 'buy-millet-1', onclick: () => this.actions.buyMillet(1) }, coin(16), `${rules.millet.coins} · Mua 1`),
      h('button', { class: 'candy plain small', 'data-test': 'buy-millet-5', onclick: () => this.actions.buyMillet(5) }, coin(16), `${rules.millet.coins * 5} · Mua 5`),
      state.birds.length > 0 && h('button', { class: 'candy primary small', 'data-test': 'feed-all', onclick: () => this.actions.feedAllBirds() }, 'Cho ăn hết'),
    );

    const mine = h('div', { class: 'bird-list' });
    const day = localDay(content, now);
    const perches = perchesPerFloor(content, state.player.level) + houseBonus(content, state, 'birds', 'perches');
    for (const b of state.birds) {
      const def = content.birds.get(b.species);
      if (!def) continue;
      const food = foodAt(content, b, now);
      const pct = Math.round((food / rules.foodMax) * 100);
      const status =
        b.escort && now < b.escort.until
          ? 'Đang đi giao hàng'
          : food <= 0
            ? 'Đói, đang ngủ trên cành'
            : def.nightOnly && !isNight(content, now)
              ? 'Ngủ ngày, tối mới bắt bọ'
              : 'Đang canh bọ';
      const rent =
        b.rentUntil === null ? 'Chim của bạn' : `Còn ${formatDuration(Math.max(0, b.rentUntil - now))}${rentEndsSoon(content, b, now) ? ' — sắp bay về!' : ''}`;
      const today = b.today.day === day ? b.today.count : 0;
      // Produce of the bird's own family in the bag: +35 and friendship.
      const produce = content.cropList.find((c) => (def.families.length === 0 || def.families.includes(c.family)) && (state.inventory[c.produce.id] ?? 0) > 0);
      const floors = h('span', { class: 'bird-floors' });
      state.floors.forEach((_, fi) => {
        for (let br = 0; br < perches; br++) {
          const here = b.floor === fi && b.branch === br;
          const label = perches > 1 ? `T${fi + 1}·${br + 1}` : `Tầng ${fi + 1}`;
          floors.append(h('button', { class: `chip${here ? ' on' : ''}`, 'data-test': `place-${b.id}-${fi}-${br}`, onclick: () => !here && this.actions.placeBird(b.id, fi, br) }, label));
        }
      });
      const feedBtn = h(
        'button',
        { class: `candy ${have > 0 ? 'gold' : 'blocked'} small`, 'data-test': `feed-${b.id}`, onclick: () => (have > 0 ? this.actions.feedBird(b.id, millet) : shake(feedBtn)) },
        'Cho ăn Hạt Kê',
      );
      mine.append(
        h(
          'div',
          { class: `page bird-card${food <= 0 ? ' hungry' : ''}`, 'data-test': `bird-${b.id}` },
          icon(`bird/${slug(b.species)}/perch`, 72),
          h('strong', {}, `${def.name.vi} · Cấp ${b.level}`),
          h('span', { class: 'pack-info' }, status),
          h('span', { class: 'vine small' }, h('span', { class: 'vine-fill', style: `width:${pct}%` }), h('span', { class: 'xp-text' }, `No ${pct}/100`)),
          h('span', { class: 'pack-info' }, `Hôm nay bắt ${today} · Tổng ${formatNumber(b.caught)}`),
          h('span', { class: 'pack-info' }, rent),
          floors,
          h(
            'span',
            { class: 'note-actions' },
            feedBtn,
            produce && h('button', { class: 'candy plain small', 'data-test': `feed-produce-${b.id}`, onclick: () => this.actions.feedBird(b.id, produce.produce.id) }, itemIcon(content, produce.produce.id, 22), 'Cho ăn'),
          ),
        ),
      );
    }

    const shop = h('div', { class: 'bird-list' });
    for (const def of content.birds.values()) {
      const open = state.player.level >= def.unlockLevel;
      const where = def.nightOnly ? 'Mọi họ cây, chỉ ban đêm, bắt được bọ Hiếm' : `Bắt bọ trên cây ${def.families.map((f) => FAMILY_TEXT[f] ?? f).join(', ')}`;
      const rentBtn =
        def.rent &&
        h(
          'button',
          { class: `candy ${open && state.player.coins >= rentPrice(content, state, def.rent.coins) ? 'primary' : 'blocked'} small`, 'data-test': `rent-${slug(def.id)}`, onclick: (e: Event) => (open ? this.actions.obtainBird(def.id, 'rent') : shake(e.currentTarget as HTMLElement)) },
          coin(16),
          `${formatNumber(rentPrice(content, state, def.rent.coins))} · Thuê ${def.rent.days} ngày`,
        );
      const buyBtn = h(
        'button',
        { class: `candy ${open && state.player.gems >= def.gems ? 'gold' : 'blocked'} small`, 'data-test': `buy-${slug(def.id)}`, onclick: (e: Event) => (open ? this.actions.obtainBird(def.id, 'buy') : shake(e.currentTarget as HTMLElement)) },
        gem(16),
        `${def.gems} · Mua`,
      );
      shop.append(
        h(
          'div',
          { class: `page bird-card${open ? '' : ' unknown'}`, 'data-test': `shop-${slug(def.id)}` },
          icon(`bird/${slug(def.id)}/perch`, 72),
          h('strong', {}, def.name.vi),
          h('span', { class: 'pack-info' }, open ? where : `Mở ở cấp ${def.unlockLevel}`),
          open && h('span', { class: 'note-actions' }, rentBtn, buyBtn),
        ),
      );
    }

    this.body.append(
      h('p', { class: 'lead' }, 'Chim đậu ở mép phải tầng, tự bắt bọ hợp họ cây trên tầng đó, cả khi bạn tắt game. Chim đói thì ngủ, cho ăn là bắt tiếp.'),
      tools,
      state.birds.length > 0 ? mine : h('p', { class: 'pack-info' }, 'Bạn chưa có chim nào.'),
      h('h3', { class: 'bird-head' }, 'Tìm chim'),
      shop,
    );
  }
}
