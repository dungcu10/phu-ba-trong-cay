// Nâng cấp v3 đợt 2: the quest centre (tabs: today's missions + every quest track from
// quests.json) and the window that introduces a feature the first time it opens.

import type { GameSession } from '../app/session.ts';
import type { QuestView } from '../systems/quests.ts';
import { periodEndsAt, questReward, questsReady, trackQuests } from '../systems/quests.ts';
import { missionsReady } from '../systems/missions.ts';
import { clear, h } from './dom.ts';
import { dailyMissionsView, type GardenActions } from './gardenPanels.ts';
import { itemIcon } from './icons.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import type { PotSystemActions } from './potSystemPanels.ts';
import { formatNumber, formatTimeLeft } from './text.ts';
import { coin, gem } from './worldPanels.ts';

export interface QuestActions {
  claimQuest(questId: string): void;
}

export const TODAY = 'today';

export class QuestCenterPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private tab: string,
    private readonly actions: QuestActions & GardenActions,
    private readonly potActions: PotSystemActions,
  ) {
    super('Nhiệm Vụ', 'quest-center', 'win-wide');
    this.render();
  }

  private readyIn(track: string): number {
    const { content, state } = this.session;
    if (track === TODAY) return missionsReady(content, state);
    return trackQuests(content, state, track).filter((v) => v.claimable).length;
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const tracks = [{ id: TODAY, name: 'Hôm nay' }, ...[...content.questTracks.values()].filter((t) => t.skipAtLevel === undefined || trackQuests(content, state, t.id).some((v) => !v.done)).map((t) => ({ id: t.id, name: t.name.vi }))];
    if (!tracks.some((t) => t.id === this.tab)) this.tab = TODAY;
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    for (const t of tracks) {
      const n = this.readyIn(t.id);
      tabs.append(
        h(
          'button',
          { class: `tab${this.tab === t.id ? ' on' : ''}`, role: 'tab', 'aria-selected': this.tab === t.id ? 'true' : 'false', 'data-test': `quest-tab-${t.id}`, onclick: () => ((this.tab = t.id), this.render()) },
          t.name,
          n > 0 && h('span', { class: 'tab-badge' }, String(n)),
        ),
      );
    }
    this.body.append(h('div', { class: 'filters' }, tabs));
    if (this.tab === TODAY) {
      this.body.append(...dailyMissionsView(this.session, this.actions, this.potActions));
      return;
    }
    const track = content.questTracks.get(this.tab)!;
    if (track.reset) this.body.append(h('p', { class: 'lead' }, `Đổi nhiệm vụ ${track.reset === 'week' ? 'tuần' : 'tháng'} mới sau ${formatTimeLeft(periodEndsAt(content, track, this.session.now()) - this.session.now())}`));
    const views = trackQuests(content, state, track.id);
    // Chains: done steps at the bottom, the open step first.
    views.sort((a, b) => Number(a.done || (a.tier > 0 && !a.def.tiers)) - Number(b.done || (b.tier > 0 && !b.def.tiers)) || Number(b.claimable) - Number(a.claimable));
    const list = h('div', { class: 'missions quests' });
    for (const v of views) list.append(this.row(v));
    if (track.id === 'secret') {
      const hidden = content.questList.filter((q) => q.track === 'secret').length - views.length;
      if (hidden > 0) list.append(h('div', { class: 'mission secret-left' }, h('span', { class: 'mission-main' }, h('strong', {}, `Còn ${hidden} nhiệm vụ bí mật`), h('span', { class: 'note' }, 'Chơi khắp nơi trong vườn mây, chúng sẽ tự lộ diện.'))));
    }
    if (views.length === 0 && track.id !== 'secret') list.append(h('p', { class: 'note' }, 'Chưa có nhiệm vụ nào ở đây.'));
    this.body.append(list);
    if (questsReady(content, state) === 0 && track.id === 'achievement') this.body.append(h('p', { class: 'note' }, 'Thành tựu không có điểm cuối: mỗi bậc xong lại mở bậc cao hơn.'));
  }

  private row(v: QuestView): HTMLElement {
    const { content, state } = this.session;
    const target = v.target ?? v.progress;
    const pct = v.done ? 100 : Math.min(100, (v.progress / Math.max(1, target)) * 100);
    const r = questReward(content, state, v.def);
    const reward = h(
      'span',
      { class: 'reward' },
      r.coins > 0 && h('span', { class: 'tag' }, coin(16), formatNumber(r.coins)),
      r.xp > 0 && h('span', { class: 'tag xp' }, `${r.xp} XP`),
      r.gems > 0 && h('span', { class: 'tag' }, gem(16), String(r.gems)),
      ...Object.entries(r.items).map(([id, n]) => h('span', { class: 'tag', title: content.items.get(id)?.name.vi ?? '' }, itemIcon(content, id, 20), String(n))),
    );
    const oneOffDone = !v.def.tiers && v.tier > 0;
    const btn =
      v.done || oneOffDone
        ? h('span', { class: 'claimed' }, 'Đã nhận')
        : h('button', { class: `candy ${v.claimable ? 'gold' : 'blocked'}`, 'data-test': `claim-quest-${v.def.id}`, onclick: () => (v.claimable ? this.actions.claimQuest(v.def.id) : shake(btn)) }, 'Nhận');
    const tierText = v.def.tiers ? ` · bậc ${v.tier + 1}` : '';
    return h(
      'div',
      { class: `mission${v.claimable ? ' done' : ''}${v.done || oneOffDone ? ' claimed' : ''}` },
      h(
        'span',
        { class: 'mission-main' },
        h('strong', {}, `${v.def.name.vi}${tierText}`),
        v.def.desc && h('span', { class: 'note' }, v.def.desc.vi),
        h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
        h('span', { class: 'note' }, v.done ? 'Hoàn thành' : `${formatNumber(Math.min(v.progress, target))}/${formatNumber(target)}`),
      ),
      !(v.done || oneOffDone) && reward,
      btn,
    );
  }
}

/** First time a feature opens: what it is, with a button that takes the player there. */
export class FeatureTutorialPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly featureId: string,
    private readonly tutorialId: string,
    private readonly onGo: (featureId: string) => void,
    private readonly onSeen: (tutorialId: string) => void,
  ) {
    super(session.content.tutorials.get(tutorialId)?.title.vi ?? 'Tính năng mới', 'feature-tutorial', 'win-small');
    this.render();
  }

  // The controller sets onClose for its own bookkeeping, so the "seen" mark goes here.
  override close(): void {
    this.onSeen(this.tutorialId);
    super.close();
  }

  render(): void {
    clear(this.body);
    const t = this.session.content.tutorials.get(this.tutorialId);
    const go = h('button', { class: 'candy primary', 'data-test': 'tutorial-go', onclick: () => (this.close(), this.onGo(this.featureId)) }, 'Xem ngay');
    const later = h('button', { class: 'candy', 'data-test': 'tutorial-later', onclick: () => this.close() }, 'Để sau');
    this.body.append(h('p', { class: 'lead tutorial-text' }, t?.text.vi ?? ''), h('div', { class: 'candy-wrap' }, later, go));
  }
}
