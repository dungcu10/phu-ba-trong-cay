// Long-run progression simulation (nâng cấp v3, đợt 1). A diligent-but-simple player plays through
// the real command processor: awake 8:00–22:00, visiting every `visitMinutes`. Each visit: catch
// bugs, harvest, sell produce not needed by open orders, deliver orders, claim missions, event
// milestones and journal rewards, water and replant with the crop that pays best for the visit
// gap, then spend: next floor > floor slots > floor stars > Rương Mây > pot upgrades, always
// keeping a seed reserve. Used by tests/progression.test.ts and printed by
// `npx tsx tools/progression.ts [visitMinutes] [days]`.

import type { ContentPack, CropDef } from '../src/core/content.ts';
import { dispatch, nextFloor, type Command } from '../src/core/game.ts';
import { createNewGame, type GameState } from '../src/core/state.ts';
import { canDeliver } from '../src/systems/orders.ts';
import { expandCost } from '../src/systems/floors.ts';
import { canAfford, nextUpgradeCost } from '../src/systems/pots.ts';
import { claimableMilestones, visibleEvents } from '../src/systems/events.ts';

export interface DayReport {
  day: number;
  level: number;
  coins: number;
  gems: number;
  floors: number;
  pots: number;
  harvests: number;
}

const T0 = Date.parse('2026-11-17T08:00:00+07:00');
const RESERVE = 300;

export function simulateProgression(content: ContentPack, visitMinutes: number, days: number, seed = 42): { days: DayReport[]; state: GameState } {
  const s = createNewGame(content, T0, seed);
  const run = (cmd: Command, t: number) => dispatch(content, s, cmd, t);
  const gap = visitMinutes * 60;
  const score = (c: CropDef) => {
    const first = Math.max(c.growSeconds, gap);
    const regrow = Math.max(c.regrowSeconds ?? c.growSeconds, gap);
    return (c.sellPrice * c.yield * c.harvests - c.seedPrice) / (first + (c.harvests - 1) * regrow);
  };
  const out: DayReport[] = [];
  for (let day = 0; day < days; day++) {
    for (let m = 0; m <= 14 * 60; m += visitMinutes) {
      const t = T0 + day * 86_400_000 + m * 60_000;
      run({ type: 'tick' }, t);
      s.floors.forEach((f, floor) =>
        f.slots.forEach((_, slot) => {
          for (let k = 0; k < 5; k++) if (!run({ type: 'catchBug', floor, slot }, t).ok) break;
          for (let k = 0; k < 3; k++) if (!run({ type: 'harvest', floor, slot }, t).ok) break;
        }),
      );
      for (const [id, q] of Object.entries(s.inventory)) {
        if (!content.items.get(id)?.countsTowardStorage) continue;
        const need = s.orders.slots.reduce((a, sl) => a + (sl.order?.items[id] ?? 0), 0);
        if (q - need > 0) run({ type: 'sell', itemId: id, qty: q - need }, t);
      }
      s.orders.slots.forEach((sl, i) => {
        if (sl.order && canDeliver(s, sl.order)) run({ type: 'deliverOrder', slot: i }, t);
      });
      for (let i = 0; i < s.missions.list.length; i++) run({ type: 'claimMission', index: i }, t);
      run({ type: 'claimMissionBonus' }, t);
      for (const ev of visibleEvents(content, s, t)) while (claimableMilestones(s, ev) > 0 && run({ type: 'claimEventMilestone', eventId: ev.id }, t).ok);
      for (const c of content.cropList) run({ type: 'claimJournal', cropId: c.id }, t);
      const best = () =>
        content.cropList.filter((c) => c.unlockLevel <= s.player.level && c.seedPrice <= s.player.coins).sort((a, b) => score(b) - score(a))[0];
      s.floors.forEach((f, floor) =>
        f.slots.forEach((sl, slot) => {
          if (sl.planting) run({ type: 'water', floor, slot }, t);
          else {
            const c = best();
            if (c) run({ type: 'plant', cropId: c.id, floor, slot }, t);
          }
        }),
      );
      const nf = nextFloor(content, s);
      if (nf && s.player.level >= nf.unlockLevel && s.player.coins - RESERVE >= nf.unlockCost) run({ type: 'unlockFloor', floorId: nf.id }, t);
      s.floors.forEach((f, floor) => {
        const c = expandCost(content.floors.get(f.floorId)!, f);
        if (c !== null && s.player.coins - RESERVE >= c) run({ type: 'expandFloor', floor }, t);
        run({ type: 'upgradeFloorStar', floor }, t);
      });
      if (s.player.coins - RESERVE > 4 * (content.config.storageUpgrade.firstCost * Math.pow(content.config.storageUpgrade.costGrowth, s.upgrades.storage))) run({ type: 'upgradeStorage' }, t);
      for (let k = 0; k < 20; k++) {
        const id = Object.keys(s.pots).find((pid) => {
          const c = nextUpgradeCost(content, s.pots[pid]!);
          return c && canAfford(s, c) && s.player.coins - c.coins >= RESERVE;
        });
        if (!id || !run({ type: 'upgradePot', potInstanceId: id }, t).ok) break;
      }
    }
    out.push({ day: day + 1, level: s.player.level, coins: s.player.coins, gems: s.player.gems, floors: s.floors.length, pots: Object.keys(s.pots).length, harvests: s.stats.harvests });
  }
  return { days: out, state: s };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadBase } = await import('../tests/helpers.ts');
  const content = await loadBase();
  const visit = Number(process.argv[2] ?? 120);
  const days = Number(process.argv[3] ?? 30);
  console.log(`| Ngày | Cấp | Tầng | Xu | Ngọc | Thu hoạch |\n|---|---|---|---|---|---|`);
  for (const d of simulateProgression(content, visit, days).days) console.log(`| ${d.day} | ${d.level} | ${d.floors} | ${d.coins} | ${d.gems} | ${d.harvests} |`);
}
