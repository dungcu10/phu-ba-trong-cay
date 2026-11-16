// Connects player input to game commands, and game events to feedback (effects, sound, HUD).

import type { Command, GameEvent, Result, SlotRef } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import type { GameView } from '../render/scene.ts';
import { itemFrame } from '../render/assets.ts';
import type { Art } from '../render/assets.ts';
import { Hud } from '../ui/hud.ts';
import { Panel, PotPanel, SeedPanel, StoragePanel, type PanelActions } from '../ui/panels.ts';
import { SettingsPanel } from '../ui/settings.ts';
import { ERROR_TEXT, formatNumber } from '../ui/text.ts';
import { Toasts } from '../ui/toast.ts';
import type { GameSession } from './session.ts';
import type { Sfx } from './sfx.ts';

export class Controller implements PanelActions {
  readonly toasts = new Toasts();
  readonly hud: Hud;
  private panel: Panel | null = null;
  /** Last crop planted, so swiping across empty pots replants it ("gieo lại như cũ"). */
  private lastCrop: string | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly view: GameView,
    private readonly art: Art,
    private readonly sfx: Sfx,
    private readonly overlay: HTMLElement,
    private readonly saveSound: (on: boolean) => void,
  ) {
    this.hud = new Hud(session, { openStorage: () => this.openStorage(), openSettings: () => this.openSettings() });
    overlay.append(this.hud.el, this.toasts.el);
    view.handlers = { onTap: (s, t) => this.tap(s, t), onSwipe: (s) => this.swipe(s) };
    session.onChange((events) => this.onEvents(events));
    setInterval(() => this.hud.update(), 1000);
    this.hud.update();
  }

  private status(ref: SlotRef) {
    const slot = this.session.state.floors[ref.floor]!.slots[ref.slot]!;
    return { slot, status: cropStatus(this.session.content, this.session.state, slot, this.session.now()) };
  }

  private run(cmd: Command, silent = false): Result {
    const r = this.session.run(cmd);
    if (!r.ok && !silent) {
      this.sfx.play('error');
      this.toasts.show(ERROR_TEXT[r.error], 'error');
    }
    return r;
  }

  tap(ref: SlotRef, target: 'pot' | 'bug'): void {
    const { status } = this.status(ref);
    if (!status) return this.openPanel(new SeedPanel(this.session, ref, this));
    if (status.bug && (target === 'bug' || (!status.ripe && !status.thirsty))) {
      this.run({ type: 'catchBug', ...ref });
      return;
    }
    if (status.ripe) return void this.run({ type: 'harvest', ...ref });
    if (status.bug) return void this.run({ type: 'catchBug', ...ref });
    if (status.thirsty) return void this.run({ type: 'water', ...ref });
    this.sfx.play('tap');
    this.openPanel(new PotPanel(this.session, ref, this));
  }

  /** Quick action while dragging across pots; never opens panels. */
  swipe(ref: SlotRef): void {
    const { status } = this.status(ref);
    if (!status) {
      if (this.lastCrop) this.run({ type: 'plant', cropId: this.lastCrop, ...ref });
      return;
    }
    if (status.ripe) this.run({ type: 'harvest', ...ref });
    else if (status.bug) this.run({ type: 'catchBug', ...ref }, true);
    else if (status.thirsty) this.run({ type: 'water', ...ref }, true);
  }

  plant(slot: SlotRef, cropId: string): boolean {
    const ok = this.run({ type: 'plant', cropId, ...slot }).ok;
    if (ok) this.lastCrop = cropId;
    return ok;
  }

  sell(itemId: string, qty: number): void {
    this.run({ type: 'sell', itemId, qty });
  }

  upgradePot(potInstanceId: string): void {
    this.run({ type: 'upgradePot', potInstanceId });
  }

  openStorage(): void {
    this.sfx.play('tap');
    this.openPanel(new StoragePanel(this.session, this));
  }

  openSettings(): void {
    this.sfx.play('tap');
    this.openPanel(new SettingsPanel(this.session, this.sfx, this.toasts, this.saveSound));
  }

  private openPanel(panel: Panel): void {
    this.panel?.close();
    this.panel = panel;
    panel.onClose = () => {
      if (this.panel === panel) this.panel = null;
    };
    this.overlay.append(panel.el);
  }

  /** Time passed without a command (app resumed, dev fast-forward). */
  resync(): void {
    this.view.refresh();
    this.hud.update();
    this.panel?.render();
  }

  private onEvents(events: GameEvent[]): void {
    this.view.refresh();
    for (const e of events) this.feedback(e);
    this.hud.update();
    this.panel?.render();
  }

  private feedback(e: GameEvent): void {
    const { content } = this.session;
    const fx = this.view.effects;
    const at = (ref: SlotRef) => this.view.slotView(ref.slot).feedbackPoint();
    switch (e.type) {
      case 'planted': {
        this.sfx.play('plant');
        this.view.slotView(e.slot.slot).popPlant(0.3);
        const p = at(e.slot);
        fx.floatText(`-${formatNumber(e.cost)} xu`, p.x, p.y + 40, 0xffe7b8);
        break;
      }
      case 'watered': {
        this.sfx.play('water');
        const p = at(e.slot);
        fx.burst(this.art.get('ui/bubble-water'), p.x, p.y, 6, { scale: 0.22, speed: 200 });
        break;
      }
      case 'bugCaught': {
        this.sfx.play('bug');
        const p = this.view.slotView(e.slot.slot).bugPoint();
        fx.floatText(`+1 ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 20, 0xffd0d0);
        break;
      }
      case 'harvested': {
        this.sfx.play('harvest');
        const p = at(e.slot);
        fx.burst(this.art.get(itemFrame(content, e.itemId)), p.x, p.y + 20, Math.min(8, e.qty + 3), { scale: 0.32 });
        fx.floatText(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 10);
        fx.floatText(`+${e.xp} XP`, p.x, p.y + 30, 0xb8e4ff);
        break;
      }
      case 'sold':
        this.sfx.play('coin');
        this.toasts.show(`Đã bán ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}: +${formatNumber(e.coins)} xu`, 'success', 1800);
        break;
      case 'potUpgraded': {
        this.sfx.play('upgrade');
        const index = this.session.state.floors[0]!.slots.findIndex((s) => s.potInstanceId === e.potInstanceId);
        if (index >= 0) {
          const p = at({ floor: 0, slot: index });
          fx.burst(this.art.get('icons/coin'), p.x, p.y + 60, 10, { scale: 0.22 });
          fx.floatText(`Chậu cấp ${e.level}!`, p.x, p.y, 0xf2b830);
        }
        break;
      }
      case 'levelUp': {
        this.sfx.play('levelUp');
        const bonus = content.config.levels.levelUpCoins;
        const unlocked = content.cropList.filter((c) => c.unlockLevel === e.level).map((c) => c.name.vi);
        const extra = unlocked.length > 0 ? ` Mở khóa: ${unlocked.join(', ')}.` : '';
        this.toasts.show(`Lên cấp ${e.level}! +${formatNumber(bonus)} xu thưởng.${extra}`, 'level', 4000);
        for (let i = 0; i < 4; i++) {
          const p = this.view.slotView(i % this.session.state.floors[0]!.slots.length).feedbackPoint();
          fx.burst(this.art.get('icons/xp'), p.x, p.y - 60, 5, { scale: 0.26, speed: 360 });
        }
        break;
      }
    }
  }
}
