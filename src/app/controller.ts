// Connects player input to game commands, and game events to feedback (effects, sound, HUD).

import { TimersPanel } from '../ui/timersPanel.ts';
import { AltitudeGauge } from '../ui/altitude.ts';
import type { Command, GameEvent, Result, SlotRef } from '../core/game.ts';
import { nextFloor } from '../core/game.ts';
import { cropStatus } from '../systems/growth.ts';
import { levelUpReward } from '../systems/economy.ts';
import type { GameView } from '../render/scene.ts';
import { itemFrame } from '../render/assets.ts';
import type { Art } from '../render/assets.ts';
import { Hud } from '../ui/hud.ts';
import { Panel, SeedPanel, StoragePanel, type PanelActions } from '../ui/panels.ts';
import { EventPanel, PotCollectionPanel, PotPanel, type PotSystemActions } from '../ui/potSystemPanels.ts';
import { potIcon } from '../ui/potPanels.ts';
import { potLook } from '../systems/pots.ts';
import { SettingsPanel } from '../ui/settings.ts';
import { FloorPanel, PotShopPanel, type PotShopActions } from '../ui/potPanels.ts';
import { BirdsPanel, type BirdActions } from '../ui/birdPanels.ts';
import { WorkshopPanel, type WorkshopActions } from '../ui/workshopPanel.ts';
import { SeaPanel } from '../ui/seaPanel.ts';
import { VillagePanel } from '../ui/villagePanel.ts';
import { PetPanel } from '../ui/petPanel.ts';
import { CastingPanel, type CastingActions } from '../ui/castingPanel.ts';
import { rentEndsSoon } from '../systems/birds.ts';
import { JournalPanel, LettersPanel, NeighborsPanel, OrdersPanel, StallPanel, type WorldActions } from '../ui/worldPanels.ts';
import { FeatureTutorialPanel, QuestCenterPanel, TODAY } from '../ui/questPanels.ts';
import { pendingTutorial } from '../systems/quests.ts';
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

export class Controller implements CastingActions, WorkshopActions, BirdActions, PanelActions, PotShopActions, WorldActions, GardenActions, SeedTrayActions, PotSystemActions {
  readonly toasts = new Toasts();
  readonly hud: Hud;
  private panel: Panel | null = null;
  /** Last crop planted, so swiping across empty pots replants it ("gieo lại như cũ"). */
  private lastCrop: string | null = null;
  private readonly tray: SeedTray;
  private visitBar: VisitBar | null = null;
  /** Pot where the dragged seed last failed, so one failure shows one message. */
  private lastDropFail = '';

  private readonly altitude: AltitudeGauge;
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
      openNeighbors: () => this.open(new NeighborsPanel(this.session, (botId) => this.visit(botId), (botId) => this.open(new StallPanel(this.session, this, 'market', botId)))),
      openMissions: () => this.openQuests(TODAY),
      openQuests: (track) => this.openQuests(track ?? TODAY),
      claimQuest: (id) => this.claimQuest(id),
      openEvent: () => this.open(new EventPanel(this.session, this)),
      toggleTray: () => this.toggleTray(),
      openJournal: () => this.open(new JournalPanel(this.session, this)),
      openBirds: () => this.open(new BirdsPanel(this.session, this)),
      openWorkshop: () => this.openWorkshop(),
      openSea: () => this.openSea(),
      tapXuxu: () => this.tapXuxu(),
      openVillage: () => this.openVillage(),
      openTimers: () => this.open(new TimersPanel(this.session)),
      goVillage: () => {
        this.panel?.close();
        this.view.focusVillage();
      },
      claimLuck: () => this.run({ type: 'claimSessionLuck' }),
      openLetters: () => {
        this.open(new LettersPanel(this.session));
        this.run({ type: 'readNotices' }, true);
      },
    });
    this.tray = new SeedTray(session, this, () => this.toggleTray(false));
    // Chỉ thị 11 § C3: altitude gauge and the zone banner.
    this.altitude = new AltitudeGauge(session, { goFloor: (i) => this.view.focusFloor(i, 600), openVillage: () => this.view.focusVillage() });
    overlay.append(this.hud.el, this.altitude.el, this.altitude.bannerEl, this.altitude.ripeEl, this.tray.el, this.toasts.el);
    view.onCamera = (f) => (this.view.mode === 'home' ? this.altitude.setCamera(f) : undefined);
    view.handlers = {
      onTap: (s, t) => this.tap(s, t),
      onSwipe: (s) => this.swipe(s),
      onLockedFloor: (f) => this.openFloor(f),
      onExpand: (floor) => this.openFloorInfo(floor),
      onFloorSign: (floor) => this.openFloorInfo(floor),
      onHouse: (id) => this.tapHouse(id),
    };
    session.onChange((events) => this.onEvents(events));
    this.welcomeBack();
    setTimeout(() => this.maybeTutorial(), 1500);
    setInterval(() => {
      this.hud.update();
      // Countdowns on the order board move every second.
      if (this.panel instanceof OrdersPanel || this.panel instanceof MissionsPanel || this.panel instanceof QuestCenterPanel || this.panel instanceof BirdsPanel || this.panel instanceof WorkshopPanel) this.panel.render();
      if (this.panel instanceof SeaPanel || this.panel instanceof VillagePanel || this.panel instanceof PetPanel || this.panel instanceof TimersPanel) this.panel.tick();
      this.warnRent();
      this.visitBar?.update();
      // A feature that just opened is introduced once nothing else is on screen.
      if (++this.idleTicks % 3 === 0) this.maybeTutorial();
      // Ripe pots appear over time (no event): refresh the gauge and the "Có X chậu chín" button.
      if (this.idleTicks % 3 === 1) this.altitude.update();
    }, 1000);
    setInterval(() => this.session.run({ type: 'tick' }), TICK_MS);
    this.hud.update();
  }

  // --- Quests and tutorials (đợt 2) ----------------------------------------------------------

  private idleTicks = 0;

  openQuests(track: string): void {
    this.sfx.play('tap');
    this.open(new QuestCenterPanel(this.session, track, this, this));
  }

  claimQuest(questId: string): void {
    this.run({ type: 'claimQuest', questId });
  }

  /** Introduces a feature the first time it opens, when no window is in the way. */
  private maybeTutorial(): void {
    if (this.panel || this.visitBar) return;
    const p = pendingTutorial(this.session.content, this.session.state);
    if (!p) return;
    this.sfx.play('levelUp');
    this.open(
      new FeatureTutorialPanel(
        this.session,
        p.featureId,
        p.tutorialId,
        (f) => this.openFeature(f),
        (id) => this.run({ type: 'seeTutorial', tutorialId: id }, true),
      ),
    );
  }

  private openFeature(feature: string): void {
    const go: Record<string, () => void> = {
      orders: () => this.open(new OrdersPanel(this.session, this)),
      stall: () => this.open(new StallPanel(this.session, this)),
      neighbors: () => this.open(new NeighborsPanel(this.session, (botId) => this.visit(botId), (botId) => this.open(new StallPanel(this.session, this, 'market', botId)))),
      journal: () => this.open(new JournalPanel(this.session, this)),
      event: () => this.open(new EventPanel(this.session, this)),
      shop: () => this.openShop(),
      birds: () => this.open(new BirdsPanel(this.session, this)),
      workshop: () => this.openWorkshop(),
      sea: () => this.openSea(),
      fishing: () => this.openFishing(),
      pets: () => this.openPets(),
      decor: () => this.openFloorInfo(0),
    };
    setTimeout(() => go[feature]?.(), 250);
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

  deliverOrder(slot: number, birdId?: string): void {
    this.run({ type: 'deliverOrder', slot, ...(birdId ? { birdId } : {}) });
  }

  askNeighbors(slot: number): void {
    this.run({ type: 'askNeighbors', slot });
  }

  skipOrder(slot: number): void {
    this.run({ type: 'skipOrder', slot });
  }

  rushOrder(slot: number): void {
    this.run({ type: 'rushOrder', slot });
  }

  buyFromNeighbor(botId: string, itemId: string, qty: number): void {
    this.run({ type: 'buyFromNeighbor', botId, itemId, qty });
  }

  rerollBazaar(): void {
    this.run({ type: 'rerollBazaar' });
  }

  buyBazaar(slot: number): void {
    this.run({ type: 'buyBazaar', slot });
  }

  listItem(itemId: string, qty: number, price: number): void {
    this.run({ type: 'listItem', itemId, qty, price });
  }

  cancelListing(listingId: number): void {
    this.run({ type: 'cancelListing', listingId });
  }

  // --- Đúc chậu (chỉ thị 10 § 3.8) -----------------------------------------------------------

  /** Opens the casting window (from the Lò Gốm; chỉ thị 11: the village kiln calls this too). */
  openCasting(): void {
    this.open(new CastingPanel(this.session, this));
  }

  castPot(potId: string): void {
    this.run({ type: 'castPot', potId });
  }

  // --- Biển Mây Bí Ẩn (chỉ thị 10 § 3.7) ------------------------------------------------------

  /** Opens the Biển Mây window (chỉ thị 11: the Cổng Biển Mây in the village calls this same function). */
  openSea(): void {
    this.open(new SeaPanel(this.session, this));
  }

  blowCloud(cell: number): void {
    this.run({ type: 'blowCloud', cell });
  }

  // Câu cá (chỉ thị 10 § 3.9): a tab of the Biển Mây window; chỉ thị 11's Bến Câu Cá opens it too.
  openFishing(): void {
    this.open(new SeaPanel(this.session, this, 'fish'));
  }

  claimFreeBait(): void {
    this.run({ type: 'claimFreeBait' });
  }

  craftBait(bait: string): void {
    this.run({ type: 'craftBait', bait });
  }

  castLine(bait: string): void {
    this.run({ type: 'castLine', bait });
  }

  reelFish(success: boolean): void {
    this.run({ type: 'reelFish', success });
  }

  exchangeFish(fishId: string, option: number): void {
    this.run({ type: 'exchangeFish', fishId, option });
  }

  claimFishBook(): void {
    this.run({ type: 'claimFishBook' });
  }

  buyDecor(itemId: string): void {
    this.run({ type: 'buyDecor', itemId });
  }

  placeDecor(floor: number, slot: number, itemId: string | null): void {
    this.run({ type: 'placeDecor', floor, slot, itemId });
  }

  // --- Xưởng Bọ (chỉ thị 10 § 3.5) ------------------------------------------------------------

  /** Opens the Xưởng Bọ window (chỉ thị 11: the village house calls this same function). */
  openWorkshop(): void {
    this.open(new WorkshopPanel(this.session, this));
  }

  startJob(recipeId: string): void {
    this.run({ type: 'startJob', recipeId });
  }

  upgradeMachine(machineId: string): void {
    this.run({ type: 'upgradeMachine', machineId });
  }

  buyMachineSlot(machineId: string): void {
    this.run({ type: 'buyMachineSlot', machineId });
  }

  // --- Birds (chỉ thị 10 § 3.3) -------------------------------------------------------------

  obtainBird(species: string, how: 'rent' | 'buy'): void {
    this.run({ type: 'obtainBird', species, how });
  }

  feedBird(birdId: string, itemId: string): void {
    this.run({ type: 'feedBird', birdId, itemId });
  }

  feedAllBirds(): void {
    this.run({ type: 'feedAllBirds' });
  }

  placeBird(birdId: string, floor: number, branch: number): void {
    this.run({ type: 'placeBird', birdId, floor, branch });
  }

  buyMillet(qty: number): void {
    this.run({ type: 'buyMillet', qty });
  }

  private readonly rentWarned = new Set<string>();

  /** A rented bird flies home within the hour: say so once (no dialog). */
  private warnRent(): void {
    const { content, state } = this.session;
    const now = this.session.now();
    for (const b of state.birds) {
      if (this.rentWarned.has(b.id) || !rentEndsSoon(content, b, now)) continue;
      this.rentWarned.add(b.id);
      this.toasts.show(`${content.birds?.get(b.species)?.name.vi ?? 'Chim'} thuê sắp hết hạn, còn dưới 1 giờ nữa sẽ bay về.`, 'info', 3200);
    }
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
  private celebrate(title: string, sub: string, art: HTMLElement | null = null): void {
    const el = h('div', { class: 'celebrate', 'data-test': 'celebrate' }, art && h('div', { class: 'celebrate-art' }, art), h('div', { class: 'ribbon-big' }, h('h2', {}, title), sub && h('p', {}, sub)));
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

  // --- Pot system (POT_SYSTEM) -----------------------------------------------------------------

  obtainPot(potId: string): void {
    this.run({ type: 'obtainPot', potId });
  }

  claimEventMilestone(eventId: string): void {
    this.run({ type: 'claimEventMilestone', eventId });
  }

  claimBookReward(): void {
    this.run({ type: 'claimBookReward' });
  }

  openCollection(): void {
    this.sfx.play('tap');
    this.openPanel(new PotCollectionPanel(this.session, this));
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
    this.altitude.el.hidden = true;
    this.altitude.update();
  }

  goHome(): void {
    this.visitBar?.el.remove();
    this.visitBar = null;
    this.hud.el.classList.remove('hidden');
    this.sfx.play('tap');
    this.view.setSource(null);
    this.altitude.el.hidden = false;
    this.altitude.update();
  }

  private help(ref: SlotRef, target: 'pot' | 'bug', fromSwipe: boolean): void {
    const botId = this.visitBar?.botId;
    if (!botId) return;
    const pot = visitGarden(this.session.content, this.session.state, botId, this.session.now()).floors[ref.floor]?.pots[ref.slot];
    const st = pot?.status;
    const kind = st?.bug && (target === 'bug' || !st.thirsty) ? 'bug' : st?.thirsty ? 'water' : null;
    // Chỉ thị 12 B4: a ripe pot is for stealing (not while sweeping: stealing is always a deliberate tap).
    if (!kind && st?.ripe && !st.stolen && !fromSwipe) return void this.run({ type: 'stealCrop', botId, floor: ref.floor, slot: ref.slot });
    if (!kind) {
      if (!fromSwipe) this.toasts.show(st?.stolen ? 'Chậu này đã có dấu chân rồi.' : 'Chậu này đang ổn.', 'info', 1600);
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

  sellBugs(itemId: string, qty: number): void {
    this.run({ type: 'sellBugs', itemId, qty });
  }

  sell(itemId: string, qty: number): void {
    this.run({ type: 'sell', itemId, qty });
  }

  upgradeStorage(): void {
    this.run({ type: 'upgradeStorage' });
  }

  cloudRain(floor: number): void {
    this.run({ type: 'cloudRain', floor });
  }

  upgradePot(potInstanceId: string): void {
    this.run({ type: 'upgradePot', potInstanceId });
  }

  starUpPot(potInstanceId: string): void {
    this.run({ type: 'starUpPot', potInstanceId });
  }

  combineShards(potId: string): void {
    this.run({ type: 'combineShards', potId });
  }

  // --- Làng Phú Bà (chỉ thị 11 § D) -------------------------------------------------------------

  openVillage(): void {
    this.open(new VillagePanel(this.session, this));
  }

  upgradeHouse(house: string): void {
    this.run({ type: 'upgradeHouse', house });
  }

  claimCheckIn(): void {
    this.run({ type: 'claimCheckIn' });
  }

  // --- Thú cưng (chỉ thị 11 § E) -------------------------------------------------------------------

  openPets(): void {
    this.open(new PetPanel(this.session, this));
  }

  obtainPet(species: string, pay: 'coins' | 'gems' | 'shards'): void {
    this.run({ type: 'obtainPet', species, pay });
  }

  feedPet(species: string, itemId: string): void {
    this.run({ type: 'feedPet', species, itemId });
  }

  patPet(species: string): void {
    this.run({ type: 'patPet', species });
  }

  walkPet(species: string, active: boolean): void {
    this.run({ type: 'walkPet', species, active });
  }

  guardFloor(species: string, floor: number): void {
    this.run({ type: 'guardFloor', species, floor });
  }

  starUpPet(species: string): void {
    this.run({ type: 'starUpPet', species });
  }

  jadeRain(): void {
    this.run({ type: 'jadeRain' });
  }

  sendErrand(index: number, species: string): void {
    this.run({ type: 'sendErrand', index, species });
  }

  rerollErrand(index: number): void {
    this.run({ type: 'rerollErrand', index });
  }

  claimErrand(index: number): void {
    this.run({ type: 'claimErrand', index });
  }

  toggleReplant(on: boolean): void {
    this.run({ type: 'toggleReplant', on });
  }

  /** A house tapped in the village scene (§ D1): open its feature, or say when it opens. */
  private tapHouse(id: string): void {
    const { content, state } = this.session;
    this.sfx.play('tap');
    // Chỉ thị 12 A7 G1: the Dinh Phú Bà sign carries the Phú Bà board (league, enemies, visits).
    if (id === 'sign') return void this.open(new NeighborsPanel(this.session, (botId) => this.visit(botId), (botId) => this.open(new StallPanel(this.session, this, 'market', botId))));
    if (id === 'river') {
      const lv = content.fishing?.unlockLevel ?? Infinity;
      if (state.player.level < lv) return void this.toasts.show(`Bến Câu Cá mở ở cấp ${lv}.`, 'info', 2000);
      return this.openHouse('fishing');
    }
    const h = content.village?.houses.find((x) => x.id === id);
    if (!h) return;
    if (state.player.level < h.unlockLevel) return void this.toasts.show(`${h.name.vi} mở ở cấp ${h.unlockLevel}.`, 'info', 2000);
    this.openHouse(h.feature);
  }

  /** A house opens its feature (the toolbar buttons still work too). */
  openHouse(feature: string): void {
    if (feature === 'missions') return this.openQuests(TODAY);
    this.openFeature(feature);
  }

  tapXuxu(): void {
    this.run({ type: 'tapXuxu' });
  }

  quickSell(): void {
    this.run({ type: 'quickSell' });
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
    this.altitude.update();
    if (this.panel instanceof SeaPanel) this.panel.react(events);
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
      case 'birdCaught': {
        // Only a catch happening now is animated; ones from time away were summed up already.
        if (this.session.now() - e.at > 15_000) break;
        const p = this.view.slotView(e.floor, e.slot).bugPoint();
        this.view.birdCatch(e.birdId, e.floor, e.slot);
        setTimeout(() => {
          this.sfx.play('bug');
          fx.floatText(`+1 ${content.items.get(e.itemId)?.name.vi ?? ''}${e.better ? ' (hiếm hơn!)' : ''}`, p.x, p.y - 20, hex(TOKENS.color.brand.peach));
        }, 700);
        break;
      }
      case 'potCast': {
        this.sfx.play('upgrade');
        const name = content.pots.get(e.potId)?.name.vi ?? 'Chậu';
        this.toasts.show(e.perfect ? `Đúc thành công ${name} Hoàn Mỹ ★! Chậu đã vào kho chậu.` : `Đúc thành công ${name}! Chậu đã vào kho chậu.`, 'level', 3000);
        break;
      }
      case 'fishReeled':
        if (e.landed) {
          this.sfx.play('upgrade');
          this.toasts.show(`${e.first ? 'Cá mới! ' : ''}Câu được ${content.fish.get(e.fishId)?.name.vi ?? 'cá'}`, e.first ? 'level' : 'success', 2400);
        }
        break;
      case 'baitGot':
        this.sfx.play('coin');
        this.toasts.show(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, 'success', 1600);
        break;
      case 'fishExchanged': {
        this.sfx.play('coin');
        const got = [e.coins ? `${formatNumber(e.coins)} xu` : '', ...Object.entries(e.items).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? ''}`)].filter(Boolean).join(', ');
        this.toasts.show(`Đổi cá được ${got}`, 'success', 2000);
        break;
      }
      case 'fishBookClaimed':
        this.sfx.play('upgrade');
        this.toasts.show('Nhận thưởng Sổ Cá!', 'level', 2000);
        break;
      case 'decorBought':
        this.sfx.play('coin');
        this.toasts.show(`Đã mua ${content.items.get(e.itemId)?.name.vi ?? ''}. Đặt vào khe trang trí của tầng.`, 'success', 2200);
        break;
      case 'petObtained': {
        const sp = content.pets?.species.find((x) => x.id === e.species);
        this.sfx.play('upgrade');
        this.toasts.show(e.gift ? `Quà mở Chợ: ${sp?.name.vi ?? 'thú cưng'} về ở với bạn! Ghé Nhà Thú Cưng nhé.` : `${sp?.name.vi ?? 'Thú cưng'} đã về nhà!`, 'level', 3000);
        break;
      }
      case 'petFed':
        this.sfx.play(e.liked ? 'upgrade' : 'tap');
        this.toasts.show(e.liked ? 'Món bé thích! Thân Thiết tăng nhiều ♥' : 'Bé ăn ngon lành.', 'success', 1600);
        break;
      case 'petPatted':
        if (e.bond > 0) this.sfx.play('tap');
        break;
      case 'petCaught':
        this.view.petGoTo(e.floor, e.species);
        break;
      case 'petReplanted':
        this.view.petGoTo(e.slot.floor, e.species, e.slot.slot);
        break;
      case 'sparrowGift':
        this.toasts.show(`Sẻ Mầm mang về ${e.bags > 1 ? `${e.bags} túi quà` : 'túi quà'}: ${formatNumber(e.coins)} xu`, 'success', 2400);
        break;
      case 'blessed':
        this.toasts.show(`Rồng Ban Lộc: lần thu hoạch này được nhân đôi (${e.qty})!`, 'level', 2400);
        break;
      case 'petHarvested':
        this.view.petGoTo(e.floor, e.species);
        if (e.stopped) this.toasts.show('Sẻ Mầm dừng thu hoạch hộ vì kho đầy.', 'info', 2400);
        break;
      case 'stallRestocked':
        this.toasts.show(`Mèo bày lại ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''} lên Sạp.`, 'success', 2000);
        break;
      case 'errandSent':
        this.sfx.play('tap');
        this.toasts.show('Bé lon ton đi làm việc vặt. Về rồi nhớ nhận túi quà nhé!', 'success', 2000);
        break;
      case 'errandClaimed': {
        this.sfx.play('upgrade');
        const got = [e.coins ? `${formatNumber(e.coins)} xu` : '', ...Object.entries(e.items).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? ''}`), e.energy ? `${e.energy} gió` : ''].filter(Boolean).join(', ');
        this.toasts.show(`Túi quà việc vặt${e.fit ? ' (hợp nghề!)' : ''}: ${got || 'thân thiết hàng xóm'}`, 'level', 2800);
        break;
      }
      case 'petStarred':
        this.sfx.play('upgrade');
        this.toasts.show(`Thú cưng lên ${e.stars}★! Kỹ năng mạnh hơn.`, 'level', 2400);
        break;
      case 'jadeRained':
        this.sfx.play('upgrade');
        this.toasts.show(`Mưa Ngọc! Tưới ${e.pots} chậu, rút ngắn ${Math.round(e.savedMs / 60000)} phút lớn.`, 'level', 2400);
        break;
      case 'seedRefunded':
        this.toasts.show('Sẻ Mầm nhặt lại được tiền hạt!', 'success', 1600);
        break;
      case 'houseUpgradeStarted':
        this.sfx.play('tap');
        this.toasts.show(`Xu Xu bắt đầu nâng ${content.village?.houses.find((x) => x.id === e.house)?.name.vi ?? 'nhà'} lên cấp ${e.level}. Nhà vẫn dùng được trong lúc nâng.`, 'success', 2600);
        break;
      case 'houseUpgraded':
        this.sfx.play('upgrade');
        this.toasts.show(`${content.village?.houses.find((x) => x.id === e.house)?.name.vi ?? 'Nhà'} đã lên cấp ${e.level}!`, 'level', 2600);
        break;
      case 'medalAwarded':
        this.sfx.play('upgrade');
        this.toasts.show(`${content.village?.medals.find((m) => m.floor === e.floor)?.name.vi ?? 'Huy Chương Độ Cao'}! Có quà lớn trong túi.`, 'level', 3200);
        break;
      case 'checkedIn':
        this.sfx.play('coin');
        this.toasts.show(`Điểm danh ngày ${e.day}: có quà!`, 'success', 2000);
        break;
      case 'xuxuTapped': {
        const gift = e.gift ? Object.entries(e.gift.items).map(([id, q]) => `${q} ${content.items.get(id)?.name.vi ?? ''}`).concat(e.gift.coins ? [`${formatNumber(e.gift.coins)} xu`] : []).join(', ') : '';
        this.hud.say(gift ? `Quà nhỏ cho chủ vườn: ${gift}!` : e.line, gift ? 'happy' : 'wave');
        this.sfx.play(gift ? 'coin' : 'tap');
        break;
      }
      case 'potStarred':
        this.sfx.play('upgrade');
        this.toasts.show(`Chậu lên ★${e.stars}! Chỉ số chính tăng thêm.`, 'level', 2400);
        break;
      case 'potCombined':
        this.sfx.play('upgrade');
        this.toasts.show(`Ghép xong ${content.pots.get(e.potId)?.name.vi ?? 'chậu'}! Chậu đã vào kho chậu.`, 'level', 2600);
        break;
      case 'potToShards':
        this.toasts.show(`Đã có ${content.pots.get(e.potId)?.name.vi ?? 'chậu này'} — đổi thành ${e.qty} mảnh để nâng sao.`, 'success', 2800);
        break;
      case 'quickSold':
        this.sfx.play('coin');
        this.toasts.show(`Bán nhanh ${formatNumber(e.items.reduce((a, x) => a + x.qty, 0))} món: +${formatNumber(e.coins)} xu`, 'success', 2200);
        break;
      case 'cloudBlown': {
        const names = e.finds.map((f) => `${f.qty} ${content.items.get(f.itemId)?.name.vi ?? ''}`).join(', ');
        if (e.cleared) {
          this.sfx.play('upgrade');
          this.toasts.show(`Dọn sạch Biển Mây! Thưởng: ${names}. Bản đồ mới đã mở.`, 'level', 3200);
        } else if (e.chest !== undefined) {
          this.sfx.play('upgrade');
          this.toasts.show(`Mở rương: ${names}${e.potInstanceId ? ', và một chậu mới!' : ''}`, 'level', 2800);
        } else this.sfx.play(e.finds.length ? 'coin' : 'tap');
        break;
      }
      case 'bazaarRerolled':
        this.sfx.play(e.best === 'epic' || e.best === 'legendary' ? 'upgrade' : 'tap');
        if (e.best === 'legendary') this.toasts.show('Trời ơi! Sạp vừa bày món Huyền Thoại!', 'level', 3000);
        else if (e.best === 'epic') this.toasts.show('Có món Sử Thi trên sạp kìa!', 'level', 2600);
        break;
      case 'bazaarBought': {
        this.sfx.play(e.rarity === 'epic' || e.rarity === 'legendary' ? 'upgrade' : 'coin');
        const name = e.kind === 'pot' ? content.pots.get(e.itemId)?.name.vi : content.items.get(e.itemId)?.name.vi;
        const paid = `−${formatNumber(e.price)} ${e.currency === 'gems' ? 'Ngọc Mây' : 'xu'}`;
        this.toasts.show(e.kind === 'pot' ? `Săn được ${name}! Chậu đã vào kho chậu. ${paid}` : `Đã mua ${e.qty} ${name ?? ''}: ${paid}`, e.rarity === 'legendary' || e.rarity === 'epic' ? 'level' : 'success', 2600);
        break;
      }
      case 'bugsSold':
        this.sfx.play('coin');
        this.toasts.show(`Thương lái mua ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}: +${formatNumber(e.coins)} xu`, 'success', 2200);
        break;
      case 'goodsMade':
        this.toasts.show(`Xưởng Bọ làm xong: ${content.items.get(e.itemId)?.name.vi ?? ''}`, 'success', 2200);
        break;
      case 'jobStarted':
        this.sfx.play('tap');
        break;
      case 'machineStar':
        this.sfx.play('upgrade');
        this.toasts.show(`${content.machines?.get(e.machine)?.name.vi ?? 'Máy'} lên ${e.stars} sao: làm nhanh hơn, đơn có hàng của máy thưởng nhiều hơn.`, 'level', 2600);
        break;
      case 'birdLevelUp': {
        const b = this.session.state.birds.find((x) => x.id === e.birdId);
        this.toasts.show(`${content.birds?.get(b?.species ?? '')?.name.vi ?? 'Chim'} lên cấp ${e.level}: bắt nhanh hơn, no lâu hơn!`, 'level', 2600);
        break;
      }
      case 'birdLeft':
        this.toasts.show(`${content.birds?.get(e.species)?.name.vi ?? 'Chim'} thuê đã hết hạn và bay về. Bọ nó bắt vẫn ở trong Rương.`, 'info', 3200);
        break;
      case 'birdObtained':
        this.sfx.play('upgrade');
        this.toasts.show(`${content.birds?.get(e.species)?.name.vi ?? 'Chim'} đã đậu lên cành!`, 'level', 2200);
        break;
      case 'birdFed':
        this.sfx.play('water');
        break;
      case 'newBug': {
        // Chỉ thị 10 § 3.2: first catch of a kind goes into the Sổ Sâu Bọ.
        this.sfx.play('upgrade');
        this.toasts.show(`Bọ mới! ${content.items.get(e.itemId)?.name.vi ?? ''} đã vào Sổ Sâu Bọ`, 'level', 2400);
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
        this.sfx.play(e.milestone ? 'levelUp' : 'upgrade');
        const ref = this.findPot(e.potInstanceId);
        if (ref) {
          const p = at(ref);
          // Materials gather into the pot, it flashes, then the new look pops (SlotView).
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            fx.fly(this.view.dot, { x: p.x + Math.cos(a) * 160, y: p.y + 60 + Math.sin(a) * 90 }, { x: p.x, y: p.y + 60 }, i * 25, 0.5);
          }
          this.view.slotView(ref.floor, ref.slot).bloom();
          fx.burst(this.view.dot, p.x, p.y + 60, e.milestone ? 26 : 12, { scale: 0.5, speed: e.milestone ? 420 : 260, tint: hex(TOKENS.color.brand.gold) });
          fx.floatText(`Chậu cấp ${e.level}!`, p.x, p.y, hex(TOKENS.color.brand.gold));
        }
        const pot = this.session.state.pots[e.potInstanceId];
        const def = pot && content.pots.get(pot.potId);
        if (def && (e.milestone || e.skills.length > 0)) {
          const skills = def.skills.filter((s) => e.skills.includes(s.id)).map((s) => `Kỹ năng mới: ${s.name.vi} — ${s.desc.vi}`);
          this.celebrate(e.milestone ? `Tiến hóa: ${potLook(def, e.level).look?.name.vi ?? ''}` : `${def.name.vi} cấp ${e.level}`, skills.join(' '), potIcon(def, e.level, 150));
        }
        break;
      }
      case 'potObtained': {
        this.sfx.play('levelUp');
        const def = content.pots.get(e.potId)!;
        this.celebrate(`Nhận chậu mới: ${def.name.vi}`, `${e.source === 'event' ? 'Chậu sự kiện — giữ mãi mãi.' : 'Chậu nhiệm vụ.'} Đã vào kho chậu: chạm một chậu trống để đặt.`, potIcon(def, 1, 160));
        break;
      }
      case 'materialFound': {
        const p = at(e.slot);
        fx.floatText(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 90, hex(TOKENS.color.brand.peach));
        break;
      }
      case 'eventMilestoneClaimed':
        this.sfx.play('coin');
        if (!e.pot) this.toasts.show('Đã nhận quà lễ hội!', 'success', 2000);
        break;
      case 'storageUpgraded':
        this.sfx.play('upgrade');
        this.toasts.show(`Rương Mây chứa được ${formatNumber(e.capacity)} món!`, 'success', 2400);
        break;
      case 'cloudRained':
        this.sfx.play('levelUp');
        this.view.refresh();
        this.toasts.show(`Mưa Mây! ${e.pots} cây chín ngay (−${e.gems} Ngọc Mây).`, 'level', 2600);
        break;
      case 'bookRewardClaimed':
        this.sfx.play('coin');
        this.toasts.show(`Bộ sưu tập ${e.lines} dòng chậu: +${e.gems} Ngọc Mây`, 'level', 2600);
        break;
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
        this.view.slotView(e.slot.floor, e.slot.slot).dropIn();
        const p = at(e.slot);
        setTimeout(() => fx.burst(this.view.dot, p.x, p.y + 90, 14, { scale: 0.45, speed: 240, tint: hex(TOKENS.color.ui.paper) }), 380);
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
        // Chỉ thị 10 § 3.6: the balloon flies off now and pays when it comes back.
        this.sfx.play('tap');
        const back = Math.round(content.orders.refillSeconds / 60);
        this.toasts.show(`Khách cảm ơn: +${e.xp} XP. Khinh khí cầu cất cánh, về sau ${back} phút mang ${formatNumber(e.coins)} xu.`, e.rare ? 'level' : 'success', 2800);
        break;
      }
      case 'balloonBack': {
        this.sfx.play('coin');
        const who = content.bots.get(e.customer)?.name.vi ?? 'Khách';
        const extra = [e.gems > 0 ? `+${e.gems} Ngọc Mây` : '', ...Object.entries(e.items).map(([id, q]) => `+${q} ${content.items.get(id)?.name.vi ?? ''}`)].filter(Boolean).join(', ');
        this.toasts.show(`Khinh khí cầu về! ${who} gửi +${formatNumber(e.coins)} xu${e.xp > 0 ? `, +${e.xp} XP` : ''}${extra ? `, ${extra}` : ''}`, e.rare ? 'level' : 'success', 2800);
        break;
      }
      case 'rareOrderLeft':
        this.toasts.show('Một đơn hiếm đã hết hạn, khinh khí cầu mang đơn mới tới.', 'info', 2200);
        break;
      case 'neighborsChipped': {
        const names = e.help.map((h) => `${content.bots.get(h.botId)?.name.vi ?? 'Hàng xóm'} góp ${h.qty} ${content.items.get(h.itemId)?.name.vi ?? ''}`);
        this.toasts.show(names.length ? names.join(' · ') : 'Hôm nay hàng xóm chưa có hàng để góp.', names.length ? 'success' : 'info', 3000);
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
      case 'boughtFromNeighbor':
        this.sfx.play('coin');
        this.toasts.show(`Đã mua ${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''} của ${content.bots.get(e.botId)?.name.vi ?? 'hàng xóm'}: −${formatNumber(e.coins)} xu`, 'success', 2400);
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
      case 'questDone': {
        const q = this.session.content.quests.get(e.questId);
        if (!q) break;
        this.sfx.play('upgrade');
        this.toasts.show(q.hidden ? `Lộ diện nhiệm vụ bí mật: ${q.name.vi}!` : `Xong nhiệm vụ: ${q.name.vi}!`, 'level', 2400);
        break;
      }
      case 'questClaimed': {
        this.sfx.play('coin');
        const parts = [e.coins > 0 && `+${formatNumber(e.coins)} xu`, e.xp > 0 && `+${e.xp} XP`, e.gems > 0 && `+${e.gems} Ngọc Mây`, ...Object.entries(e.items).map(([id, n]) => `+${n} ${this.session.content.items.get(id)?.name.vi ?? id}`)].filter(Boolean);
        this.toasts.show(`Nhận thưởng: ${parts.join(', ')}`, 'success', 2200);
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
        fx.floatText(e.kind === 'water' ? 'Đã tưới giúp!' : e.bugId ? `+1 ${content.items.get(e.bugId)?.name.vi ?? 'bọ'}` : 'Đã bắt bọ giúp!', p.x, p.y + 20, hex(TOKENS.color.brand.cream));
        break;
      }
      // Chỉ thị 12 B4: stealing.
      case 'cropStolen': {
        this.sfx.play(e.mutation ? 'levelUp' : 'harvest');
        const p = at({ floor: e.floor, slot: e.slot });
        fx.burst(this.view.dot, p.x, p.y, e.mutation ? 26 : 12, { scale: 0.55, speed: 300, tint: hex(e.mutation ? TOKENS.color.brand.gold : TOKENS.color.brand.peach) });
        fx.floatText(`+${e.qty} ${content.items.get(e.itemId)?.name.vi ?? ''}`, p.x, p.y - 20, hex(e.mutation ? TOKENS.color.brand.gold : TOKENS.color.brand.cream));
        if (e.double && !e.enemy) this.toasts.show('Cú Đúp! Trộm gấp đôi, trúng hàng biến dị!', 'level', 2400);
        else if (e.enemy) this.toasts.show('Trả đũa kẻ thù: không tốn lượt, gấp đôi!', 'success', 2000);
        if (e.seed) this.toasts.show(`Nhặt được hạt ${content.crops.get(e.seed)?.name.vi ?? ''}! Gieo thử được một lần dù chưa tới cấp.`, 'level', 3200);
        this.visitBar?.update();
        break;
      }
      case 'stealCaught': {
        this.sfx.play('error');
        const p = at({ floor: e.floor, slot: e.slot });
        fx.floatText('Bị bắt quả tang!', p.x, p.y - 20, hex(TOKENS.color.brand.peach));
        this.view.shake(320);
        this.toasts.show(`Thú cưng nhà ${content.bots.get(e.botId)?.name.vi ?? 'hàng xóm'} đuổi chạy mất dép! Mất lượt, không mất đồ.`, 'error', 2600);
        this.visitBar?.update();
        break;
      }
      case 'takenWhileAway': {
        const byBot = new Map<string, string[]>();
        for (const t of e.list) byBot.set(t.botId, [...(byBot.get(t.botId) ?? []), `${t.qty} ${content.items.get(t.itemId)?.name.vi ?? ''}`]);
        for (const [id, what] of byBot) this.toasts.show(`${content.bots.get(id)?.name.vi ?? 'Hàng xóm'} đã trộm ${what.join(', ')} của bạn. Ghé trả đũa trong 24 giờ: gấp đôi, không tốn lượt!`, 'info', 4200);
        break;
      }
      case 'luckClaimed': {
        this.sfx.play('coin');
        const what = [e.coins ? `${formatNumber(e.coins)} xu` : '', e.bazaarReroll ? `${e.bazaarReroll} lượt đặt lại Sạp Săn Hàng miễn phí` : '', e.stealTurn ? `${e.stealTurn} lượt trộm` : '', e.gems ? `${e.gems} ngọc` : ''].filter(Boolean).join(', ');
        this.toasts.show(`Lộc Phiên lần ${e.index + 1}: ${what}!`, 'level', 2800);
        break;
      }
      case 'leagueSettled': {
        const L = content.neighbors.league;
        const was = L?.tiers[e.tier]?.name.vi ?? '';
        const nowT = L?.tiers[e.newTier]?.name.vi ?? '';
        this.sfx.play(e.newTier > e.tier ? 'levelUp' : 'coin');
        this.toasts.show(`Giải tuần: hạng ${e.rank} giải ${was}${e.newTier > e.tier ? `, lên ${nowT}!` : e.newTier < e.tier ? `, xuống ${nowT}` : ''} · thưởng ${formatNumber(e.coins)} xu${e.gems ? `, ${e.gems} ngọc` : ''}`, 'level', 4200);
        break;
      }
      case 'townChanged':
        if (e.came.length) this.toasts.show(`${e.came.length === 1 ? content.bots.get(e.came[0]!)?.name.vi ?? 'Phú Bà mới' : `${e.came.length} Phú Bà mới`} vừa dọn đến làng mây!`, 'info', 2600);
        break;
      case 'friendGift':
        this.sfx.play('levelUp');
        this.toasts.show(`${content.bots.get(e.botId)?.name.vi ?? 'Hàng xóm'} quý bạn (thân thiết ${e.at}): tặng ${formatNumber(e.coins)} xu${Object.keys(e.items).length ? ' và quà' : ''}!`, 'level', 3000);
        break;
      case 'levelUp': {
        this.sfx.play('levelUp');
        const reward = levelUpReward(content, e.level);
        const gift = [`+${formatNumber(reward.coins)} xu`, reward.gems > 0 ? `+${reward.gems} Ngọc Mây` : '', ...Object.entries(reward.items).map(([id, q]) => `+${q} ${content.items.get(id)?.name.vi ?? id}`)].filter(Boolean).join(', ');
        const unlocked = content.cropList.filter((c) => c.unlockLevel === e.level).map((c) => c.name.vi);
        const extra = unlocked.length > 0 ? ` Mở khóa: ${unlocked.join(', ')}.` : '';
        const nf = nextFloor(content, this.session.state);
        const floor = nf && nf.unlockLevel === e.level ? nf : null;
        const more = floor ? ` Có thể mở ${floor.name.vi}.` : '';
        const pots = content.potList.filter((p) => p.unlockLevel === e.level && p.price !== null && !p.retired).map((p) => p.name.vi);
        const potText = pots.length > 0 ? ` Lò Gốm có ${pots.join(', ')}.` : '';
        this.celebrate(`Lên cấp ${e.level}!`, `Quà lên cấp: ${gift}.${extra}${more}${potText}`);
        for (let i = 0; i < 4; i++) {
          const p = this.view.slotView(0, (i * 3) % this.session.state.floors[0]!.slots.length).feedbackPoint();
          fx.burst(this.view.dot, p.x, p.y - 60, 6, { scale: 0.5, speed: 360, tint: hex(TOKENS.color.brand.gold) });
        }
        break;
      }
    }
  }
}
