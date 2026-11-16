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
import { JournalPanel, LettersPanel, NeighborsPanel, OrdersPanel, StallPanel, type WorldActions } from '../ui/worldPanels.ts';
import { FloorInfoPanel, MissionsPanel, SeedTray, VisitBar, type GardenActions, type SeedTrayActions } from '../ui/gardenPanels.ts';
import { visitGarden } from '../render/garden.ts';
import { h } from '../ui/dom.ts';
import type { FloorDef } from '../core/content.ts';
import { ERROR_TEXT, formatNumber } from '../ui/text.ts';
import { Toasts } from '../ui/toast.ts';
import { hex, TOKENS } from '../ui/tokens.ts';
import type { GameSession } from './session.ts';
import type { Sfx } from './sfx.ts';

/** How often the world is advanced while the game is open (orders return, neighbours act). */
const TICK_MS = 5000;

export class Controller implements PanelActions, PotShopActions, WorldActions, GardenActions, SeedTrayActions {
  readonly toasts = new Toasts();
  readonly hud: Hud;
  private panel: Panel | null = null;
  /** Last crop planted, so swiping across empty pots replants it ("gieo lại như cũ"). */
  private lastCrop: string | null = null;
  private readonly tray: SeedTray;
  private visitBar: VisitBar | null = null;
  /** Pot where the dragged seed last failed, so one failure shows one message. */
  private lastDropFail = '';

  constructor(
    private readonly session: GameSession,
    private readonly view: GameView,
    private readonly art: Art,
    private readonly sfx: Sfx,
    private readonly overlay: HTMLElement,
    private readonly saveSound: (on: boolean) => void,
  ) {
    this.hud = new Hud(session, {
      openSeeds: () => this.openSeeds(),
      openStorage: () => this.openStorage(),
      openShop: () => this.openShop(),
      openSettings: () => this.openSettings(),
      openOrders: () => this.open(new OrdersPanel(this.session, this)),
      openStall: () => this.open(new StallPanel(this.session, this)),
      openNeighbors: () => this.open(new NeighborsPanel(this.session, (botId) => this.visit(botId))),
      openMissions: () => this.open(new MissionsPanel(this.session, this)),
      toggleTray: () => this.toggleTray(),
      openJournal: () => this.open(new JournalPanel(this.session, this)),
      openLetters: () => {
        this.open(new LettersPanel(this.session));
        this.run({ type: 'readNotices' }, true);
      },
    });
    this.tray = new SeedTray(session, this, () => this.toggleTray(false));
    overlay.append(this.hud.el, this.tray.el, this.toasts.el);
    view.handlers = {
      onTap: (s, t) => this.tap(s, t),
      onSwipe: (s) => this.swipe(s),
      onLockedFloor: (f) => this.openFloor(f),
      onExpand: (floor) => this.openFloorInfo(floor),
      onFloorSign: (floor) => this.openFloorInfo(floor),
    };
    session.onChange((events) => this.onEvents(events));
    this.welcomeBack();
    setInterval(() => {
      this.hud.update();
      // Countdowns on the order board move every second.
      if (this.panel instanceof OrdersPanel || this.panel instanceof MissionsPanel) this.panel.render();
      this.visitBar?.update();
    }, 1000);
    setInterval(() => this.session.run({ type: 'tick' }), TICK_MS);
    this.hud.update();
  }

  /** First tick after opening: catch up on time away and sum it up in one friendly letter. */
  private welcomeBack(): void {
    const r = this.session.run({ type: 'tick' });
    if (!r.ok) return;
    let sold = 0;
    let coins = 0;
    let gifts = 0;
    for (const e of r.events) {
      if (e.type === 'stallSold') {
        sold += e.qty;
        coins += e.coins;
      } else if (e.type === 'neighborGift') gifts += 1;
    }
    if (sold + gifts === 0) return;
    const parts: string[] = [];
    if (sold > 0) parts.push(`hàng xóm mua ${sold} món ở Sạp (+${formatNumber(coins)} xu)`);
    if (gifts > 0) parts.push(`${gifts} lần ghé tặng quà`);
    this.toasts.show(`Trong lúc bạn vắng: ${parts.join(', ')}. Xem Thư Mây nhé!`, 'success', 6000);
  }

  private open(panel: Panel): void {
    this.sfx.play('tap');
    this.openPanel(panel);
  }

  deliverOrder(slot: number): void {
    this.run({ type: 'deliverOrder', slot });
  }

  skipOrder(slot: number): void {
    this.run({ type: 'skipOrder', slot });
  }

  rushOrder(slot: number): void {
    this.run({ type: 'rushOrder', slot });
  }

  listItem(itemId: string, qty: number, price: number): void {
    this.run({ type: 'listItem', itemId, qty, price });
  }

  cancelListing(listingId: number): void {
    this.run({ type: 'cancelListing', listingId });
  }

  claimJournal(cropId: string): void {
    this.run({ type: 'claimJournal', cropId });
  }

  private bumpStorage(): void {
    const b = this.hud.storageButton;
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }

  /** Big ribbon across the screen; tap or wait to dismiss (DESIGN_SYSTEM 6.8). */
  private celebrate(title: string, sub: string): void {
    const el = h('div', { class: 'celebrate', 'data-test': 'celebrate' }, h('div', { class: 'ribbon-big' }, h('h2', {}, title), sub && h('p', {}, sub)));
    const close = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    };
    el.addEventListener('pointerdown', close);
    setTimeout(close, TOKENS.motion.celebrate.ms * 2);
    this.overlay.append(el);
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

  // --- Seed tray (REDESIGN_V2 3) -------------------------------------------------------------

  toggleTray(on = !this.tray.open): void {
    this.sfx.play('tap');
    this.tray.show(on);
    this.hud.setTrayOpen(on);
  }

  plantAt(x: number, y: number, cropId: string): boolean {
    const ref = this.view.mode === 'home' ? this.view.slotAtScreen(x, y) : null;
    if (!ref) return false;
    const slot = this.session.state.floors[ref.floor]?.slots[ref.slot];
    if (!slot || slot.planting) return false;
    const key = `${ref.floor}:${ref.slot}`;
    const r = this.run({ type: 'plant', cropId, ...ref }, this.lastDropFail === key);
    if (r.ok) {
      this.lastCrop = cropId;
      this.lastDropFail = '';
      return true;
    }
    this.lastDropFail = key;
    return false;
  }

  selectSeed(cropId: string): void {
    this.lastCrop = cropId;
    this.toasts.show(`Đã chọn ${this.session.content.crops.get(cropId)?.name.vi ?? ''}: kéo hạt vào chậu, hoặc vuốt qua các chậu trống.`, 'info', 2400);
  }

  openSeedShop(): void {
    this.openSeeds();
  }

  // --- Floors, missions ----------------------------------------------------------------------

  openFloorInfo(floor: number): void {
    if (this.view.mode !== 'home') return;
    this.sfx.play('tap');
    this.openPanel(new FloorInfoPanel(this.session, floor, this));
  }

  expandFloor(floor: number): void {
    this.run({ type: 'expandFloor', floor });
  }

  upgradeFloorStar(floor: number): void {
    this.run({ type: 'upgradeFloorStar', floor });
  }

  claimMission(index: number): void {
    this.run({ type: 'claimMission', index });
  }

  claimMissionBonus(): void {
    this.run({ type: 'claimMissionBonus' });
  }

  // --- Visiting a neighbour's garden ---------------------------------------------------------

  visit(botId: string): void {
    this.panel?.close();
    this.tray.show(false);
    this.hud.el.classList.add('hidden');
    this.visitBar?.el.remove();
    this.visitBar = new VisitBar(this.session, botId, () => this.goHome());
    this.overlay.append(this.visitBar.el);
    this.sfx.play('levelUp');
    this.view.setSource(() => visitGarden(this.session.content, this.session.state, botId, this.session.now()));
  }

  goHome(): void {
    this.visitBar?.el.remove();
    this.visitBar = null;
    this.hud.el.classList.remove('hidden');
    this.sfx.play('tap');
    this.view.setSource(null);
  }

  private help(ref: SlotRef, target: 'pot' | 'bug', fromSwipe: boolean): void {
    const botId = this.visitBar?.botId;
    if (!botId) return;
    const pot = visitGarden(this.session.content, this.session.state, botId, this.session.now()).floors[ref.floor]?.pots[ref.slot];
    const st = pot?.status;
    const kind = st?.bug && (target === 'bug' || !st.thirsty) ? 'bug' : st?.thirsty ? 'water' : null;
    if (!kind) {
      if (!fromSwipe) this.toasts.show(st?.ripe ? 'Cây của hàng xóm đã chín, để họ tự thu nhé.' : 'Chậu này đang ổn.', 'info', 1600);
      return;
    }
    this.run({ type: 'helpNeighbor', botId, floor: ref.floor, slot: ref.slot, kind }, fromSwipe);
  }

  tap(ref: SlotRef, target: 'pot' | 'bug'): void {
    if (this.view.mode === 'visit') return this.help(ref, target, false);
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
    if (this.view.mode === 'visit') return this.help(ref, 'bug', true);
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
    this.tray.show(false);
    this.hud.setTrayOpen(false);
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
    if (this.tray.open) this.tray.render();
    this.visitBar?.update();
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
        this.view.slotView(e.slot.floor, e.slot.slot).bloom();
        const tex = this.art.get(itemFrame(content, content.items.get(e.itemId)?.baseItem ?? e.itemId));
        // Produce flies in an arc into the Rương Mây button, which bounces when it lands.
        const r = this.hud.storageButton.getBoundingClientRect();
        const target = this.view.screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
        for (let i = 0; i < Math.min(3, e.qty); i++) {
          fx.fly(tex, { x: p.x + (i - 1) * 18, y: p.y + 40 }, target, i * 70, 0.4, i === 0 ? () => this.bumpStorage() : undefined);
        }
        fx.floatText(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 10, e.mutation ? hex(TOKENS.color.brand.gold) : undefined);
        fx.floatText(`+${e.xp} XP`, p.x, p.y + 30, hex(TOKENS.color.brand.sky));
        if (e.mutation) {
          this.sfx.play('levelUp');
          fx.burst(this.view.dot, p.x, p.y, 16, { scale: 0.55, speed: 380, tint: hex(e.mutation === 'jade' ? TOKENS.color.brand.jade : TOKENS.color.brand.gold) });
          const name = content.surprises.mutations.find((m) => m.id === e.mutation)?.name.vi ?? '';
          this.toasts.show(`Biến Dị ${name}! ${content.items.get(e.itemId)?.name.vi ?? ''} bán giá gấp nhiều lần.`, 'level', 3500);
        }
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
      case 'giftFound': {
        this.sfx.play('coin');
        const p = at(e.slot);
        const g = e.gift;
        const label = g.kind === 'coins' ? `Quà: +${formatNumber(g.amount)} xu` : g.kind === 'gems' ? `Quà: +${g.amount} Ngọc Mây` : `Quà: +${g.amount} ${content.items.get(g.itemId ?? '')?.name.vi ?? 'Bọ Mây'}`;
        fx.burst(this.view.dot, p.x, p.y - 30, 12, { scale: 0.5, speed: 300, tint: hex(g.kind === 'gems' ? TOKENS.color.brand.jade : TOKENS.color.brand.gold) });
        fx.floatText(label, p.x, p.y - 60, hex(TOKENS.color.brand.gold));
        break;
      }
      case 'ordersArrived':
        if (!this.panel) this.toasts.show(e.slots.length > 1 ? `Khinh khí cầu mang ${e.slots.length} đơn hàng mới tới!` : 'Khinh khí cầu mang đơn hàng mới tới!', 'info', 2200);
        break;
      case 'orderDelivered': {
        this.sfx.play('coin');
        const who = content.bots.get(e.customer)?.name.vi ?? 'Khách';
        const gems = e.gems > 0 ? `, +${e.gems} Ngọc Mây` : '';
        this.toasts.show(`${who} cảm ơn! +${formatNumber(e.coins)} xu, +${e.xp} XP${gems}`, e.rare ? 'level' : 'success', 2600);
        break;
      }
      case 'journalClaimed':
        this.sfx.play('upgrade');
        this.toasts.show(`Sổ Tay: ${content.crops.get(e.cropId)?.name.vi ?? ''} đạt ${e.harvests} lần thu — +${e.gems} Ngọc Mây`, 'level', 3000);
        break;
      case 'itemListed':
        this.sfx.play('tap');
        this.toasts.show('Đã bày lên Sạp Phú Bà. Hàng xóm sẽ ghé mua.', 'info', 2000);
        break;
      case 'stallSold':
        this.sfx.play('coin');
        this.toasts.show(`${content.bots.get(e.botId)?.name.vi ?? 'Hàng xóm'} mua ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}: +${formatNumber(e.coins)} xu`, 'success', 3000);
        break;
      case 'neighborGift':
        this.sfx.play('bug');
        this.toasts.show(`${content.bots.get(e.botId)?.name.vi ?? 'Hàng xóm'} ghé vườn tặng ${e.kind === 'coins' ? `${e.amount} xu` : `${e.amount} Bọ Mây`}`, 'info', 3000);
        break;
      case 'floorExpanded': {
        this.sfx.play('upgrade');
        this.view.refresh();
        this.toasts.show(`Đã thêm chậu thứ ${e.slot + 1} cho ${content.floors.get(this.session.state.floors[e.floor]!.floorId)?.name.vi ?? 'tầng'}!`, 'success', 2400);
        break;
      }
      case 'floorStarred':
        this.sfx.play('levelUp');
        this.view.playStar(e.floor);
        this.toasts.show(`Tầng đạt ${e.stars} sao! Cây trên tầng lớn nhanh hơn.`, 'level', 3000);
        break;
      case 'missionDone': {
        const name = this.session.content.missions.pool.find((m) => m.id === e.missionId)?.name.vi ?? '';
        this.sfx.play('upgrade');
        this.toasts.show(`Xong nhiệm vụ: ${name}! Mở Nhiệm vụ để nhận thưởng.`, 'level', 2600);
        break;
      }
      case 'missionClaimed':
      case 'missionBonusClaimed':
        this.sfx.play('coin');
        this.toasts.show(`Nhận thưởng: +${formatNumber(e.coins)} xu${e.xp ? `, +${e.xp} XP` : ''}${e.gems ? `, +${e.gems} Ngọc Mây` : ''}`, 'success', 2200);
        break;
      case 'neighborHelped': {
        this.sfx.play(e.kind === 'water' ? 'water' : 'bug');
        const p = at({ floor: e.floor, slot: e.slot });
        fx.burst(this.view.dot, p.x, p.y, 12, { scale: 0.5, speed: 260, tint: hex(e.kind === 'water' ? TOKENS.color.brand.sky : TOKENS.color.brand.peach) });
        fx.floatText(`+${formatNumber(e.coins)} xu`, p.x, p.y - 20, hex(TOKENS.color.brand.gold));
        fx.floatText(e.kind === 'water' ? 'Đã tưới giúp!' : 'Đã bắt bọ giúp!', p.x, p.y + 20, hex(TOKENS.color.brand.cream));
        break;
      }
      case 'levelUp': {
        this.sfx.play('levelUp');
        const bonus = content.config.levels.levelUpCoins;
        const unlocked = content.cropList.filter((c) => c.unlockLevel === e.level).map((c) => c.name.vi);
        const extra = unlocked.length > 0 ? ` Mở khóa: ${unlocked.join(', ')}.` : '';
        const floor = content.floorList.find((f) => f.unlockLevel === e.level);
        const more = floor ? ` Có thể mở ${floor.name.vi}.` : '';
        const pots = content.potList.filter((p) => p.unlockLevel === e.level && p.price !== null).map((p) => p.name.vi);
        const potText = pots.length > 0 ? ` Lò Gốm có ${pots.join(', ')}.` : '';
        this.celebrate(`Lên cấp ${e.level}!`, `+${formatNumber(bonus)} xu thưởng.${extra}${more}${potText}`);
        for (let i = 0; i < 4; i++) {
          const p = this.view.slotView(0, (i * 3) % this.session.state.floors[0]!.slots.length).feedbackPoint();
          fx.burst(this.view.dot, p.x, p.y - 60, 6, { scale: 0.5, speed: 360, tint: hex(TOKENS.color.brand.gold) });
        }
        break;
      }
    }
  }
}
