// Pot system windows (docs/POT_SYSTEM.md 6–7): the pot window (big picture, level 1–50 track,
// stats now → next, skills, materials, upgrade with an evolution animation, history, stock),
// the Pot Collection (by source, rarity, search; unowned shown dark; Level 50 badge; rewards),
// and the event window (points, milestone track, exclusive pot).

import type { GameSession } from '../app/session.ts';
import type { SlotRef } from '../core/game.ts';
import { shardId, type PotDef, type PotGroup, type PotStatName } from '../core/content.ts';
import type { PotInstance } from '../core/state.ts';
import { nextStarShards } from '../systems/potStars.ts';
import { cropStatus } from '../systems/growth.ts';
import { canAfford, isMilestone, nextUpgradeCost, potLook, potStat, STAGE_NAMES, stageOf, upgradeBlock } from '../systems/pots.ts';
import { claimableMilestones, visibleEvents } from '../systems/events.ts';
import { clear, h } from './dom.ts';
import { itemIcon, svgIcon } from './icons.ts';
import { Panel } from './panel.ts';
import { potIcon, rarityChip, shake } from './potPanels.ts';
import { ERROR_TEXT, formatClock, formatDate, formatDuration, formatNumber, GROUP_TEXT, RARITY_TEXT, STAT_TEXT, formatStat } from './text.ts';
import { coin, gem } from './worldPanels.ts';

export interface PotSystemActions {
  upgradePot(potInstanceId: string): void;
  placePot(slot: SlotRef, potInstanceId: string): void;
  obtainPot(potId: string): void;
  claimEventMilestone(eventId: string): void;
  claimBookReward(): void;
  openCollection(): void;
  starUpPot(potInstanceId: string): void;
}

const SOURCE_TEXT: Record<string, string> = { start: 'Có sẵn từ đầu', shop: 'Mua ở Lò Gốm', floor: 'Có sẵn khi mở tầng', exchange: 'Đổi bằng Ấn Công Trạng', event: 'Phần thưởng sự kiện', 'old-save': 'Từ bản lưu cũ', quest: 'Thưởng nhiệm vụ', cast: 'Đúc ở Lò Gốm', bazaar: 'Săn ở Chợ Mây', sea: 'Rương Biển Mây', combine: 'Ghép từ mảnh chậu' };

/** All stats a pot line ever has, in a stable order. */
function lineStats(def: PotDef): PotStatName[] {
  const order: PotStatName[] = ['speed', 'yield', 'xp', 'luck', 'attract', 'care'];
  const used = new Set(def.levels.flatMap((l) => Object.keys(l.stats)));
  for (const s of def.skills) if (s.effect.kind === 'stat') used.add(s.effect.stat);
  return order.filter((s) => used.has(s));
}

/** Level 1–50 track: filled up to the level, a mark at every evolution milestone, a lock past what is open. */
function levelTrack(def: PotDef, level: number): HTMLElement {
  const max = def.levels.length;
  const track = h('div', { class: 'lv-track', 'aria-label': `Cấp ${level}/${max}` }, h('i', { class: 'lv-fill', style: `width:${(level / max) * 100}%` }), h('i', { class: 'lv-open', style: `left:${(def.openTo / max) * 100}%` }));
  for (const l of def.looks) if (l.from > 1) track.append(h('b', { class: `lv-mark${level >= l.from ? ' on' : ''}`, style: `left:${((l.from - 0.5) / max) * 100}%`, title: `Cấp ${l.from}: ${l.name.vi}` }));
  return track;
}

/** The pot window for one slot. */
export class PotPanel extends Panel {
  private lastLevel = -1;

  constructor(
    private readonly session: GameSession,
    private readonly slot: SlotRef,
    private readonly actions: PotSystemActions,
  ) {
    super('Chậu Cây', 'pot-panel', 'win-wide win-pot');
    this.render();
  }

  private get potId(): string {
    return this.session.state.floors[this.slot.floor]!.slots[this.slot.slot]!.potInstanceId;
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const slotState = state.floors[this.slot.floor]!.slots[this.slot.slot]!;
    const pot = state.pots[slotState.potInstanceId]!;
    const def = content.pots.get(pot.potId)!;
    const max = def.levels.length;
    const { look } = potLook(def, pot.level);
    const status = cropStatus(content, state, slotState, this.session.now());

    // Header: big picture + identity.
    const pic = h('div', { class: 'pot-hero', 'data-test': 'pot-hero' }, potIcon(def, pot.level, 190), h('span', { class: 'stage-badge' }, STAGE_NAMES[stageOf(pot.level)]!));
    const id = h(
      'div',
      { class: 'pot-id' },
      h('h3', {}, def.name.vi),
      h('div', { class: 'chips' }, rarityChip(def.rarity), h('span', { class: `group-chip g-${def.group}` }, GROUP_TEXT[def.group] ?? def.group)),
      h('p', { class: 'pot-desc' }, def.description?.vi ?? ''),
      h('div', { class: 'lv-line' }, h('strong', { 'data-test': 'pot-level' }, `Cấp ${pot.level}`), h('span', {}, `/${max}`), look && h('em', {}, ` · ${look.name.vi}`)),
      levelTrack(def, pot.level),
      status && h('p', { class: 'note left' }, status.ripe ? `${status.crop.name.vi} đã chín — chạm chậu để thu.` : `${status.crop.name.vi} chín sau ${formatDuration(status.remainingMs)}`),
    );
    this.body.append(h('div', { class: 'pot-head' }, pic, id));

    // Stats now → next.
    const next = def.levels[pot.level];
    const nextPot = { ...pot, level: pot.level + 1 };
    const rows = lineStats(def).map((s) => {
      const now = potStat(content, pot, s);
      const after = next ? potStat(content, nextPot, s) : now;
      return h('div', { class: 'stat-row' }, h('span', {}, STAT_TEXT[s] ?? s), h('b', {}, formatStat(now)), after > now ? h('span', { class: 'up' }, `→ ${formatStat(after)}`) : h('span', {}, ''));
    });
    const skills = def.skills.map((sk) =>
      h('div', { class: `skill${pot.level >= sk.level ? ' on' : ''}` }, h('span', { class: 'skill-lv' }, `Cấp ${sk.level}`), h('span', { class: 'skill-main' }, h('strong', {}, sk.name.vi), h('span', {}, sk.desc.vi))),
    );
    this.body.append(h('div', { class: 'cards' }, h('section', { class: 'card' }, h('h3', {}, 'Chỉ số'), ...rows), h('section', { class: 'card' }, h('h3', {}, 'Kỹ năng'), ...skills)));

    // Upgrade, then stars from shards (chỉ thị 12 B7).
    this.body.append(this.upgradeCard(def, pot, slotState.potInstanceId));
    const starCard = this.starCard(pot, slotState.potInstanceId);
    if (starCard) this.body.append(starCard);

    // History and owner record.
    const hist = (pot.history ?? []).slice(-3).reverse().map((e) => h('span', {}, `Cấp ${e.level} · ${formatDate(e.at)}`));
    this.body.append(
      h('section', { class: 'card history' }, h('h3', {}, 'Lịch sử'), h('p', { class: 'note left' }, `${SOURCE_TEXT[pot.source ?? 'old-save'] ?? ''}${pot.obtainedAt ? ` · nhận ${formatDate(pot.obtainedAt)}` : ''} · cao nhất từng đạt: cấp ${state.potBook[pot.potId]?.bestLevel ?? pot.level}`), h('div', { class: 'hist' }, ...hist), h('button', { class: 'candy small plain', onclick: () => this.actions.openCollection() }, 'Bộ Sưu Tập Chậu')),
    );
    this.body.append(this.stock(slotState.planting !== null));

    if (this.lastLevel >= 0 && pot.level > this.lastLevel) this.playUpgrade(def, pot.level);
    this.lastLevel = pot.level;
  }

  /** Pot stars ★0–★5 raised with this kind's shards; each star adds to the main stats. */
  private starCard(pot: PotInstance, instanceId: string): HTMLElement | null {
    const { content, state } = this.session;
    const ps = content.potStars;
    if (!ps) return null;
    const stars = pot.stars ?? 0;
    const need = nextStarShards(content, pot);
    const have = state.inventory[shardId(pot.potId)] ?? 0;
    const per = Math.round((content.casting?.starStatBonus ?? 0) * 100);
    const row = h('span', { class: 'pot-stars', 'data-test': 'pot-stars' }, ...Array.from({ length: ps.maxStars }, (_, i) => h('i', { class: i < stars ? 'on' : '' }, '★')));
    const card = h('section', { class: 'card pot-star-card' }, h('h3', {}, 'Sao chậu ', row));
    card.append(h('p', { class: 'note left' }, `Mỗi sao: chỉ số chính +${per}% và chậu sáng hơn. Mảnh chậu có từ chậu trùng loại (tự đổi thành ${ps.duplicateShards} mảnh), Chợ Mây và Biển Mây.`));
    if (need === null) {
      card.append(h('p', { class: 'note' }, 'Chậu đã đủ sao.'));
      return card;
    }
    const ok = have >= need;
    const btn = h(
      'button',
      { class: `candy ${ok ? 'gold' : 'blocked'}`, 'data-test': 'star-up-pot', onclick: () => (ok ? this.actions.starUpPot(instanceId) : shake(btn)) },
      itemIcon(content, shardId(pot.potId), 26),
      ` ${Math.min(have, need)}/${need} mảnh · Lên ★${stars + 1}`,
    );
    card.append(h('div', { class: 'candy-wrap' }, btn));
    return card;
  }

  private upgradeCard(def: PotDef, pot: { potId: string; level: number }, instanceId: string): HTMLElement {
    const { content, state } = this.session;
    const card = h('section', { class: 'card upgrade' });
    const block = upgradeBlock(content, state, pot as never);
    if (block === 'max_level') return h('section', { class: 'card upgrade' }, h('h3', {}, 'Đã đạt cấp tối thượng'), h('span', { class: 'badge50' }, 'Lv 50'));
    if (block === 'level_not_open') {
      card.append(h('h3', {}, `Cấp ${pot.level + 1}–${def.levels.length}`), h('p', { class: 'note' }, ERROR_TEXT.level_not_open));
      return card;
    }
    const cost = nextUpgradeCost(content, pot as never)!;
    const nextLevel = pot.level + 1;
    const milestone = isMilestone(def, nextLevel);
    const nextLook = potLook(def, nextLevel).look;
    const preview = h(
      'div',
      { class: `preview${milestone ? ' evolve' : ''}` },
      potIcon(def, nextLevel, 96),
      h('span', {}, milestone ? `Tiến hóa: ${nextLook?.name.vi ?? ''}` : `Cấp ${nextLevel}: thêm một đinh vàng`),
      ...def.skills.filter((s) => s.level === nextLevel).map((s) => h('span', { class: 'new-skill' }, `Mở kỹ năng: ${s.name.vi}`)),
    );
    const needs = h('div', { class: 'needs' }, h('span', { class: `need${state.player.coins < cost.coins ? ' short' : ''}` }, coin(22), formatNumber(cost.coins)));
    const missing: string[] = [];
    if (state.player.coins < cost.coins) missing.push(`${formatNumber(cost.coins - state.player.coins)} xu`);
    for (const [itemId, qty] of Object.entries(cost.items)) {
      const have = state.inventory[itemId] ?? 0;
      needs.append(h('span', { class: `need${have < qty ? ' short' : ''}`, title: content.items.get(itemId)?.name.vi ?? '' }, itemIcon(content, itemId, 30), `${have}/${qty}`));
      if (have < qty) missing.push(`${qty - have} ${content.items.get(itemId)?.name.vi ?? ''}`);
    }
    const req = def.levelReq[pot.level] ?? 1;
    if (block === 'locked') missing.unshift(`cần cấp người chơi ${req}`);
    const ok = !block && canAfford(state, cost);
    const btn = h('button', { class: `candy ${ok ? (milestone ? 'gold' : 'primary') : 'blocked'}`, 'data-test': 'upgrade-pot', onclick: () => (ok ? this.actions.upgradePot(instanceId) : shake(btn)) }, milestone ? 'Tiến hóa!' : `Nâng lên cấp ${nextLevel}`);
    card.append(h('h3', {}, 'Nâng cấp'), h('div', { class: 'upgrade-row' }, preview, h('div', { class: 'upgrade-main' }, needs, h('div', { class: 'candy-wrap' }, btn, h('span', { class: 'reason' }, ok ? 'Nâng cấp không bao giờ thất bại.' : `Thiếu ${missing.join(', ')}`)))));
    return card;
  }

  /** Materials gather into the pot, it flashes and swaps to the new look; milestone and skills announced. */
  private playUpgrade(def: PotDef, level: number): void {
    const hero = this.body.querySelector('.pot-hero') as HTMLElement | null;
    if (!hero) return;
    hero.classList.add('evolving');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sp = h('i', { class: 'converge', style: `--dx:${Math.cos(a) * 150}px;--dy:${Math.sin(a) * 110}px;animation-delay:${i * 30}ms` });
      hero.append(sp);
    }
    const lines = [`Cấp ${level}!`];
    if (isMilestone(def, level)) lines.push(`Tiến hóa: ${potLook(def, level).look?.name.vi ?? ''}`);
    for (const s of def.skills.filter((x) => x.level === level)) lines.push(`Kỹ năng mới: ${s.name.vi}`);
    hero.append(h('div', { class: 'evolve-banner' }, ...lines.map((l) => h('span', {}, l))));
  }

  private stock(busy: boolean): HTMLElement {
    const { content, state } = this.session;
    const box = h('section', { class: 'card' }, h('h3', {}, `Kho chậu (${state.potStock.length})`));
    if (state.potStock.length === 0) {
      box.append(h('p', { class: 'note' }, 'Kho chậu trống. Mua ở Lò Gốm, đổi Ấn ở Nhiệm vụ, hoặc nhận từ sự kiện.'));
      return box;
    }
    if (busy) box.append(h('p', { class: 'note' }, 'Thu hoạch xong cây này rồi mới đổi chậu được.'));
    const list = h('div', { class: 'stock' });
    for (const sid of state.potStock) {
      const p = state.pots[sid]!;
      const d = content.pots.get(p.potId)!;
      list.append(h('button', { class: `seed-pack${busy ? ' locked' : ''}`, 'data-test': `place-${sid}`, 'aria-disabled': busy ? 'true' : undefined, onclick: () => (busy ? undefined : this.actions.placePot(this.slot, sid)) }, potIcon(d, p.level, 64), h('span', { class: 'pack-info' }, `${d.name.vi} · cấp ${p.level}`)));
    }
    box.append(list);
    return box;
  }

  get instanceId(): string {
    return this.potId;
  }
}

const GROUP_TABS: Array<{ id: 'all' | PotGroup | 'missions'; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'shop', label: 'Cửa hàng' },
  { id: 'missions', label: 'Nhiệm vụ' },
  { id: 'event', label: 'Sự kiện' },
  { id: 'crafted', label: 'Chế tạo' },
];

/** "Bộ Sưu Tập Chậu": every pot line, owned or not, filtered by source, rarity and name. */
export class PotCollectionPanel extends Panel {
  private tab: (typeof GROUP_TABS)[number]['id'] = 'all';
  private rarity: string | null = null;
  private query = '';

  constructor(
    private readonly session: GameSession,
    private readonly actions: PotSystemActions,
  ) {
    super('Bộ Sưu Tập Chậu', 'pot-collection', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const owned = Object.keys(state.potBook).filter((id) => content.pots.has(id));
    const rewards = content.config.collectionRewards ?? [];
    const next = rewards[state.potBookClaimed];
    const canClaim = next !== undefined && owned.length >= next.lines;
    const claim = next
      ? h('button', { class: `candy small ${canClaim ? 'gold' : 'blocked'}`, 'data-test': 'claim-book', onclick: () => (canClaim ? this.actions.claimBookReward() : shake(claim)) }, gem(16), `Sưu tầm ${next.lines} dòng: +${next.gems}`)
      : h('span', { class: 'claimed' }, 'Đã nhận hết thưởng');
    this.body.append(h('div', { class: 'book-head' }, h('strong', {}, `Đã sưu tầm ${owned.length}/${content.potList.filter((d) => !d.retired || state.potBook[d.id]).length} dòng chậu`), claim));

    const tabs = h('div', { class: 'tabs' });
    for (const t of GROUP_TABS) tabs.append(h('button', { class: `tab${this.tab === t.id ? ' on' : ''}`, onclick: () => ((this.tab = t.id), this.render()) }, t.label));
    const rar = h('div', { class: 'tabs small' });
    for (const r of [null, 'common', 'good', 'rare', 'epic', 'legendary']) rar.append(h('button', { class: `tab${this.rarity === r ? ' on' : ''}`, onclick: () => ((this.rarity = r), this.render()) }, r ? (RARITY_TEXT[r] ?? r) : 'Mọi phẩm chất'));
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Tìm tên chậu…', value: this.query, 'aria-label': 'Tìm chậu' });
    search.addEventListener('change', () => ((this.query = search.value), this.render()));
    this.body.append(h('div', { class: 'filters' }, tabs, rar, search));

    const grid = h('div', { class: 'book-grid' });
    const q = this.query.trim().toLowerCase();
    const list = content.potList.filter((d) => {
      if (d.retired && !state.potBook[d.id]) return false; // directive 04: retired lines only if owned
      if (this.tab === 'missions' ? !['daily', 'weekly', 'monthly', 'challenge'].includes(d.group) : this.tab !== 'all' && d.group !== this.tab) return false;
      if (this.rarity && d.rarity !== this.rarity) return false;
      return !q || d.name.vi.toLowerCase().includes(q);
    });
    for (const d of list) {
      const e = state.potBook[d.id];
      const count = Object.values(state.pots).filter((p) => p.potId === d.id).length;
      grid.append(
        h(
          'div',
          { class: `book-card${e ? '' : ' unowned'}`, 'data-test': `book-${d.id}` },
          potIcon(d, e?.bestLevel ?? 1, 92),
          e && e.bestLevel >= d.levels.length ? h('span', { class: 'badge50' }, 'Lv 50') : null,
          h('strong', {}, d.name.vi),
          rarityChip(d.rarity),
          h('span', { class: 'note' }, e ? `Cao nhất cấp ${e.bestLevel}/${d.levels.length} · có ${count}` : (d.source?.vi ?? GROUP_TEXT[d.group] ?? '')),
        ),
      );
    }
    if (list.length === 0) grid.append(h('p', { class: 'note' }, 'Không có chậu nào khớp bộ lọc.'));
    this.body.append(grid);
  }
}

/** The event window: countdown, points, milestone track, exclusive pot. */
export class EventPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: PotSystemActions,
  ) {
    super('Lễ Hội', 'event-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    const events = visibleEvents(content, state, now);
    if (events.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Hiện chưa có lễ hội nào. Chậu sự kiện đã nhận vẫn là của bạn mãi mãi.'));
      return;
    }
    for (const ev of events) {
      const prog = state.events[ev.id] ?? { points: 0, claimed: 0 };
      const running = now < ev.end;
      const last = ev.milestones.at(-1)!.points;
      const track = h('div', { class: 'ev-track' }, h('i', { class: 'ev-fill', style: `width:${Math.min(100, (prog.points / last) * 100)}%` }));
      ev.milestones.forEach((m, i) => {
        const r = m.reward;
        const potDef = r.pot ? content.pots.get(r.pot) : null;
        const got = i < prog.claimed;
        const reached = prog.points >= m.points;
        const art = potDef ? potIcon(potDef, 1, 64) : r.items ? itemIcon(content, Object.keys(r.items)[0]!, 40) : r.gems ? gem(34) : coin(34);
        const label = potDef ? potDef.name.vi : [r.coins ? `${formatNumber(r.coins)} xu` : '', r.gems ? `${r.gems} Ngọc` : '', ...Object.entries(r.items ?? {}).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? ''}`)].filter(Boolean).join(', ');
        track.append(h('div', { class: `ev-stop${got ? ' got' : reached ? ' ready' : ''}${potDef ? ' big' : ''}`, style: `left:${(m.points / last) * 100}%` }, art, h('b', {}, String(m.points)), h('span', {}, label)));
      });
      const ready = claimableMilestones(state, ev);
      const btn = h('button', { class: `candy ${ready > 0 ? 'gold' : 'blocked'}`, 'data-test': 'claim-event', onclick: () => (ready > 0 ? this.actions.claimEventMilestone(ev.id) : shake(btn)) }, ready > 0 ? `Nhận quà (${ready})` : 'Tích thêm điểm');
      const how = Object.entries(ev.points)
        .map(([k, v]) => `${{ harvest: 'Thu hoạch', deliverOrder: 'Giao đơn', missionClaimed: 'Nhận thưởng nhiệm vụ', neighborHelped: 'Giúp hàng xóm' }[k] ?? k} +${v}`)
        .join(' · ');
      this.body.append(
        h(
          'section',
          { class: 'event-card' },
          h('div', { class: 'event-banner' }, svgIcon('moon', 64), h('div', {}, h('h3', {}, ev.name.vi), h('p', {}, ev.desc.vi)), h('span', { class: 'ev-time' }, running ? `Còn ${formatClock(ev.end - now)}` : 'Đã kết thúc')),
          h('div', { class: 'ev-points' }, h('strong', { 'data-test': 'event-points' }, `${prog.points} điểm Trăng`), h('span', { class: 'note' }, how)),
          track,
          h('div', { class: 'candy-wrap' }, btn),
        ),
      );
    }
  }
}

/** Mission pot exchange shown inside the missions window. */
export function missionPotBox(session: GameSession, actions: PotSystemActions): HTMLElement | null {
  const { content, state } = session;
  const defs = content.potList.filter((d) => d.exchange && d.group !== 'shop');
  if (defs.length === 0) return null;
  const box = h('section', { class: 'card mission-pots' }, h('h3', {}, 'Chậu Nhiệm Vụ'));
  for (const d of defs) {
    const parts = Object.entries(d.exchange!.items).map(([id, q]) => {
      const have = state.inventory[id] ?? 0;
      return h('span', { class: `need${have < q ? ' short' : ''}` }, itemIcon(content, id, 30), `${have}/${q}`);
    });
    const ok = canAfford(state, { coins: 0, items: d.exchange!.items });
    const owned = Boolean(state.potBook[d.id]);
    const btn = h('button', { class: `candy ${ok ? 'gold' : 'blocked'}`, 'data-test': `obtain-${d.id}`, onclick: () => (ok ? actions.obtainPot(d.id) : shake(btn)) }, owned ? 'Đổi thêm một chậu' : 'Đổi lấy chậu');
    box.append(h('div', { class: 'mpot' }, potIcon(d, 1, 84), h('div', { class: 'mpot-main' }, h('strong', {}, d.name.vi), h('span', { class: 'note left' }, d.source?.vi ?? ''), h('div', { class: 'needs' }, ...parts)), btn));
  }
  return box;
}
