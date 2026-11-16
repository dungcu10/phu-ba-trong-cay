// REDESIGN_V2 windows and bars: floor sign (stars, expansion, pot sets), daily missions,
// the seed tray at the bottom (drag a seed onto pots), and the bar shown while visiting.

import { itemIcon } from './icons.ts';
import type { GameSession } from '../app/session.ts';
import type { MissionDef } from '../core/content.ts';
import { itemFrame } from '../render/assets.ts';
import { expandCost, floorSets, nextStar } from '../systems/floors.ts';
import { allMissionsClaimed, dayEndsAt, missionDef } from '../systems/missions.ts';
import { helpReward, helpsLeft } from '../systems/visit.ts';
import { clear, h, icon } from './dom.ts';
import { Panel } from './panel.ts';
import { missionPotBox, type PotSystemActions } from './potSystemPanels.ts';
import { potIcon, shake } from './potPanels.ts';
import { FAMILY_TEXT, formatClock, formatNumber, formatPercent, STAT_TEXT } from './text.ts';
import { coin, gem } from './worldPanels.ts';

export interface GardenActions {
  expandFloor(floor: number): void;
  upgradeFloorStar(floor: number): void;
  claimMission(index: number): void;
  claimMissionBonus(): void;
}

const statText = (stats: Partial<Record<string, number>>) =>
  Object.entries(stats)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${STAT_TEXT[k] ?? k} +${formatPercent(v ?? 0)}`)
    .join(', ');

function stars(n: number, max: number): HTMLElement {
  return h('span', { class: 'stars' }, ...Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '' })));
}

/** Tapping a floor's wooden sign (or its "+" spot): stars, expansion and pot sets of that floor. */
export class FloorInfoPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly floor: number,
    private readonly actions: GardenActions,
  ) {
    const def = session.content.floors.get(session.state.floors[floor]!.floorId)!;
    super(def.name.vi, 'floor-info', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const floor = state.floors[this.floor]!;
    const def = content.floors.get(floor.floorId)!;
    const p = state.player;
    if (def.trait) this.body.append(h('div', { class: 'trait' }, `Đặc tính tầng: cây ${FAMILY_TEXT[def.trait.family] ?? def.trait.family} ${STAT_TEXT[def.trait.stat] ?? def.trait.stat} +${formatPercent(def.trait.value)}`));

    // Expansion.
    const cost = expandCost(def, floor);
    const exp = h('section', { class: 'card' }, h('h3', {}, `Vị trí chậu ${floor.slots.length}/${def.maxSlots}`));
    if (cost === null) exp.append(h('p', { class: 'note' }, 'Tầng đã mở rộng hết.'));
    else {
      const ok = p.coins >= cost;
      const btn = h('button', { class: `candy ${ok ? 'primary' : 'blocked'}`, 'data-test': 'expand-floor', onclick: () => (ok ? this.actions.expandFloor(this.floor) : shake(btn)) }, 'Thêm một chậu');
      exp.append(
        h('p', { class: 'note' }, 'Thêm vị trí ở cuối hàng, có sẵn chậu đất nung. Chậu ít thì to, chậu nhiều thì thu nhiều hơn.'),
        h('div', { class: 'candy-wrap' }, h('span', { class: `need${ok ? '' : ' short'}` }, coin(22), formatNumber(cost)), btn, h('span', { class: 'reason' }, ok ? '' : `Thiếu ${formatNumber(cost - p.coins)} xu`)),
      );
    }

    // Stars.
    const bonus = content.config.floorStarBonus ?? {};
    const starCard = h('section', { class: 'card' }, h('h3', {}, 'Sao tầng ', stars(floor.stars, def.stars.length)));
    starCard.append(h('p', { class: 'note' }, floor.stars > 0 ? `Mọi chậu trên tầng: ${statText(Object.fromEntries(Object.entries(bonus).map(([k, v]) => [k, (v ?? 0) * floor.stars])))}` : `Mỗi sao: mọi chậu trên tầng ${statText(bonus)}.`));
    const next = nextStar(def, floor);
    if (!next) starCard.append(h('p', { class: 'note' }, 'Đã đủ sao.'));
    else {
      const needs = h('div', { class: 'needs' }, h('span', { class: `need${p.level < next.level ? ' short' : ''}` }, `Cấp ${next.level}`), h('span', { class: `need${p.coins < next.coins ? ' short' : ''}` }, coin(22), formatNumber(next.coins)));
      const missing: string[] = [];
      if (p.level < next.level) missing.push(`cần cấp ${next.level}`);
      if (p.coins < next.coins) missing.push(`${formatNumber(next.coins - p.coins)} xu`);
      for (const [id, q] of Object.entries(next.items)) {
        const have = state.inventory[id] ?? 0;
        needs.append(h('span', { class: `need${have < q ? ' short' : ''}` }, itemIcon(content, id, 30), `${have}/${q}`));
        if (have < q) missing.push(`${q - have} ${content.items.get(id)?.name.vi ?? ''}`);
      }
      const ok = missing.length === 0;
      const btn = h('button', { class: `candy ${ok ? 'gold' : 'blocked'}`, 'data-test': 'star-floor', onclick: () => (ok ? this.actions.upgradeFloorStar(this.floor) : shake(btn)) }, `Lên ${floor.stars + 1} sao`);
      starCard.append(needs, h('div', { class: 'candy-wrap' }, btn, h('span', { class: 'reason' }, ok ? '' : `Thiếu ${missing.join(', ')}`)));
    }

    // Pot sets.
    const sets = floorSets(content, state, floor);
    const setCard = h('section', { class: 'card' }, h('h3', {}, 'Bộ chậu trên tầng'));
    setCard.append(h('p', { class: 'note' }, 'Đặt nhiều chậu cùng bộ trên một tầng: đủ 4 rồi 6 chậu thì cả tầng được thưởng.'));
    for (const set of content.potSets.values()) {
      const a = sets.find((x) => x.set.id === set.id);
      const count = a?.count ?? 0;
      const members = content.potList.filter((pd) => pd.set === set.id);
      const tiers = set.tiers.map((t) => h('span', { class: `set-tier${count >= t.count ? ' on' : ''}` }, `${t.count} chậu: ${statText(t.stats)}`));
      setCard.append(h('div', { class: `set-row${count > 0 ? ' active' : ''}` }, h('span', { class: 'set-pots' }, ...members.map((m) => potIcon(m, 1, 40))), h('span', { class: 'set-main' }, h('strong', {}, `${set.name.vi} · ${count} chậu`), ...tiers)));
    }
    this.body.append(h('div', { class: 'cards' }, exp, starCard), setCard);
  }
}

/** "Nhiệm Vụ Hôm Nay": three missions with progress, rewards, and a bonus when all are done. */
export class MissionsPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: GardenActions,
    private readonly potActions: PotSystemActions,
  ) {
    super('Nhiệm Vụ Hôm Nay', 'missions-panel', 'win-wide');
    this.render();
  }

  private reward(r: MissionDef['reward']): HTMLElement {
    const items = Object.entries(r.items ?? {}).map(([id, q]) => h('span', { class: 'tag', title: this.session.content.items.get(id)?.name.vi ?? '' }, itemIcon(this.session.content, id, 20), String(q)));
    return h('span', { class: 'reward' }, r.coins > 0 && h('span', { class: 'tag' }, coin(16), formatNumber(r.coins)), r.xp > 0 && h('span', { class: 'tag xp' }, `${r.xp} XP`), r.gems > 0 && h('span', { class: 'tag' }, gem(16), String(r.gems)), ...items);
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    this.body.append(h('p', { class: 'lead' }, `Đổi nhiệm vụ mới sau ${formatClock(dayEndsAt(content, now) - now)}`));
    const list = h('div', { class: 'missions' });
    state.missions.list.forEach((m, i) => {
      const def = missionDef(content, m.id);
      if (!def) return;
      const done = m.progress >= def.target;
      const pct = Math.min(100, (m.progress / def.target) * 100);
      const btn = m.claimed
        ? h('span', { class: 'claimed' }, 'Đã nhận')
        : h('button', { class: `candy ${done ? 'gold' : 'blocked'}`, 'data-test': `claim-mission-${i}`, onclick: () => (done ? this.actions.claimMission(i) : shake(btn)) }, 'Nhận');
      list.append(
        h(
          'div',
          { class: `mission${done ? ' done' : ''}${m.claimed ? ' claimed' : ''}` },
          h('span', { class: 'mission-main' }, h('strong', {}, def.name.vi), h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'note' }, `${m.progress}/${def.target}`)),
          this.reward(def.reward),
          btn,
        ),
      );
    });
    const all = allMissionsClaimed(state);
    const bonus = content.missions.allDone;
    const bonusBtn = state.missions.bonusClaimed
      ? h('span', { class: 'claimed' }, 'Đã nhận')
      : h('button', { class: `candy ${all ? 'primary' : 'blocked'}`, 'data-test': 'claim-mission-bonus', onclick: () => (all ? this.actions.claimMissionBonus() : shake(bonusBtn)) }, 'Nhận quà');
    list.append(h('div', { class: 'mission bonus' }, h('span', { class: 'mission-main' }, h('strong', {}, 'Xong cả 3 nhiệm vụ'), h('span', { class: 'note' }, 'Quà thêm cho người chăm chỉ')), this.reward(bonus), bonusBtn));
    this.body.append(list);
    const pots = missionPotBox(this.session, this.potActions);
    if (pots) this.body.append(pots);
  }
}

export interface SeedTrayActions {
  /** Plant a crop in one pot (returns false if it failed, e.g. not enough coins). */
  plantAt(screenX: number, screenY: number, cropId: string): boolean;
  selectSeed(cropId: string): void;
  openSeedShop(): void;
}

/** Seed tray along the bottom: drag a packet across empty pots to plant, or tap to choose it. */
export class SeedTray {
  readonly el: HTMLElement;
  private readonly row = h('div', { class: 'tray-row scroll-x' });
  private ghost: HTMLElement | null = null;
  private selected: string | null = null;
  private lastKey = '';

  constructor(
    private readonly session: GameSession,
    private readonly actions: SeedTrayActions,
    onClose: () => void,
  ) {
    const close = h('button', { class: 'knob close small', 'aria-label': 'Đóng khay hạt', onclick: onClose });
    const more = h('button', { class: 'tray-more', 'data-test': 'seed-shop', onclick: () => actions.openSeedShop() }, 'Chi tiết');
    this.el = h('div', { class: 'seed-tray hidden', 'data-test': 'seed-tray' }, h('div', { class: 'tray-hint' }, 'Kéo hạt vào chậu trống'), this.row, more, close);
  }

  get open(): boolean {
    return !this.el.classList.contains('hidden');
  }

  show(on: boolean): void {
    this.el.classList.toggle('hidden', !on);
    if (on) this.render();
  }

  render(): void {
    const { content, state } = this.session;
    const key = `${state.player.level}|${state.player.coins >= 0 ? content.cropList.map((c) => c.seedPrice <= state.player.coins).join() : ''}|${this.selected}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    clear(this.row);
    for (const crop of content.cropList) {
      const locked = crop.unlockLevel > state.player.level;
      const poor = crop.seedPrice > state.player.coins;
      const chip = h(
        'button',
        { class: `seed-chip${locked ? ' locked' : ''}${poor && !locked ? ' poor' : ''}${this.selected === crop.id ? ' on' : ''}`, 'data-test': `tray-${crop.id}`, 'aria-label': crop.name.vi },
        icon(`${crop.sprite}/${crop.stages - 1}`, 54),
        h('span', { class: 'chip-price' }, locked ? `Cấp ${crop.unlockLevel}` : crop.seedPrice === 0 ? 'Miễn phí' : formatNumber(crop.seedPrice)),
      );
      if (!locked) chip.addEventListener('pointerdown', (e) => this.startDrag(e, crop.id, crop.sprite, crop.stages));
      this.row.append(chip);
    }
  }

  private startDrag(e: PointerEvent, cropId: string, sprite: string, stages: number): void {
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
        dragging = true;
        this.ghost = h('div', { class: 'seed-ghost' }, icon(`${sprite}/${Math.min(1, stages - 1)}`, 70));
        document.body.append(this.ghost);
      }
      if (!dragging || !this.ghost) return;
      this.ghost.style.transform = `translate(${ev.clientX - 35}px, ${ev.clientY - 60}px)`;
      // Seeds fall into every empty pot the finger passes over.
      this.actions.plantAt(ev.clientX, ev.clientY, cropId);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.ghost?.remove();
      this.ghost = null;
      if (!dragging) {
        this.selected = cropId;
        this.actions.selectSeed(cropId);
        this.render();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
}

/** Shown instead of the HUD while visiting a neighbour's garden. */
export class VisitBar {
  readonly el: HTMLElement;
  private readonly info = h('span', { class: 'visit-info' });

  constructor(
    private readonly session: GameSession,
    readonly botId: string,
    onHome: () => void,
  ) {
    const bot = session.content.bots.get(botId)!;
    this.el = h(
      'div',
      { class: 'visit-bar', 'data-test': 'visit-bar' },
      h('span', { class: 'visit-name' }, `Vườn của ${bot.name.vi}`),
      this.info,
      h('button', { class: 'candy primary', 'data-test': 'visit-home', onclick: onHome }, 'Về vườn mình'),
    );
    this.update();
  }

  update(): void {
    const { content, state } = this.session;
    const s = state.neighbors[this.botId]!;
    const left = helpsLeft(content, s, this.session.now());
    const r = helpReward(content, s);
    this.info.textContent = left > 0 ? `Cấp ${s.level} · Chạm chậu khát nước hoặc có Bọ Mây để giúp · còn ${left} lượt (+${formatNumber(r.coins)} xu mỗi lượt)` : `Cấp ${s.level} · Hôm nay đã giúp đủ, mai ghé tiếp nhé!`;
  }
}
