// Dev-only showcase script (?dev=1): builds a mid-game garden through real commands so the
// redesign can be checked by screenshots (tools/shots.ts). Gives itself level, coins and
// materials first — never available outside dev mode.

import type { OffsetClock } from '../core/clock.ts';
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
      if (!run({ type: 'buyPot', potId })) return;
      const id = state.potStock.at(-1)!;
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
