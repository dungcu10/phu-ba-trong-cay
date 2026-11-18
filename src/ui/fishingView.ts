// Chỉ thị 10 § 3.9: the fishing tab of the Biển Mây window (chỉ thị 11: the Bến Câu Cá opens the same
// view). Bait on the left (free bait of the day, making bait), the line in the middle, the Sổ Cá and
// fish trading on the right. The reel mini-game runs here, outside the save: after castLine the float
// bobs for a few seconds, then shakes — tap within the window to strike — then hold to tighten the
// line and keep the mark in the green zone until the catch bar fills. The result goes back as
// reelFish {success}. The mini-game element survives the window's re-renders.

import type { GameSession } from '../app/session.ts';
import type { FishDef } from '../core/content.ts';
import { affordableRecipe, fishBookPoints, fishingOpen, freeBaitReady, nextFishMilestone } from '../systems/fishing.ts';
import { itemIcon } from './icons.ts';
import { h, icon } from './dom.ts';
import { rarityChip } from './potPanels.ts';
import { formatNumber } from './text.ts';
import { coin } from './worldPanels.ts';

export interface FishingActions {
  claimFreeBait(): void;
  craftBait(bait: string): void;
  castLine(bait: string): void;
  reelFish(success: boolean): void;
  exchangeFish(fishId: string, option: number): void;
  claimFishBook(): void;
}

type Phase = 'idle' | 'wait' | 'bite' | 'reel' | 'done';

export class FishingView {
  private phase: Phase = 'idle';
  private readonly stage = h('div', { class: 'fish-stage', 'data-test': 'fish-stage' });
  private timer = 0;
  private raf = 0;
  private result: { fish: FishDef; landed: boolean } | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly actions: FishingActions,
  ) {}

  /** Called by the window with each command's events. */
  react(type: string, fishId?: string, landed?: boolean): void {
    if (type === 'lineCast') this.startWait();
    if (type === 'fishReeled' && fishId) {
      const fish = this.session.content.fish.get(fishId);
      if (fish) this.result = { fish, landed: !!landed };
      this.phase = 'done';
      this.drawStage();
    }
  }

  stop(): void {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
  }

  render(): HTMLElement {
    const { content, state } = this.session;
    const fr = content.fishing;
    if (!fr) return h('div');
    if (!fishingOpen(content, state)) return h('p', { class: 'note' }, `Câu cá mở ở cấp ${fr.unlockLevel}.`);
    // A fish still on the line (window closed mid-fight, or the game restarted): straight to reeling.
    if (state.fishing.hooked && this.phase === 'idle') this.startReel();
    if (!state.fishing.hooked && (this.phase === 'reel' || this.phase === 'bite' || this.phase === 'wait')) this.phase = 'idle';
    if (this.phase === 'idle' || this.phase === 'done') this.drawStage();
    return h('div', { class: 'fish-layout' }, this.baitColumn(), this.stage, this.bookColumn());
  }

  private baitColumn(): HTMLElement {
    const { content, state } = this.session;
    const fr = content.fishing!;
    const col = h('div', { class: 'fish-col' }, h('h3', {}, 'Mồi câu'));
    if (freeBaitReady(content, state, this.session.now())) {
      col.append(h('button', { class: 'candy gold small', 'data-test': 'free-bait', onclick: () => this.actions.claimFreeBait() }, 'Nhận mồi miễn phí hôm nay'));
    }
    for (const b of fr.baits) {
      const have = state.inventory[b.item] ?? 0;
      const can = affordableRecipe(content, state, b.item) >= 0;
      const recipe = b.recipes.map((r) => Object.entries(r).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? id}`).join(' + ')).join(' hoặc ');
      col.append(
        h(
          'div',
          { class: 'bait-row' },
          itemIcon(content, b.item, 40),
          h('span', { class: 'bait-main' }, h('strong', {}, `${content.items.get(b.item)?.name.vi ?? b.item} ×${have}`), h('span', { class: 'note' }, `Chế: ${recipe}`)),
          h('button', { class: `candy small ${can ? 'primary' : 'blocked'}`, disabled: can ? undefined : true, 'data-test': `craft-${b.item}`, onclick: () => this.actions.craftBait(b.item) }, 'Chế'),
          h('button', { class: `candy small ${have > 0 && this.phase !== 'wait' && this.phase !== 'bite' && this.phase !== 'reel' ? 'gold' : 'blocked'}`, disabled: have > 0 && (this.phase === 'idle' || this.phase === 'done') ? undefined : true, 'data-test': `cast-${b.item}`, onclick: () => this.actions.castLine(b.item) }, 'Thả câu'),
        ),
      );
    }
    return col;
  }

  private bookColumn(): HTMLElement {
    const { content, state } = this.session;
    const fr = content.fishing!;
    const points = fishBookPoints(content, state);
    const next = nextFishMilestone(content, state);
    const m = next >= 0 ? fr.book[next]! : null;
    const col = h('div', { class: 'fish-col' }, h('h3', {}, 'Sổ Cá ', h('span', { class: 'note' }, `${formatNumber(points)} điểm`)));
    if (m) {
      const ok = points >= m.points;
      const reward = [m.gems ? `${m.gems} Ngọc Mây` : '', ...Object.entries(m.items ?? {}).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? id}`)].filter(Boolean).join(', ');
      col.append(
        h('div', { class: 'fish-book-next' }, h('span', { class: 'note' }, `Mốc ${formatNumber(m.points)} điểm: ${reward}`), h('button', { class: `candy small ${ok ? 'gold' : 'blocked'}`, disabled: ok ? undefined : true, 'data-test': 'claim-fish-book', onclick: () => this.actions.claimFishBook() }, ok ? 'Nhận' : `${formatNumber(points)}/${formatNumber(m.points)}`)),
      );
    }
    for (const f of fr.fish) {
      const seen = state.collections.fish[f.id];
      const have = state.inventory[f.id] ?? 0;
      const pic = itemIcon(content, f.id, 44);
      if (!seen) (pic as HTMLElement).classList.add('unknown-fish');
      const row = h('div', { class: `fish-row${seen ? '' : ' unseen'}` }, pic, h('span', { class: 'bait-main' }, h('strong', {}, seen ? f.name.vi : '???'), rarityChip(f.rarity), h('span', { class: 'note' }, seen ? `Đã câu ${seen.count} · đang có ${have} · ${f.points} điểm/con` : 'Chưa câu được')));
      if (have > 0) {
        const opts = h('span', { class: 'fish-ex' });
        f.exchange.forEach((ex, i) => {
          const label = ex.coins ? [coin(14), formatNumber(ex.coins)] : ex.bug ? [`${ex.qty ?? 1} bọ ${ex.bug === 'epic' ? 'Rất hiếm' : 'Hiếm'}`] : Object.entries(ex.items ?? {}).map(([id, q]) => h('span', {}, itemIcon(content, id, 18), `×${q}`));
          opts.append(h('button', { class: 'candy small', 'data-test': `ex-${f.id}-${i}`, onclick: () => this.actions.exchangeFish(f.id, i) }, ...label));
        });
        row.append(opts);
      }
      col.append(row);
    }
    return col;
  }

  // --- the line and the reel mini-game ------------------------------------------------------------

  private drawStage(inner?: HTMLElement): void {
    this.stage.replaceChildren();
    if (inner) return void this.stage.append(inner);
    const { content } = this.session;
    if (this.phase === 'done' && this.result) {
      const { fish, landed } = this.result;
      this.stage.append(
        h('div', { class: `fish-result${landed ? ' landed' : ''}` }, icon(`xuxu/${landed ? 'happy' : 'sleep'}`, 90), landed ? itemIcon(content, fish.id, 80) : null, h('strong', {}, landed ? `Câu được ${fish.name.vi}!` : 'Cá vùng ra mất rồi…'), landed ? rarityChip(fish.rarity) : null, h('span', { class: 'note' }, 'Chọn mồi rồi bấm Thả câu để câu tiếp.')),
      );
      return;
    }
    this.stage.append(h('div', { class: 'fish-idle' }, icon('xuxu/wave', 90), icon('icon/float', 48), h('span', { class: 'note' }, 'Chọn mồi bên trái rồi bấm Thả câu. Mồi Thơm dễ gặp cá hiếm hơn.')));
  }

  private startWait(): void {
    this.stop();
    this.phase = 'wait';
    const [a, b] = this.session.content.fishing!.biteSeconds;
    const float = icon('icon/float', 56);
    float.classList.add('float-bob');
    this.drawStage(h('div', { class: 'fish-water' }, float, h('span', { class: 'note' }, 'Chờ phao rung…')));
    this.timer = window.setTimeout(() => this.startBite(), (a + Math.random() * (b - a)) * 1000);
  }

  private startBite(): void {
    this.phase = 'bite';
    const float = icon('icon/float', 56);
    float.classList.add('float-shake');
    const btn = h('button', { class: 'fish-water strike', 'data-test': 'fish-strike', onclick: () => this.startReel() }, float, h('strong', {}, 'Chạm ngay!'));
    this.drawStage(btn);
    // Too slow: the fish lets go of the bait.
    this.timer = window.setTimeout(() => this.phase === 'bite' && this.actions.reelFish(false), 2500);
  }

  private startReel(): void {
    this.stop();
    const hk = this.session.state.fishing.hooked;
    const fish = hk ? this.session.content.fish.get(hk.fishId) : undefined;
    if (!fish) return;
    this.phase = 'reel';
    const zoneW = fish.zone;
    let zone = 0.5 - zoneW / 2;
    let mark = 0.5;
    let vel = 0;
    let caught = 0.3;
    let holding = false;
    let zoneDir = 1;
    const fill = h('span', { class: 'catch-fill' });
    const zoneEl = h('span', { class: 'tension-zone' });
    const markEl = h('span', { class: 'tension-mark' });
    const bar = h('div', { class: 'tension-bar' }, zoneEl, markEl);
    const pad = h(
      'div',
      { class: 'reel-pad', 'data-test': 'fish-reel', role: 'button', 'aria-label': 'Giữ để kéo dây' },
      icon(`xuxu/surprised`, 70),
      h('strong', {}, 'Giữ để căng dây, thả để chùng dây'),
      bar,
      h('div', { class: 'catch-bar' }, fill),
      h('span', { class: 'note' }, `Giữ vạch trong vùng xanh khoảng ${fish.holdSeconds} giây.`),
    );
    const down = (e: Event) => ((holding = true), e.preventDefault());
    const up = () => (holding = false);
    pad.addEventListener('pointerdown', down);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointerleave', up);
    pad.addEventListener('pointercancel', up);
    this.drawStage(pad);
    let last = performance.now();
    const step = (t: number) => {
      if (this.phase !== 'reel') return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      // Holding pulls the mark right, letting go lets it fall back; the fish drags the zone about.
      vel += (holding ? 2.2 : -1.8) * dt;
      vel *= 0.92;
      mark = Math.min(1, Math.max(0, mark + vel * dt * 2));
      if (mark <= 0 || mark >= 1) vel = 0;
      zone += zoneDir * fish.pull * 0.18 * dt * (0.6 + Math.random());
      if (zone < 0 || zone > 1 - zoneW || Math.random() < dt * fish.pull * 0.6) zoneDir = -zoneDir;
      zone = Math.min(1 - zoneW, Math.max(0, zone));
      const inZone = mark >= zone && mark <= zone + zoneW;
      // Out of the zone the catch drains at half speed, so a child has time to bring the mark back.
      caught += inZone ? dt / fish.holdSeconds : -dt / (fish.holdSeconds * 2);
      zoneEl.style.left = `${zone * 100}%`;
      zoneEl.style.width = `${zoneW * 100}%`;
      markEl.style.left = `${mark * 100}%`;
      markEl.classList.toggle('in', inZone);
      fill.style.width = `${Math.max(0, Math.min(1, caught)) * 100}%`;
      if (caught >= 1) return this.actions.reelFish(true);
      if (caught <= 0) return this.actions.reelFish(false);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
