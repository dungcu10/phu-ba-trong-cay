// Chỉ thị 11 TỔNG § D: the village window — the eight houses with their roof bubbles, levels and
// upgrades (timer runs while the game is closed; the house stays usable), Cấp Làng and its next
// milestone, the 7-day check-in and the Huy Chương Độ Cao. Each house opens its feature. Reads state,
// sends commands only. (The village drawn on the ground under floor 1 uses the same rules.)

import type { GameSession } from '../app/session.ts';
import { checkInReady, houseLevel, houseOpen, nextHouseCost, upgrading, villageLevel } from '../systems/village.ts';
import { houseAlerts } from '../systems/villageAlerts.ts';
import { itemIcon } from './icons.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { formatClock, formatNumber } from './text.ts';
import { coin, gem } from './worldPanels.ts';

export interface VillageActions {
  upgradeHouse(house: string): void;
  claimCheckIn(): void;
  openHouse(feature: string): void;
}

export class VillagePanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: VillageActions,
  ) {
    super('Làng Phú Bà', 'village-panel', 'win-wide');
    this.render();
  }

  /** Countdowns only (every second). */
  tick(): void {
    const now = this.session.now();
    for (const el of this.body.querySelectorAll<HTMLElement>('[data-ends]')) {
      el.textContent = formatClock(Math.max(0, Number(el.dataset.ends) - now));
    }
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const v = content.village;
    if (!v) return;
    const now = this.session.now();
    const vl = villageLevel(content, state);
    const next = v.villageLevels.find((m) => m.level > vl);
    const perk = (m: (typeof v.villageLevels)[number]) =>
      m.upgradeTime ? `nâng nhà nhanh hơn ${Math.round(-m.upgradeTime * 100)}%` : m.buildSlots ? 'thêm 1 ô nâng nhà' : m.helpPerDay ? '+1 lượt nhờ hàng xóm góp hàng' : m.orderXp ? `+${Math.round(m.orderXp * 100)}% EXP khi giao đơn` : m.title ? `danh hiệu "${m.title.vi}"` : '';
    // Check-in strip.
    const ci = state.village.checkIn;
    const ready = checkInReady(content, state, now);
    const strip = h('div', { class: 'checkin-strip' });
    v.checkIn.forEach((r, i) => {
      const done = i < ci.count % 7 || (!ready && ci.count % 7 === 0 && ci.count > 0);
      const today = ready && i === ci.count % 7;
      const label = r.gems ? [gem(16), `${r.gems}`] : r.coins ? [coin(16), formatNumber(r.coins)] : Object.entries(r.items ?? {}).map(([id, q]) => h('span', {}, itemIcon(content, id, 20), `×${q}`));
      strip.append(h('div', { class: `checkin-day${done ? ' done' : ''}${today ? ' today' : ''}` }, h('span', { class: 'note' }, `Ngày ${i + 1}`), ...label));
    });
    const medals = h(
      'div',
      { class: 'medal-row' },
      ...v.medals.map((m) => {
        const pic = icon(m.icon.replace(/^art:/, ''), 40);
        if (!state.village.medals.includes(m.floor)) pic.classList.add('medal-off');
        return h('span', { class: 'medal', title: `${m.name.vi} — mở tầng ${m.floor}` }, pic);
      }),
    );
    this.body.append(
      h(
        'div',
        { class: 'village-head' },
        h('div', { class: 'village-level' }, h('strong', {}, `Cấp Làng ${vl}`), h('span', { class: 'note' }, next ? `Cấp Làng ${next.level}: ${perk(next)}` : 'Đã đủ mọi mốc Cấp Làng')),
        medals,
      ),
      // Chỉ thị 12 A7 G1: the boards that are not a house.
      h('div', { class: 'village-links' }, h('button', { class: 'candy small', 'data-test': 'village-neighbors', onclick: () => this.actions.openHouse('neighbors') }, 'Bảng Phú Bà'), h('button', { class: 'candy small', 'data-test': 'village-journal', onclick: () => this.actions.openHouse('journal') }, 'Sổ Tay Thực Vật')),
      h('div', { class: 'checkin' }, strip, h('button', { class: `candy small ${ready ? 'gold' : 'blocked'}`, disabled: ready ? undefined : true, 'data-test': 'check-in', onclick: () => this.actions.claimCheckIn() }, ready ? 'Điểm danh' : 'Mai quay lại nhé')),
    );
    // Houses.
    const alerts = houseAlerts(content, state, now);
    const busy = upgrading(state, now);
    const grid = h('div', { class: 'house-grid' });
    for (const hd of [...v.houses].sort((a, b) => a.plot - b.plot)) {
      const open = houseOpen(content, state, hd.id);
      const lv = houseLevel(state, hd.id);
      const b = state.buildings[hd.id];
      const working = b?.upgradeEndsAt != null && b.upgradeEndsAt > now;
      const bubble = alerts.find((a) => a.house === hd.id);
      const pic = h('div', { class: `house-pic lv${lv}` }, icon(hd.art, 140), working ? icon('village/scaffold', 110) : null, working ? icon('xuxu/builder', 64) : null, bubble ? h('span', { class: 'roof-bubble', title: bubble.text }, '!') : null);
      const card = h('div', { class: `house-card${open ? '' : ' locked'}`, 'data-test': `house-${hd.id}` }, pic, h('strong', {}, hd.name.vi), open ? h('span', { class: 'note' }, `Cấp ${lv}/5${bubble ? ` · ${bubble.text}` : ''}`) : h('span', { class: 'note' }, `🔒 Mở ở cấp ${hd.unlockLevel}`));
      if (open) {
        const row = h('div', { class: 'house-actions' }, h('button', { class: 'candy small primary', 'data-test': `enter-${hd.id}`, onclick: () => this.actions.openHouse(hd.feature) }, 'Vào'));
        const cost = nextHouseCost(content, state, hd.id);
        if (working) row.append(h('span', { class: 'tag' }, 'Đang nâng · ', h('span', { 'data-ends': String(b!.upgradeEndsAt) }, formatClock(b!.upgradeEndsAt! - now))));
        else if (cost && state.player.level >= v.upgradeFromLevel) {
          const have = Object.entries(cost.items).every(([id, q]) => (state.inventory[id] ?? 0) >= q) && state.player.coins >= cost.coins;
          const btn = h(
            'button',
            { class: `candy small up-btn ${have && busy.length === 0 ? 'gold' : 'blocked'}`, 'data-test': `upgrade-${hd.id}`, onclick: () => (have ? this.actions.upgradeHouse(hd.id) : shake(btn)) },
            h('span', { class: 'up-title' }, `Lên cấp ${lv + 1} · ${formatClock(cost.ms)}`),
            h(
              'span',
              { class: 'up-cost' },
              coin(14),
              formatNumber(cost.coins),
              ...Object.entries(cost.items).map(([id, q]) => h('span', { class: (state.inventory[id] ?? 0) >= q ? '' : 'short' }, itemIcon(content, id, 18), `${Math.min(state.inventory[id] ?? 0, q)}/${q}`)),
            ),
          );
          row.append(btn);
        } else if (!cost) row.append(h('span', { class: 'tag' }, 'Cấp tối đa'));
        else row.append(h('span', { class: 'note' }, `Nâng nhà mở ở cấp ${v.upgradeFromLevel}`));
        card.append(row);
      }
      grid.append(card);
    }
    // The river (fishing) and the plot kept for later.
    const fishOpen = !!content.fishing && state.player.level >= content.fishing.unlockLevel;
    const river = alerts.find((a) => a.house === 'river');
    grid.append(
      h('div', { class: `house-card${fishOpen ? '' : ' locked'}`, 'data-test': 'house-river' }, h('div', { class: 'house-pic' }, icon('village/rod', 120), river ? h('span', { class: 'roof-bubble' }, '!') : null), h('strong', {}, 'Bến Câu Cá'), h('span', { class: 'note' }, fishOpen ? (river?.text ?? 'Câu cá trên sông') : `🔒 Mở ở cấp ${content.fishing?.unlockLevel ?? '?'}`), fishOpen ? h('div', { class: 'house-actions' }, h('button', { class: 'candy small primary', onclick: () => this.actions.openHouse('fishing') }, 'Vào')) : null),
      h('div', { class: 'house-card locked' }, h('div', { class: 'house-pic' }, icon('village/sign', 120), h('span', { class: 'sign-text' }, 'Dinh Phú Bà')), h('strong', {}, 'Dinh Phú Bà'), h('span', { class: 'note' }, 'Sắp xây')),
    );
    this.body.append(grid);
  }
}
