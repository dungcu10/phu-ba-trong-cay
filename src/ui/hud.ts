// Always-visible HUD (DESIGN_SYSTEM 6.3): flower level badge + vine XP bar and the side shelf of
// garden services (top-left), embroidered coin and gem pouches (top-centre), letters and gear
// (top-right), main buttons in a thumb arc (bottom-right). Under 15% of the screen.

import { luckReady } from '../systems/sessionLuck.ts';
import { svgIcon } from './icons.ts';
import { lineIcon } from './lineIcons.ts';
import type { GameSession } from '../app/session.ts';
import { storageCapacity, storageUsed, xpToNextLevel } from '../systems/economy.ts';
import { canDeliver } from '../systems/orders.ts';
import { nextMilestone } from '../systems/surprises.ts';
import { missionsReady } from '../systems/missions.ts';
import { featureOpen, questsReady, trackedQuest } from '../systems/quests.ts';
import { claimableMilestones, visibleEvents } from '../systems/events.ts';
import { h, icon } from './dom.ts';
import { nextHint } from './hint.ts';
import { formatNumber, formatTimeLeft } from './text.ts';
import { xuxuGiftReady } from '../systems/xuxu.ts';
import { houseAlerts } from '../systems/villageAlerts.ts';
import { isNight } from '../systems/growth.ts';

export interface HudActions {
  openSeeds(): void;
  openStorage(): void;
  openShop(): void;
  openSettings(): void;
  openOrders(): void;
  openStall(): void;
  openNeighbors(): void;
  openJournal(): void;
  openBirds(): void;
  openWorkshop(): void;
  openSea(): void;
  tapXuxu(): void;
  openVillage(): void;
  openLetters(): void;
  /** Chỉ thị 12 B1: Hẹn giờ and Lộc Phiên. */
  openTimers(): void;
  claimLuck(): void;
  openMissions(): void;
  openEvent(): void;
  toggleTray(): void;
  /** Opens the quest centre on a track ('today' = daily missions). */
  openQuests(track?: string): void;
  claimQuest(questId: string): void;
}

export class Hud {
  readonly el: HTMLElement;
  private readonly level = h('span', { class: 'flower', 'data-test': 'level' });
  private readonly ring = h('span', { class: 'lvl-ring' }, this.level);
  private readonly pct = h('span', { class: 'lvl-pct' });
  private readonly vineFill = h('span', { class: 'vine-fill' });
  private readonly xpText = h('span', { class: 'xp-text' });
  private readonly coins = h('span', {});
  private readonly gems = h('span', {});
  private readonly pouch: HTMLElement;
  private readonly gemPouch: HTMLElement;
  private readonly hint = h('div', { class: 'hint', role: 'status' });
  private readonly storageBadge = h('span', { class: 'badge' });
  private readonly orderBadge = h('span', { class: 'badge hidden' });
  private readonly stallBadge = h('span', { class: 'badge hidden' });
  private readonly journalBadge = h('span', { class: 'badge hidden' });
  private readonly letterBadge = h('span', { class: 'badge hidden' });
  private readonly missionBadge = h('span', { class: 'badge hidden' });
  private readonly eventBadge = h('span', { class: 'badge hidden' });
  private readonly eventTime = h('span', { class: 'ev-timer' });
  private readonly eventBtn: HTMLElement;
  private readonly seeds: HTMLElement;
  /** Buttons that appear only once their feature is open (features.json). */
  private readonly gated: Array<{ feature: string; el: HTMLElement }> = [];
  private readonly tracker: HTMLElement;
  private readonly trackerName = h('strong', {});
  private readonly trackerTrack = h('span', { class: 'qt-track' });
  private readonly trackerBar = h('i', {});
  private readonly trackerCount = h('span', { class: 'qt-count' });
  private readonly trackerClaim: HTMLButtonElement;
  private trackedId: string | null = null;
  private last = { coins: -1, gems: -1 };
  /** Screen position of the storage button, where harvested produce flies to. */
  readonly storageButton: HTMLElement;

  constructor(
    private readonly session: GameSession,
    actions: HudActions,
  ) {
    const { content } = session;
    this.pouch = h('div', { class: 'plaque pouch', 'data-test': 'coins' }, svgIcon('coin', 26), this.coins);
    this.gemPouch = h('div', { class: 'plaque pouch gems', 'data-test': 'gems' }, svgIcon('gem', 24), this.gems);
    // Giao diện Fantasy cao cấp: level ring + name, thin XP line underneath.
    const levelBox = h(
      'div',
      { class: 'plaque profile' },
      this.ring,
      h('span', { class: 'profile-text' }, h('strong', { class: 'profile-name' }, 'Vườn Trên Mây'), this.pct, h('span', { class: 'vine' }, this.vineFill, this.xpText)),
    );
    const letters = h('button', { class: 'knob icon-knob', 'aria-label': 'Thư Mây', 'data-test': 'open-letters', onclick: () => actions.openLetters() }, lineIcon('letter', 22), this.letterBadge);
    const gear = h('button', { class: 'knob icon-knob', 'aria-label': 'Cài đặt', onclick: () => actions.openSettings() }, lineIcon('gear', 22));
    const clock = h('button', { class: 'knob icon-knob', 'aria-label': 'Hẹn giờ', 'data-test': 'open-timers', onclick: () => actions.openTimers() }, h('span', { class: 'clock-glyph' }, '⏰'));
    this.luckBtn = h('button', { class: 'luck-pill hidden', 'data-test': 'claim-luck', onclick: () => actions.claimLuck() }, h('span', { class: 'luck-glyph' }, '🧧'), h('span', {}, 'Lộc Phiên'));
    // Chỉ thị 11: the village (houses, Cấp Làng, check-in); a mark when a house has something waiting.
    this.villageBadge = h('span', { class: 'badge hidden' }, '!');
    const village = h('button', { class: 'knob icon-knob', 'aria-label': 'Làng Phú Bà', 'data-test': 'open-village', onclick: () => actions.openVillage() }, lineIcon('house', 22), this.villageBadge);
    const seeds = (this.seeds = h(
      'button',
      { class: 'round-big seeds', 'aria-label': 'Hạt giống', 'data-test': 'open-seeds', onclick: () => actions.toggleTray() },
      h('span', { class: 'seeds-orb' }, svgIcon('seeds', 34)),
      h('span', { class: 'round-label' }, 'Gieo hạt'),
    ));
    this.storageButton = h(
      'button',
      { class: 'round-big', 'aria-label': 'Rương Mây', 'data-test': 'open-storage', onclick: () => actions.openStorage() },
      lineIcon('chest', 26),
      h('span', { class: 'round-label' }, 'Rương Mây'),
      this.storageBadge,
    );
    const shop = h('button', { class: 'round-big', 'aria-label': 'Lò Gốm', 'data-test': 'open-shop', onclick: () => actions.openShop() }, lineIcon('kiln', 26), h('span', { class: 'round-label' }, 'Lò Gốm'));
    const side = (label: string, test: string, art: Element, badge: HTMLElement | null, run: () => void, feature?: string) => {
      const b = h('button', { class: 'side-btn', 'aria-label': label, 'data-test': test, onclick: run }, art, h('span', { class: 'side-label' }, label), badge);
      if (feature) this.gated.push({ feature, el: b });
      return b;
    };
    const services = h(
      'div',
      { class: 'hud-side' },
      side('Nhiệm vụ', 'open-missions', lineIcon('missions', 26), this.missionBadge, () => actions.openMissions()),
      side('Đơn hàng', 'open-orders', lineIcon('orders', 26), this.orderBadge, () => actions.openOrders(), 'orders'),
      side('Sạp', 'open-stall', lineIcon('stall', 26), this.stallBadge, () => actions.openStall(), 'stall'),
      side('Phú Bà', 'open-neighbors', lineIcon('crown', 26), null, () => actions.openNeighbors(), 'neighbors'),
      side('Sổ Tay', 'open-journal', lineIcon('journal', 26), this.journalBadge, () => actions.openJournal(), 'journal'),
      side('Chim', 'open-birds', icon('bird/sky-sparrow/perch', 30), null, () => actions.openBirds(), 'birds'),
      side('Xưởng', 'open-workshop', icon('bug/ladybird', 30), null, () => actions.openWorkshop(), 'workshop'),
      side('Biển Mây', 'open-sea', icon('icon/wind-energy', 30), null, () => actions.openSea(), 'sea'),
    );
    this.gated.push({ feature: 'shop', el: shop });
    // Quest tracker (đợt 2): the quest to do next, its progress, and a claim button when ready.
    this.trackerClaim = h('button', { class: 'candy small gold', 'data-test': 'tracker-claim', onclick: (e: Event) => (e.stopPropagation(), this.trackedId && actions.claimQuest(this.trackedId)) }, 'Nhận') as HTMLButtonElement;
    this.tracker = h(
      'button',
      { class: 'quest-tracker hidden', 'data-test': 'quest-tracker', 'aria-label': 'Nhiệm vụ đang theo', onclick: () => actions.openQuests(this.trackedTrack) },
      h('span', { class: 'qt-main' }, this.trackerTrack, this.trackerName, h('span', { class: 'bar' }, this.trackerBar), this.trackerCount),
      this.trackerClaim,
    );
    this.eventBtn = h('button', { class: 'side-btn event-btn', 'aria-label': 'Lễ Hội', 'data-test': 'open-event', onclick: () => actions.openEvent() }, lineIcon('moon', 26), h('span', { class: 'side-label' }, 'Lễ Hội'), this.eventTime, this.eventBadge);
    // Chỉ thị 10 § 3.11: Xu Xu in the corner — tap for a line, and a small gift once an hour.
    this.xuxuPic = h('span', { class: 'xuxu-pic' });
    this.xuxuBubble = h('span', { class: 'xuxu-bubble hidden', 'aria-live': 'polite' });
    this.xuxuGift = h('span', { class: 'badge xuxu-gift hidden' }, '!');
    this.xuxuBtn = h('button', { class: 'xuxu-corner', 'aria-label': 'Xu Xu', 'data-test': 'xuxu', onclick: () => actions.tapXuxu() }, this.xuxuPic, this.xuxuGift);
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'hud-right' }, this.eventBtn, this.luckBtn),
      h('div', { class: 'xuxu-wrap' }, this.xuxuBubble, this.xuxuBtn),
      h('div', { class: 'hud-top' }, levelBox, h('div', { class: 'pouches' }, this.pouch, this.gemPouch), village, clock, letters, gear),
      this.hint,
      services,
      h('div', { class: 'hud-arc' }, this.storageButton, seeds, shop),
      this.tracker,
    );
    this.gated.push({ feature: 'event', el: this.eventBtn });
  }

  private trackedTrack: string | undefined;
  private readonly xuxuPic: HTMLElement;
  private readonly villageBadge: HTMLElement;
  private readonly luckBtn: HTMLElement;
  private readonly xuxuBubble: HTMLElement;
  private readonly xuxuGift: HTMLElement;
  private readonly xuxuBtn: HTMLElement;
  private xuxuPose = '';
  private bubbleTimer = 0;
  private poseUntil = 0;

  /** Xu Xu says a line (and strikes a pose for a moment). */
  say(line: string, pose: 'happy' | 'wave' | 'surprised' = 'happy'): void {
    this.xuxuBubble.textContent = line;
    this.xuxuBubble.classList.remove('hidden');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.xuxuBubble.classList.add('hidden'), 4200);
    this.poseUntil = Date.now() + 2500;
    this.setXuxuPose(pose);
  }

  private setXuxuPose(pose: string): void {
    if (pose === this.xuxuPose) return;
    this.xuxuPose = pose;
    this.xuxuPic.replaceChildren(icon(`xuxu/${pose}`, 64));
    this.xuxuBtn.classList.remove('bounce');
    void this.xuxuBtn.offsetWidth;
    this.xuxuBtn.classList.add('bounce');
  }

  setTrayOpen(on: boolean): void {
    this.seeds.classList.toggle('on', on);
  }

  private bump(el: HTMLElement): void {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  private badge(el: HTMLElement, n: number): void {
    el.textContent = String(n);
    el.classList.toggle('hidden', n <= 0);
  }

  update(): void {
    const { content, state } = this.session;
    const p = state.player;
    // Xu Xu sleeps at night, waves by day; a gift mark when the hourly gift is ready.
    if (Date.now() > this.poseUntil) this.setXuxuPose(isNight(content, this.session.now()) ? 'sleep' : 'wave');
    this.xuxuGift.classList.toggle('hidden', !xuxuGiftReady(content, state, this.session.now()));
    this.villageBadge.classList.toggle('hidden', houseAlerts(content, state, this.session.now()).length === 0);
    this.luckBtn.classList.toggle('hidden', !luckReady(content, state, this.session.now()));
    const need = xpToNextLevel(content, p.level);
    this.level.textContent = String(p.level);
    this.vineFill.style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
    this.xpText.textContent = `${formatNumber(p.xp)}/${formatNumber(need)}`;
    const share = Math.min(100, Math.floor((p.xp / need) * 100));
    this.ring.style.setProperty('--p', `${share}`);
    this.pct.textContent = `Cấp ${p.level} · ${share}%`;
    if (p.coins !== this.last.coins) {
      if (this.last.coins >= 0 && p.coins > this.last.coins) this.bump(this.pouch);
      this.last.coins = p.coins;
      this.coins.textContent = formatNumber(p.coins);
    }
    if (p.gems !== this.last.gems) {
      if (this.last.gems >= 0 && p.gems > this.last.gems) this.bump(this.gemPouch);
      this.last.gems = p.gems;
      this.gems.textContent = formatNumber(p.gems);
    }
    const used = storageUsed(content, state);
    const cap = storageCapacity(content, state);
    this.storageBadge.textContent = `${used}/${cap}`;
    this.storageBadge.classList.toggle('full', used >= cap);
    this.badge(this.orderBadge, state.orders.slots.filter((s) => s.order && canDeliver(state, s.order)).length);
    this.badge(this.stallBadge, state.stall.length);
    this.badge(this.journalBadge, content.cropList.filter((c) => nextMilestone(content, state, c.id)).length);
    this.badge(this.letterBadge, state.notices.filter((n) => !n.read).length);
    this.badge(this.missionBadge, missionsReady(content, state) + questsReady(content, state));
    const now = this.session.now();
    const evs = visibleEvents(content, state, now);
    for (const g of this.gated) g.el.classList.toggle('locked-feature', !featureOpen(content, state, g.feature));
    this.eventBtn.classList.toggle('hidden', evs.length === 0);
    const tq = trackedQuest(content, state);
    this.tracker.classList.toggle('hidden', !tq);
    if (tq) {
      this.trackedId = tq.def.id;
      this.trackedTrack = tq.def.track;
      const track = content.questTracks.get(tq.def.track);
      const target = tq.target ?? 1;
      const steps = track?.skipAtLevel !== undefined ? content.questList.filter((q) => q.track === track.id) : null;
      this.trackerTrack.textContent = steps ? `${track!.name.vi} ${steps.findIndex((q) => q.id === tq.def.id) + 1}/${steps.length}` : (track?.name.vi ?? '');
      this.trackerName.textContent = tq.def.name.vi;
      this.trackerBar.style.width = `${Math.min(100, (tq.progress / target) * 100)}%`;
      this.trackerCount.textContent = `${formatNumber(Math.min(tq.progress, target))}/${formatNumber(target)}`;
      this.trackerClaim.style.display = tq.claimable ? '' : 'none';
      this.tracker.classList.toggle('ready', tq.claimable);
    }
    if (evs.length > 0) {
      const ev = evs[0]!;
      this.eventTime.textContent = now < ev.end ? formatTimeLeft(ev.end - now) : 'Hết hạn';
      this.badge(this.eventBadge, evs.reduce((n, e) => n + claimableMilestones(state, e), 0));
    }
    const hint = nextHint(content, state, this.session.now());
    this.hint.textContent = hint.text;
    this.hint.dataset.kind = hint.kind;
  }
}
