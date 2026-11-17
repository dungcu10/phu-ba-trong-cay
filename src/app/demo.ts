// Dev-only showcase script (?dev=1): builds a mid-game garden through real commands so the
// redesign can be checked by screenshots (tools/shots.ts). Gives itself level, coins and
// materials first — never available outside dev mode.

import type { OffsetClock } from '../core/clock.ts';
import { isSoldInShop } from '../core/content.ts';
import { grantPot } from '../systems/pots.ts';
import { nextFloor } from '../core/game.ts';
import type { GameView } from '../render/scene.ts';
import type { Controller } from './controller.ts';
import type { GameSession } from './session.ts';

const MIN = 60_000;

export function makeDemo(session: GameSession, view: GameView, controller: Controller, clock: OffsetClock): (step: string) => boolean {
  const run = (cmd: Parameters<GameSession['run']>[0]) => {
    const r = session.run(cmd);
    if (!r.ok) console.warn('demo', cmd.type, r.error);
    return r.ok;
  };
  const click = (test: string) => (document.querySelector(`[data-test="${test}"]`) as HTMLElement | null)?.click();
  const closePanels = () => document.querySelectorAll<HTMLElement>('.veil .knob.close, .celebrate').forEach((b) => (b.classList.contains('celebrate') ? b.dispatchEvent(new Event('pointerdown')) : b.click()));

  const setup = () => {
    const { content, state } = session;
    state.player.level = 14;
    state.player.coins = 500_000;
    state.inventory['base:bug.ladybird'] = 400;
    for (const f of content.floorList) for (const st of f.stars) for (const [id, q] of Object.entries(st.items)) state.inventory[id] = (state.inventory[id] ?? 0) + q;
    for (const f of content.floorList.slice(1)) run({ type: 'unlockFloor', floorId: f.id });
    run({ type: 'expandFloor', floor: 0 });
    run({ type: 'expandFloor', floor: 0 });
    // Floor 1: six Gốm Sứ Cung Đình pots (set tier 2), some upgraded to Tinh / Thần.
    const buyPlace = (potId: string, floor: number, slot: number, levels: number) => {
      // Event and mission pots are not sold: the demo hands them over like a reward would.
      const def = content.pots.get(potId);
      if (!def) return;
      const id = isSoldInShop(def) ? (run({ type: 'buyPot', potId }) ? state.potStock.at(-1)! : null) : grantPot(state, potId, 'event', session.now());
      if (!id) return;
      run({ type: 'placePot', potInstanceId: id, floor, slot });
      for (let i = 0; i < levels; i++) run({ type: 'upgradePot', potInstanceId: id });
    };
    ['base:pot.jade-lotus', 'base:pot.porcelain', 'base:pot.jade-lotus', 'base:pot.porcelain', 'base:pot.porcelain', 'base:pot.jade-lotus'].forEach((p, i) => buyPlace(p, 0, i + 1, i === 2 ? 8 : i % 2 ? 3 : 1));
    buyPlace('base:pot.bronze-tripod', 1, 0, 6);
    buyPlace('base:pot.rosewood', 1, 1, 2);
    buyPlace('base:pot.cloud-puff', 2, 2, 9);
    run({ type: 'upgradeFloorStar', floor: 0 });
    run({ type: 'upgradeFloorStar', floor: 0 });
    run({ type: 'upgradeFloorStar', floor: 1 });
    // Crops at different stages: plant in waves with time passing between.
    const crops = ['base:crop.golden-gerbera', 'base:crop.cloud-strawberry', 'base:crop.sky-carrot', 'base:crop.cloud-mint', 'base:crop.cherry-tomato', 'base:crop.cotton-daisy'];
    state.floors.forEach((f, fi) =>
      f.slots.forEach((_, i) => {
        if ((i + fi) % 5 === 4) return;
        run({ type: 'plant', cropId: crops[(i + fi * 2) % crops.length]!, floor: fi, slot: i });
        clock.advance(4 * MIN);
      }),
    );
    clock.advance(25 * MIN);
    controller.resync();
    view.focusFloor(0, 1);
  };

  return (step: string) => {
    if (step !== 'pot-upgrade') closePanels();
    const tab = /^shop-t(\d+)$/.exec(step); // 'shop-t<N>': pot shop open on tab N (directive 04)
    if (tab) {
      controller.openShop();
      // The previous shop may still be fading out: click the tab of the newest one.
      [...document.querySelectorAll<HTMLElement>(`[data-test="shop-tab-${tab[1]}"]`)].at(-1)?.click();
      return true;
    }
    switch (step) {
      case 'garden':
        setup();
        return true;
      case 'grown':
        clock.advance(40 * MIN);
        controller.resync();
        return true;
      case 'tray':
        controller.toggleTray(true);
        return true;
      case 'floor2':
        controller.toggleTray(false);
        view.focusFloor(1, 1);
        return true;
      case 'endless': {
        // Nâng cấp v3 đợt 1: floors above the hand-made three, the next locked one, Mưa Mây.
        const { state, content } = session;
        state.player.level = Math.max(state.player.level, 34);
        state.player.coins = Math.max(state.player.coins, 3_000_000);
        state.player.gems = Math.max(state.player.gems, 120);
        for (let i = 0; i < 5; i++) {
          const nf = nextFloor(content, state);
          if (!nf || state.floors.length >= 5 || !run({ type: 'unlockFloor', floorId: nf.id })) break;
        }
        const crops = content.cropList.map((c) => c.id);
        state.floors.forEach((f, fi) => {
          while (f.slots.length < 8 && run({ type: 'expandFloor', floor: fi }));
          f.slots.forEach((sl, i) => {
            if (!sl.planting) run({ type: 'plant', cropId: crops[(i + fi) % crops.length]!, floor: fi, slot: i });
          });
        });
        clock.advance(25 * MIN);
        controller.resync();
        view.focusFloor(state.floors.length - 1, 1);
        return true;
      }
      case 'endless-info':
        controller.openFloorInfo(session.state.floors.length - 1);
        return true;
      case 'storage':
        controller.openStorage();
        return true;
      case 'floor-info':
        view.focusFloor(0, 1);
        controller.openFloorInfo(0);
        return true;
      case 'shop':
        controller.openShop();
        return true;
      case 'missions':
        click('open-missions');
        return true;
      case 'orders':
        click('open-orders');
        return true;
      case 'neighbors':
        click('open-neighbors');
        return true;
      case 'visit': {
        const bot = [...session.content.bots.keys()].sort((a, b) => session.state.neighbors[b]!.level - session.state.neighbors[a]!.level)[0]!;
        controller.visit(bot);
        return true;
      }
      case 'home':
        controller.goHome();
        return true;
      case 'pots': {
        // Pot line review: terracotta at 1, 3, 5, 7, 10 and the mission and event pots at 1/5/10.
        const { state } = session;
        state.player.level = 14;
        const f = state.floors[0]!;
        while (f.slots.length < 10) run({ type: 'expandFloor', floor: 0 });
        const plan: Array<[string, number]> = [
          ['base:pot.terracotta', 1], ['base:pot.terracotta', 3], ['base:pot.terracotta', 5], ['base:pot.terracotta', 7], ['base:pot.terracotta', 10],
          ['base:pot.bronze-tripod', 1], ['base:pot.bronze-tripod', 5], ['base:pot.bronze-tripod', 10], ['base:pot.jade-lotus', 5], ['base:pot.jade-lotus', 10],
        ];
        f.slots.forEach((sl, i) => {
          sl.planting = null;
          const [potId, level] = plan[i]!;
          state.pots[sl.potInstanceId] = { potId, level, history: [{ level, at: session.now() }], source: 'old-save' };
          state.potBook[potId] = { firstAt: session.now(), bestLevel: Math.max(level, state.potBook[potId]?.bestLevel ?? 1) };
        });
        controller.resync();
        view.focusFloor(0, 1);
        return true;
      }
      case 'blender': {
        // Directive 03 screenshot: Phượng Hoàng at 1, 20, 50 plus catalog pots, all planted, on
        // two full floors (2 × 10 level-50 pots for the FPS check).
        const { state, content } = session;
        state.player.level = 20;
        state.player.coins = Math.max(state.player.coins, 500_000);
        for (const f of content.floorList.slice(1, 2)) if (!state.floors.some((x) => x.floorId === f.id)) run({ type: 'unlockFloor', floorId: f.id });
        for (let fi = 0; fi < 2; fi++) while (state.floors[fi]!.slots.length < 10) if (!run({ type: 'expandFloor', floor: fi })) break;
        const plan0: Array<[string, number]> = [
          ['base:pot.phoenix', 1], ['base:pot.phoenix', 20], ['base:pot.phoenix', 35], ['base:pot.phoenix', 50], ['base:pot.01-dat-nung-phuong-hoang', 50],
          ['base:pot.17-tho-ren-huyen-thoai', 1], ['base:pot.33-bi-ngo-phu-thuy', 50], ['base:pot.terracotta', 1], ['base:pot.02-mam-xanh-co-thu', 50], ['base:pot.50-thanh-vat-khoi-nguyen-vip', 50],
        ];
        const cat = content.potList.filter((p) => p.sprite.startsWith('pots/catalog/')).map((p) => p.id);
        const crops = ['base:crop.cotton-daisy', 'base:crop.cherry-tomato', 'base:crop.cloud-mint', 'base:crop.sky-carrot', 'base:crop.cloud-strawberry', 'base:crop.golden-gerbera'];
        state.floors.slice(0, 2).forEach((f, fi) =>
          f.slots.forEach((sl, i) => {
            const [potId, level] = fi === 0 ? plan0[i]! : [cat[(i * 5 + 3) % cat.length]!, 50];
            const id = content.pots.has(potId) ? potId : 'base:pot.phoenix';
            state.pots[sl.potInstanceId] = { potId: id, level, history: [{ level, at: session.now() }], source: 'old-save' };
            state.potBook[id] = { firstAt: session.now(), bestLevel: level };
            sl.planting = null;
            run({ type: 'plant', cropId: crops[(i + fi) % crops.length]!, floor: fi, slot: i });
          }),
        );
        clock.advance(20 * MIN);
        controller.resync();
        view.focusFloor(0, 1);
        return true;
      }
      case 'signature': {
        // Directive 04 screenshot + FPS: floor 1 has 10 signature pots, two from each shop group,
        // including the stands #38 Bình Men Ngọc, #48 Ngai Vàng and the low #39 Bát Tràng, #47 Đèn Thần;
        // floor 2 has 10 more, all level 50 and planted.
        const { state, content } = session;
        state.player.level = 20;
        state.player.coins = Math.max(state.player.coins, 500_000);
        for (const f of content.floorList.slice(1, 2)) if (!state.floors.some((x) => x.floorId === f.id)) run({ type: 'unlockFloor', floorId: f.id });
        for (let fi = 0; fi < 2; fi++) while (state.floors[fi]!.slots.length < 10) if (!run({ type: 'expandFloor', floor: fi })) break;
        const sig = (n: number) => content.potList.find((p) => p.sprite === `pots/sig/${String(n).padStart(2, '0')}`)?.id ?? 'base:pot.phoenix';
        const plans = [
          [1, 9, 11, 16, 22, 26, 38, 39, 47, 48],
          [3, 6, 14, 19, 24, 29, 31, 33, 42, 46],
        ];
        const crops = ['base:crop.cotton-daisy', 'base:crop.cherry-tomato', 'base:crop.cloud-mint', 'base:crop.sky-carrot', 'base:crop.cloud-strawberry', 'base:crop.golden-gerbera'];
        state.floors.slice(0, 2).forEach((f, fi) =>
          f.slots.forEach((sl, i) => {
            const id = sig(plans[fi]![i % 10]!);
            state.pots[sl.potInstanceId] = { potId: id, level: 50, history: [{ level: 50, at: session.now() }], source: 'old-save' };
            state.potBook[id] = { firstAt: session.now(), bestLevel: 50 };
            sl.planting = null;
            run({ type: 'plant', cropId: crops[(i + fi) % crops.length]!, floor: fi, slot: i });
          }),
        );
        clock.advance(20 * MIN);
        controller.resync();
        view.focusFloor(0, 1);
        return true;
      }
      case 'blender-up':
        document.querySelectorAll('.toast').forEach((t) => t.remove());
        view.focusFloor(1, 1);
        return true;
      case 'floor0':
        document.querySelectorAll('.toast').forEach((t) => t.remove());
        view.focusFloor(0, 1);
        return true;
      case 'pot-panel': {
        const { state, content } = session;
        const sl = state.floors[0]!.slots[3]!;
        const pot = state.pots[sl.potInstanceId]!;
        pot.level = 9;
        const cost = content.pots.get(pot.potId)!.levels[9]!.upgradeCost!;
        state.player.coins += cost.coins;
        for (const [id, q] of Object.entries(cost.items)) state.inventory[id] = (state.inventory[id] ?? 0) + q;
        controller.resync();
        controller.openBench({ floor: 0, slot: 3 });
        return true;
      }
      case 'pot-upgrade':
        (document.querySelector('[data-test="upgrade-pot"]') as HTMLElement | null)?.click();
        return true;
      case 'collection':
        controller.openCollection();
        return true;
      case 'event':
        session.state.events['base:event.moon-festival'] = { points: 118, claimed: 2 };
        click('open-event');
        return true;
      case 'mission-pot':
        session.state.inventory['base:mat.merit-seal'] = 3;
        click('open-missions');
        return true;
      default:
        return false;
    }
  };
}
