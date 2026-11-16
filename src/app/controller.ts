// Connects player input to game commands, and game events to feedback (effects, sound, HUD).

import type { Command, GameEvent, Result, SlotRef } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import type { GameView } from '../render/scene.ts';
import { itemFrame } from '../render/assets.ts';
import type { Art } from '../render/assets.ts';
import { Hud } from '../ui/hud.ts';
import { Panel, PotPanel, SeedPanel, StoragePanel, type PanelActions } from '../ui/panels.ts';
import { SettingsPanel } from '../ui/settings.ts';
import { FloorPanel, PotShopPanel, type PotShopActions } from '../ui/potPanels.ts';
import type { FloorDef } from '../core/content.ts';
import { ERROR_TEXT, formatNumber } from '../ui/text.ts';
import { Toasts } from '../ui/toast.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { GameSession } from './session.ts';
import type { Sfx } from './sfx.ts';

export class Controller implements PanelActions, PotShopActions {
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
    this.hud = new Hud(session, { openSeeds: () => this.openSeeds(), openStorage: () => this.openStorage(), openShop: () => this.openShop(), openSettings: () => this.openSettings() });
    overlay.append(this.hud.el, this.toasts.el);
    view.handlers = { onTap: (s, t) => this.tap(s, t), onSwipe: (s) => this.swipe(s), onLockedFloor: (f) => this.openFloor(f) };
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
    // Catch any Bọ Mây first so a sweep never lets them fly away, then harvest or water.
    while (this.run({ type: 'catchBug', ...ref }, true).ok);
    if (status.ripe) this.run({ type: 'harvest', ...ref });
    else if (status.thirsty) this.run({ type: 'water', ...ref }, true);
  }

  plant(slot: SlotRef | null, cropId: string): number {
    const targets: SlotRef[] = slot
      ? [slot]
      : this.session.state.floors.flatMap((f, floor) => f.slots.map((s, i) => ({ floor, slot: i, empty: !s.planting }))).filter((t) => t.empty).map(({ floor, slot: i }) => ({ floor, slot: i }));
    let planted = 0;
    for (const t of targets) {
      // Stop at the first failure (e.g. coins ran out) and show why.
      if (!this.run({ type: 'plant', cropId, ...t }).ok) break;
      planted += 1;
    }
    if (planted > 0) this.lastCrop = cropId;
    return planted;
  }

  placePot(slot: SlotRef, potInstanceId: string): void {
    this.run({ type: 'placePot', potInstanceId, ...slot });
  }

  openBench(slot: SlotRef): void {
    this.openPanel(new PotPanel(this.session, slot, this));
  }

  buyPot(potId: string): void {
    this.run({ type: 'buyPot', potId });
  }

  unlockFloor(floorId: string): void {
    if (this.run({ type: 'unlockFloor', floorId }).ok) this.panel?.close();
  }

  private findPot(potInstanceId: string): SlotRef | null {
    const floors = this.session.state.floors;
    for (let f = 0; f < floors.length; f++) {
      const i = floors[f]!.slots.findIndex((s) => s.potInstanceId === potInstanceId);
      if (i >= 0) return { floor: f, slot: i };
    }
    return null;
  }

  openShop(): void {
    this.sfx.play('tap');
    this.openPanel(new PotShopPanel(this.session, this));
  }

  openFloor(def: FloorDef): void {
    this.sfx.play('tap');
    this.openPanel(new FloorPanel(this.session, def, this));
  }

  openSeeds(): void {
    this.sfx.play('tap');
    this.openPanel(new SeedPanel(this.session, null, this));
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
    const at = (ref: SlotRef) => this.view.slotView(ref.floor, ref.slot).feedbackPoint();
    switch (e.type) {
      case 'planted': {
        this.sfx.play('plant');
        this.view.slotView(e.slot.floor, e.slot.slot).popPlant(0.3);
        const p = at(e.slot);
        if (e.cost > 0) fx.floatText(`-${formatNumber(e.cost)} xu`, p.x, p.y + 40, hex(TOKENS.color.brand.cream));
        break;
      }
      case 'watered': {
        this.sfx.play('water');
        const p = at(e.slot);
        fx.burst(this.view.dot, p.x, p.y, 8, { scale: 0.5, speed: 200, tint: hex(TOKENS.color.brand.sky) });
        break;
      }
      case 'bugCaught': {
        this.sfx.play('bug');
        const p = this.view.slotView(e.slot.floor, e.slot.slot).bugPoint();
        fx.floatText(`+1 ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 20, hex(TOKENS.color.brand.peach));
        break;
      }
      case 'harvested': {
        this.sfx.play('harvest');
        const p = at(e.slot);
        fx.burst(this.art.get(itemFrame(content, e.itemId)), p.x, p.y + 20, Math.min(8, e.qty + 3), { scale: 0.32 });
        fx.floatText(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 10);
        fx.floatText(`+${e.xp} XP`, p.x, p.y + 30, hex(TOKENS.color.brand.sky));
        break;
      }
      case 'sold':
        this.sfx.play('coin');
        this.toasts.show(`Đã bán ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}: +${formatNumber(e.coins)} xu`, 'success', 1800);
        break;
      case 'potUpgraded': {
        this.sfx.play('upgrade');
        const ref = this.findPot(e.potInstanceId);
        if (ref) {
          const p = at(ref);
          fx.burst(this.view.dot, p.x, p.y + 60, 12, { scale: 0.45, tint: hex(TOKENS.color.brand.gold) });
          fx.floatText(`Chậu cấp ${e.level}!`, p.x, p.y, hex(TOKENS.color.brand.gold));
        }
        break;
      }
      case 'floorUnlocked':
        this.sfx.play('levelUp');
        this.view.syncFloors();
        this.view.playFloorOpened(e.index);
        this.toasts.show(`Đã mở ${content.floors.get(e.floorId)?.name.vi ?? 'tầng mới'}!`, 'level', 3500);
        break;
      case 'potBought':
        this.sfx.play('coin');
        this.toasts.show(`Đã mua ${content.pots.get(e.potId)?.name.vi ?? 'chậu'} — chạm chậu trống để đặt vào.`, 'success', 3000);
        break;
      case 'potPlaced': {
        this.sfx.play('upgrade');
        const p = at(e.slot);
        fx.burst(this.view.dot, p.x, p.y + 60, 10, { scale: 0.45, tint: hex(TOKENS.color.brand.jade) });
        break;
      }
      case 'levelUp': {
        this.sfx.play('levelUp');
        const bonus = content.config.levels.levelUpCoins;
        const unlocked = content.cropList.filter((c) => c.unlockLevel === e.level).map((c) => c.name.vi);
        const extra = unlocked.length > 0 ? ` Mở khóa: ${unlocked.join(', ')}.` : '';
        this.toasts.show(`Lên cấp ${e.level}! +${formatNumber(bonus)} xu thưởng.${extra}`, 'level', 4000);
        for (let i = 0; i < 4; i++) {
          const p = this.view.slotView(0, (i * 3) % this.session.state.floors[0]!.slots.length).feedbackPoint();
          fx.burst(this.view.dot, p.x, p.y - 60, 6, { scale: 0.5, speed: 360, tint: hex(TOKENS.color.brand.gold) });
        }
        break;
      }
    }
  }
}
