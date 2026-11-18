// Chỉ thị 11 TỔNG § E5: the Nhà Thú Cưng window. Four pets along the top; the chosen one large, with
// level, stars, Thân Thiết, food, its three skills (locked ones show "Mở ở cấp X"; each shows now and at
// the next star), and the buttons: feed, pat, walk/home, look after a floor, star up, Mưa Ngọc.
// Reads state, sends commands only.

import type { GameSession } from '../app/session.ts';
import type { PetSkillDef, PetSpeciesDef } from '../core/content.ts';
import type { PetState } from '../core/state.ts';
import { activeCombos, dailyLeft, foodAt, foodKind, nextPetStar, petOf, petWorking, replantOn, skillOpen, skillValue, walkSlots, xpToNext } from '../systems/pets.ts';
import { itemIcon } from './icons.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { formatClock, formatNumber } from './text.ts';
import { coin, gem } from './worldPanels.ts';

export interface PetActions {
  obtainPet(species: string, pay: 'coins' | 'gems' | 'shards'): void;
  feedPet(species: string, itemId: string): void;
  patPet(species: string): void;
  walkPet(species: string, active: boolean): void;
  guardFloor(species: string, floor: number): void;
  starUpPet(species: string): void;
  jadeRain(): void;
  sendErrand(index: number, species: string): void;
  rerollErrand(index: number): void;
  claimErrand(index: number): void;
  toggleReplant(on: boolean): void;
}

const pose = (sp: PetSpeciesDef, p: 'stand' | 'run' | 'sleep' | 'happy') => `${sp.art}/${sp.poses[p]}`;

function fmtSkill(sk: PetSkillDef, v: number): string {
  const n = sk.unit === 'percent' ? `${Math.round(v * 100)}%` : sk.unit === 'minutes' ? `${Math.round(v * 10) / 10}` : sk.unit === 'hours' ? `${Math.round(v * 10) / 10}` : `${Math.round(v)}`;
  return sk.desc.vi.replace('{v}', n);
}

export class PetPanel extends Panel {
  private chosen: string;
  private feeding = false;

  constructor(
    private readonly session: GameSession,
    private readonly actions: PetActions,
  ) {
    super('Nhà Thú Cưng', 'pet-panel', 'win-wide');
    const species = session.content.pets?.species ?? [];
    this.chosen = session.state.pets[0]?.species ?? species[0]?.id ?? '';
    this.render();
  }

  /** Countdowns only (every second). */
  tick(): void {
    const now = this.session.now();
    for (const el of this.body.querySelectorAll<HTMLElement>('[data-ends]')) {
      const left = Number(el.dataset.ends) - now;
      if (left <= 0 && el.dataset.done !== '1') ((el.dataset.done = '1'), this.render());
      else el.textContent = formatClock(Math.max(0, left));
    }
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const r = content.pets;
    if (!r) return;
    const now = this.session.now();
    const walked = state.pets.filter((p) => p.active).length;
    const tabs = h('div', { class: 'pet-tabs' });
    for (const sp of r.species) {
      const p = petOf(state, sp.id);
      const pic = icon(pose(sp, p ? (petWorking(content, p, now) ? 'happy' : 'sleep') : 'stand'), 70);
      if (!p) pic.classList.add('pet-unowned');
      tabs.append(h('button', { class: `pet-tab${this.chosen === sp.id ? ' on' : ''}`, 'data-test': `pet-tab-${sp.id}`, onclick: () => ((this.chosen = sp.id), (this.feeding = false), this.render()) }, pic, h('span', {}, sp.name.vi), p ? h('span', { class: 'note' }, `Cấp ${p.level} · ${'★'.repeat(p.stars)}`) : h('span', { class: 'note' }, state.player.level >= sp.unlockLevel ? 'Chưa có' : `🔒 Cấp ${sp.unlockLevel}`)));
    }
    this.body.append(tabs, h('p', { class: 'note' }, `Đang dắt ${walked}/${walkSlots(content, state)} bé. Bé được dắt sẽ trông một tầng và làm việc ở đó; đói thì bé ngủ, không bao giờ bỏ đi.`));
    const sp = r.species.find((s) => s.id === this.chosen);
    if (!sp) return;
    const p = petOf(state, sp.id);
    this.body.append(p ? this.owned(sp, p, now) : this.shop(sp));
    if (state.pets.length > 0) this.body.append(this.errands(now));
    if (content.pets?.combos && state.pets.length > 1) this.body.append(this.combos(now));
  }

  /** § E4: pairs that help each other when both are walked (from player level 14). */
  private combos(now: number): HTMLElement {
    const { content, state } = this.session;
    const c = content.pets!.combos!;
    const on = new Set(activeCombos(content, state, now).map((x) => x.def.id));
    const box = h('section', { class: 'card combo-card' }, h('h3', {}, 'Kết hợp thú cưng'));
    if (state.player.level < c.unlockLevel) {
      box.append(h('p', { class: 'note' }, `🔒 Mở ở cấp ${c.unlockLevel}. Dắt cùng lúc hai bé hợp nhau để có thêm thưởng.`));
      return box;
    }
    box.append(h('p', { class: 'note' }, 'Dắt cùng lúc hai bé (cả hai còn no, đang ở nhà) để có thêm thưởng.'));
    const list = h('div', { class: 'combo-list' });
    for (const def of c.list) {
      const pics = def.pets.map((id) => content.pets!.species.find((s) => s.id === id)).filter((x): x is NonNullable<typeof x> => !!x).map((sp) => icon(`${sp.art}/${sp.poses[on.has(def.id) ? 'happy' : 'stand']}`, 40));
      const have = def.pets.every((id) => petOf(state, id));
      list.append(h('div', { class: `combo${on.has(def.id) ? ' on' : ''}`, 'data-test': `combo-${def.id}` }, h('span', { class: 'combo-pics' }, ...pics), h('strong', {}, def.name.vi), h('span', { class: 'note' }, def.desc.vi + (def.sameFloor ? ' (cùng trông một tầng)' : '')), h('span', { class: 'tag' }, on.has(def.id) ? 'Đang có tác dụng' : have ? 'Chưa dắt đủ' : 'Chưa có đủ bé')));
    }
    box.append(list);
    return box;
  }

  /** § E3: today's errands. The chosen pet is the one sent. */
  private errands(now: number): HTMLElement {
    const { content, state } = this.session;
    const er = content.pets?.errands;
    const box = h('section', { class: 'card errand-card' }, h('h3', {}, 'Việc vặt hôm nay'));
    if (!er) return box;
    if (state.errands.day < 0 || state.errands.list.length === 0) {
      box.append(h('p', { class: 'note' }, 'Bảng việc vặt sẽ có trong giây lát.'));
      return box;
    }
    const chosen = petOf(state, this.chosen);
    const chosenDef = content.pets?.species.find((s) => s.id === this.chosen);
    box.append(h('p', { class: 'note' }, `Bé đi việc vặt thì kỹ năng thụ động nghỉ. Bé hợp nghề mang về nhiều hơn ${Math.round(er.fitBonus * 100)}%. Đổi miễn phí ${er.freeRerolls} việc mỗi ngày (còn ${Math.max(0, er.freeRerolls - state.errands.rerolls)}).`));
    const list = h('div', { class: 'errand-list' });
    state.errands.list.forEach((slot, i) => {
      const def = er.list.find((e) => e.id === slot.errand);
      if (!def) return;
      const fits = def.fit.map((id) => content.pets!.species.find((s) => s.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
      const reward = [def.coinsU ? 'xu' : '', def.bugs ? 'bọ Khá/Hiếm' : '', ...Object.keys(def.items ?? {}).map((id) => content.items.get(id)?.name.vi ?? ''), ...(def.pick ?? []).flatMap((pk) => Object.keys(pk.items).map((id) => `có thể ${content.items.get(id)?.name.vi ?? ''}`)), def.friendship ? 'thân thiết hàng xóm' : '', def.energy ? 'Năng Lượng Gió' : '', 'Huy Hiệu (may mắn)'].filter(Boolean).join(', ');
      const row = h('div', { class: `errand${slot.done ? ' done' : ''}`, 'data-test': `errand-${i}` }, h('strong', {}, `${def.name.vi} · ${def.hours} giờ`), h('span', { class: 'note' }, reward), h('span', { class: 'errand-fit' }, fits.length ? 'Hợp: ' : 'Bé nào cũng được', ...fits.map((f) => icon(`${f.art}/${f.poses.stand}`, 30))));
      const act = h('div', { class: 'errand-act' });
      if (slot.done) act.append(h('span', { class: 'tag' }, 'Đã nhận'));
      else if (slot.pet) {
        const who = content.pets!.species.find((s) => s.id === slot.pet);
        if ((slot.endsAt ?? 0) <= now) act.append(h('button', { class: 'candy small gold', 'data-test': `claim-errand-${i}`, onclick: () => this.actions.claimErrand(i) }, who ? icon(`${who.art}/${who.poses.happy}`, 26) : null, ' Nhận túi quà'));
        else act.append(h('span', { class: 'tag' }, who ? icon(`${who.art}/${who.poses.run}`, 26) : null, ' Về sau ', h('span', { 'data-ends': String(slot.endsAt) }, formatClock((slot.endsAt ?? now) - now))));
      } else {
        const busy = !!chosen && ((chosen.awayUntil ?? 0) > now || state.errands.list.some((e) => e.pet === chosen.species && !e.done));
        if (chosen && chosenDef) act.append(h('button', { class: `candy small ${busy ? 'blocked' : 'primary'}`, disabled: busy ? true : undefined, 'data-test': `send-errand-${i}`, onclick: () => this.actions.sendErrand(i, chosen.species) }, `Sai ${chosenDef.name.vi}`));
        if (state.errands.rerolls < er.freeRerolls) act.append(h('button', { class: 'candy small plain', 'data-test': `reroll-errand-${i}`, onclick: () => this.actions.rerollErrand(i) }, 'Đổi việc'));
      }
      row.append(act);
      list.append(row);
    });
    box.append(list);
    return box;
  }

  private shop(sp: PetSpeciesDef): HTMLElement {
    const { state } = this.session;
    const box = h('div', { class: 'pet-detail' }, h('div', { class: 'pet-big' }, icon(pose(sp, 'stand'), 220)), h('div', { class: 'pet-info' }, h('h3', {}, `${sp.name.vi} — ${sp.title.vi}`), ...sp.skills.map((sk, i) => h('p', { class: 'note left' }, `${['①', '②', '③'][i]} ${sk.name.vi}: ${fmtSkill(sk, sk.lo)}`))));
    const info = box.lastChild as HTMLElement;
    if (state.player.level < sp.unlockLevel) {
      info.append(h('p', { class: 'note' }, `Mở ở cấp ${sp.unlockLevel}.`));
      return box;
    }
    const row = h('div', { class: 'candy-wrap' });
    const pr = sp.price;
    if (pr.free) row.append(h('span', { class: 'tag' }, 'Tặng miễn phí khi mở Chợ'));
    if (pr.coins) row.append(h('button', { class: `candy ${state.player.coins >= pr.coins ? 'gold' : 'blocked'}`, 'data-test': 'buy-pet-coins', onclick: () => this.actions.obtainPet(sp.id, 'coins') }, 'Nhận nuôi · ', coin(16), formatNumber(pr.coins)));
    if (pr.gems) row.append(h('button', { class: `candy ${state.player.gems >= pr.gems ? 'gold' : 'blocked'}`, 'data-test': 'buy-pet-gems', onclick: () => this.actions.obtainPet(sp.id, 'gems') }, 'Nhận nuôi · ', gem(16), formatNumber(pr.gems)));
    if (pr.shards) {
      const have = state.inventory[pr.shards.item] ?? 0;
      row.append(h('button', { class: `candy ${have >= pr.shards.qty ? 'gold' : 'blocked'}`, 'data-test': 'buy-pet-shards', onclick: () => this.actions.obtainPet(sp.id, 'shards') }, 'Ấp trứng · ', itemIcon(this.session.content, pr.shards.item, 18), `${Math.min(have, pr.shards.qty)}/${pr.shards.qty}`));
    }
    info.append(row);
    return box;
  }

  private owned(sp: PetSpeciesDef, p: PetState, now: number): HTMLElement {
    const { content, state } = this.session;
    const r = content.pets!;
    const working = petWorking(content, p, now);
    const food = foodAt(content, p, now);
    const bar = (cls: string, v: number, max: number, label: string) => h('div', { class: `pet-bar ${cls}` }, h('span', { class: 'note' }, label), h('span', { class: 'luck-track' }, h('span', { class: 'luck-fill', style: `width:${Math.min(100, (100 * v) / max)}%` })));
    const big = icon(pose(sp, working ? 'happy' : 'sleep'), 220);
    big.classList.add(`pet-aura-${p.stars}`);
    const pat = h('button', { class: 'pet-big', 'aria-label': 'Vuốt ve', 'data-test': 'pat-pet', onclick: () => this.actions.patPet(sp.id) }, big, h('span', { class: 'note' }, 'Chạm để vuốt ve'));
    const info = h(
      'div',
      { class: 'pet-info' },
      h('h3', {}, `${sp.name.vi} — ${sp.title.vi} `, h('span', { class: 'pet-stars' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < p.stars ? 'on' : '' }, '★')))),
      bar('xp', p.xp, xpToNext(content, p.level), `Cấp ${p.level} · ${Math.floor(p.xp)}/${xpToNext(content, p.level)} EXP`),
      bar('bond', p.bond, r.bond.max, `Thân Thiết ${Math.floor(p.bond)}/${r.bond.max}`),
      bar('food', food, r.food.max, `No ${Math.round(food)}/${r.food.max}${food <= 0 ? ' · đói, đang ngủ' : ''}`),
    );
    // Skills.
    sp.skills.forEach((sk, i) => {
      const open = skillOpen(p, i);
      const v = skillValue(content, p, sk);
      const nextStar = p.stars < 5 ? skillValue(content, { ...p, stars: p.stars + 1 }, sk) : null;
      // Daily allowances left today (a copy, so the panel does not change the save).
      const daily = open && (sk.id === 'restock' || sk.id === 'replant') ? h('span', { class: 'note' }, `Hôm nay còn ${dailyLeft(content, { ...p, skillAt: { ...p.skillAt } }, sk.id, v, now)} lần`) : null;
      const sw = open && sk.id === 'replant' ? h('button', { class: `candy small ${replantOn(p) ? 'primary' : 'plain'}`, 'data-test': 'toggle-replant', onclick: () => this.actions.toggleReplant(!replantOn(p)) }, replantOn(p) ? 'Đang bật' : 'Đang tắt') : null;
      info.append(h('div', { class: `pet-skill${open ? '' : ' locked'}` }, h('strong', {}, `${['①', '②', '③'][i]} ${sk.name.vi}`), h('span', { class: 'note' }, open ? fmtSkill(sk, v) : `🔒 Mở ở cấp thú cưng ${[1, 10, 20][i]}`), open && nextStar !== null ? h('span', { class: 'note next' }, `Sao ${p.stars + 1}: ${fmtSkill(sk, nextStar)}`) : null, daily, sw));
    });
    // Actions.
    const act = h('div', { class: 'candy-wrap pet-actions' });
    act.append(h('button', { class: 'candy small primary', 'data-test': 'feed-pet', onclick: () => ((this.feeding = !this.feeding), this.render()) }, 'Cho ăn'));
    act.append(h('button', { class: `candy small ${p.active ? '' : 'gold'}`, 'data-test': 'walk-pet', onclick: () => this.actions.walkPet(sp.id, !p.active) }, p.active ? 'Cho về nhà' : 'Dắt đi'));
    if (p.active) {
      const sel = h('select', { class: 'pet-floor', 'data-test': 'guard-floor', onchange: (e: Event) => this.actions.guardFloor(sp.id, Number((e.target as HTMLSelectElement).value)) });
      state.floors.forEach((f, i) => {
        const o = h('option', { value: String(i) }, `Trông tầng ${i + 1}: ${content.floors.get(f.floorId)?.name.vi ?? ''}`) as HTMLOptionElement;
        if (i === p.floor) o.selected = true;
        sel.append(o);
      });
      act.append(sel);
    }
    if (sp.skills.some((s) => s.id === 'jadeRain')) {
      const ready = (p.skillAt.jadeRain ?? 0) <= now;
      act.append(h('button', { class: `candy small ${ready && working ? 'gold' : 'blocked'}`, 'data-test': 'jade-rain', onclick: () => this.actions.jadeRain() }, ready ? 'Mưa Ngọc' : `Mưa Ngọc · ${formatClock(p.skillAt.jadeRain! - now)}`));
    }
    const star = nextPetStar(content, p);
    if (star) {
      const ok = p.level >= star.minLevel && state.player.coins >= star.coins && (state.inventory[sp.badge] ?? 0) >= star.badges;
      const btn = h('button', { class: `candy small ${ok ? 'gold' : 'blocked'}`, 'data-test': 'star-pet', onclick: () => (ok ? this.actions.starUpPet(sp.id) : shake(btn)) }, `Lên ${p.stars + 1}★ · `, itemIcon(content, sp.badge, 16), `${Math.min(state.inventory[sp.badge] ?? 0, star.badges)}/${star.badges} · ${star.bugs} bọ ${star.bugRarity === 'good' ? 'Khá' : star.bugRarity === 'rare' ? 'Hiếm' : 'Rất hiếm'} · `, coin(14), formatNumber(star.coins), p.level < star.minLevel ? ` · cần cấp ${star.minLevel}` : '');
      act.append(btn);
    }
    info.append(act);
    if (this.feeding) {
      const foods = Object.entries(state.inventory)
        .filter(([id, q]) => q > 0 && foodKind(content, sp.id, id))
        .sort((a, b) => (foodKind(content, sp.id, a[0]) === 'liked' ? -1 : 0) - (foodKind(content, sp.id, b[0]) === 'liked' ? -1 : 0));
      const list = h('div', { class: 'pet-foods' });
      if (foods.length === 0) list.append(h('p', { class: 'note' }, 'Kho chưa có món bé ăn được (nông sản, hàng chế biến).'));
      for (const [id, q] of foods.slice(0, 16)) {
        const liked = foodKind(content, sp.id, id) === 'liked';
        list.append(h('button', { class: `food-btn${liked ? ' liked' : ''}`, title: liked ? 'Món bé thích: Thân Thiết ×3' : '', onclick: () => this.actions.feedPet(sp.id, id) }, itemIcon(content, id, 34), h('span', {}, `×${q}`), liked ? h('span', { class: 'heart' }, '♥') : null));
      }
      info.append(list);
    }
    return h('div', { class: 'pet-detail' }, pat, info);
  }
}
