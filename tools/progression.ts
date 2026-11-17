// Long-run progression simulation (nâng cấp v3, đợt 1). A diligent-but-simple player plays through
// the real command processor: awake 8:00–22:00, visiting every `visitMinutes`. Each visit: catch
// bugs, harvest, sell produce not needed by open orders, deliver orders, claim missions, event
// milestones and journal rewards, water and replant with the crop that pays best for the visit
// gap, then spend: next floor > floor slots > floor stars > Rương Mây > pot upgrades, always
// keeping a seed reserve. Used by tests/progression.test.ts and printed by
// `npx tsx tools/progression.ts [visitMinutes] [days]`.

import { machineState, nextStarCost } from '../src/systems/workshop.ts';
import { isSoldInShop, type ContentPack, type CropDef } from '../src/core/content.ts';
import { cloudRainCost, dispatch, nextFloor, type Command } from '../src/core/game.ts';
import { storageFree, storageUpgradeCost } from '../src/systems/economy.ts';
import { questActive, questView } from '../src/systems/quests.ts';
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
  /** Quests claimed this day. */
  quests: number;
  /** Gems earned this day (before spending). */
  gemsEarned: number;
  /** U(level) at the end of the day. */
  unit: number;
  floors: number;
  pots: number;
  harvests: number;
  /** Progress moments this day: a floor opened, a slot added, a floor star, a new crop, a new pot
   *  line bought, a pot reaching a milestone level, a Rương Mây tier. */
  milestones: number;
  /** GAME_SYSTEMS § 6 metrics: bugs caught this day by rarity, signature pots owned, share of visits
   *  that found the produce storage full, orders delivered this day. */
  bugsByRarity: Record<string, number>;
  signaturePots: number;
  storageFullShare: number;
  ordersDelivered: number;
  /** Bugs the player's birds caught this day, and how many birds were working (chỉ thị 11 D1). */
  birdBugs: number;
  birds: number;
  /** Bugs held in the bag at the end of the day (B6: a stock that keeps growing means the bug sinks
   *  are too small), and common bugs caught per pot this day. */
  bugStock: number;
  commonBugsPerPot: number;
}

const T0 = Date.parse('2026-11-17T08:00:00+07:00');
const RESERVE = 300;

/** The crop whose produce is this item, if any. */
function cropOf(content: ContentPack, itemId: string): CropDef | undefined {
  return content.cropList.find((c) => c.produce.id === itemId);
}

/** How much of each crop the open orders still need, after the stock and what is already growing. */
function orderShortfall(content: ContentPack, s: GameState): Map<CropDef, number> {
  const need = new Map<CropDef, number>();
  for (const sl of s.orders.slots) {
    if (!sl.order) continue;
    for (const [id, q] of Object.entries(sl.order.items)) {
      const c = cropOf(content, id);
      if (c) need.set(c, (need.get(c) ?? 0) + q);
    }
  }
  for (const [c, n] of need) need.set(c, n - (s.inventory[c.produce.id] ?? 0));
  for (const f of s.floors)
    for (const sl of f.slots) {
      const p = sl.planting;
      if (!p) continue;
      const c = content.crops.get(p.cropId);
      if (c && need.has(c)) need.set(c, need.get(c)! - c.yield);
    }
  return need;
}

export function simulateProgression(content: ContentPack, visitMinutes: number, days: number, seed = 42): { days: DayReport[]; state: GameState; gemSources: Record<string, number> } {
  const s = createNewGame(content, T0, seed);
  let milestones = 0;
  let gemsEarned = 0;
  let birdCaught = 0;
  let questsClaimed = 0;
  const gemSources: Record<string, number> = {};
  const run = (cmd: Command, t: number) => {
    const gems = s.player.gems;
    const r = dispatch(content, s, cmd, t);
    if (r.ok) {
      if (s.player.gems > gems) {
        gemsEarned += s.player.gems - gems;
        gemSources[cmd.type] = (gemSources[cmd.type] ?? 0) + s.player.gems - gems;
      }
      for (const e of r.events) {
        if (e.type === 'birdCaught') birdCaught += 1;
        if (e.type === 'floorUnlocked' || e.type === 'floorExpanded' || e.type === 'floorStarred') milestones++;
        if (e.type === 'potBought' || (e.type === 'potUpgraded' && e.milestone) || e.type === 'storageUpgraded') milestones++;
        if (e.type === 'questClaimed') {
          questsClaimed++;
          gemSources[`quest:${e.questId}`] = (gemSources[`quest:${e.questId}`] ?? 0) + e.gems;
        }
        if (e.type === 'levelUp' && content.cropList.some((c) => c.unlockLevel === e.level)) milestones++;
      }
    }
    return r;
  };
  const gap = visitMinutes * 60;
  const score = (c: CropDef) => {
    const first = Math.max(c.growSeconds, gap);
    const regrow = Math.max(c.regrowSeconds ?? c.growSeconds, gap);
    return (c.sellPrice * c.yield * c.harvests - c.seedPrice) / (first + (c.harvests - 1) * regrow);
  };
  const out: DayReport[] = [];
  const bookCount = () => {
    const by: Record<string, number> = {};
    for (const [id, e] of Object.entries(s.collections.bugs)) {
      const r = content.bugs.get(id)?.rarity ?? 'common';
      by[r] = (by[r] ?? 0) + e.count;
    }
    return by;
  };
  for (let day = 0; day < days; day++) {
    const bugsBefore = bookCount();
    const ordersBefore = s.stats.ordersDone;
    const birdBefore = birdCaught;
    let visits = 0;
    let fullVisits = 0;
    for (let m = 0; m <= 14 * 60; m += visitMinutes) {
      const t = T0 + day * 86_400_000 + m * 60_000;
      run({ type: 'tick' }, t);
      visits++;
      // Birds (chỉ thị 10 § 3.3): rent one of the family most planted once comfortably affordable
      // (same rule as the BOTs), keep Hạt Kê Mây in stock and feed every bird.
      const birdCfg = content.birdRules?.bots;
      if (birdCfg && content.birds && s.birds.length === 0) {
        const owned = new Map<string, number>();
        for (const f of s.floors) for (const sl of f.slots) if (sl.planting) owned.set(content.crops.get(sl.planting.cropId)!.family, (owned.get(content.crops.get(sl.planting.cropId)!.family) ?? 0) + 1);
        const fam = [...owned.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const opts = [...content.birds.values()].filter((d) => d.rent && d.unlockLevel <= s.player.level && s.player.coins >= d.rent.coins * birdCfg.rentWhenCoinsTimes);
        const pick = opts.find((d) => fam && d.families.includes(fam));
        if (pick) run({ type: 'obtainBird', species: pick.id, how: 'rent' }, t);
      }
      if (s.birds.length > 0 && content.birdRules) {
        const millet = content.birdRules.millet.item;
        if ((s.inventory[millet] ?? 0) < 2 * s.birds.length) run({ type: 'buyMillet', qty: 2 * s.birds.length }, t);
        run({ type: 'feedAllBirds' }, t);
      }
      if (storageFree(content, s) <= 0) fullVisits++;
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
      // Quests (đợt 2): claim whatever is ready, tier after tier.
      for (const q of content.questList) while (questActive(content, s, q) && questView(content, s, q).claimable && run({ type: 'claimQuest', questId: q.id }, t).ok);
      const best = () =>
        content.cropList.filter((c) => c.unlockLevel <= s.player.level && c.seedPrice <= s.player.coins).sort((a, b) => score(b) - score(a))[0];
      // Better pots: when coins are plentiful, buy a shop pot the player does not own yet and put it
      // in place of a starting Chậu Đất Nung on an empty slot (a real coin sink in the late game).
      // CTO 18/11: rare pots are no longer sold for coins (chỉ thị 12 TỔNG B7); a player trades
      // materials for at most one new one a day, the cheapest first.
      if (m === 0) {
        const owned = new Set(Object.values(s.pots).map((p) => p.potId));
        const rank: Record<string, number> = { rare: 0, epic: 1, legendary: 2 };
        const pick = content.potList
          .filter((d) => d.group === 'crafted' && d.exchange && !owned.has(d.id) && d.unlockLevel <= s.player.level && canAfford(s, { coins: 0, items: d.exchange.items }))
          .sort((a, b) => (rank[a.rarity] ?? 3) - (rank[b.rarity] ?? 3))[0];
        if (pick) run({ type: 'obtainPot', potId: pick.id }, t);
      }
      s.floors.forEach((f, floor) =>
        f.slots.forEach((sl, slot) => {
          if (sl.planting || s.pots[sl.potInstanceId]?.potId !== content.config.floorGen.startingPot) return;
          const owned = new Set(Object.values(s.pots).map((p) => p.potId));
          const pick = content.potList
            .filter((d) => isSoldInShop(d) && d.unlockLevel <= s.player.level && !owned.has(d.id) && d.price * 3 <= s.player.coins - RESERVE)
            .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
          if (pick && run({ type: 'buyPot', potId: pick.id }, t).ok) run({ type: 'placePot', potInstanceId: s.potStock.at(-1)!, floor, slot }, t);
        }),
      );
      // CTO 18/11: a real player plants for the open orders first (an order needs several crops,
      // and a bot that only ever plants the single best crop never delivers one), then the best crop.
      const shortfall = orderShortfall(content, s);
      s.floors.forEach((f, floor) =>
        f.slots.forEach((sl, slot) => {
          if (sl.planting) run({ type: 'water', floor, slot }, t);
          else {
            const want = [...shortfall.entries()]
              .filter(([c, n]) => n > 0 && c.unlockLevel <= s.player.level && c.seedPrice <= s.player.coins && c.growSeconds <= Math.max(gap * 2, 4 * 3600))
              .sort((a, b) => a[0].growSeconds - b[0].growSeconds)[0];
            const c = want?.[0] ?? best();
            if (c && run({ type: 'plant', cropId: c.id, floor, slot }, t).ok && want) shortfall.set(want[0], want[1] - c.yield * c.harvests);
          }
        }),
      );
      // An order nobody can fill soon (it needs a crop the player cannot afford or that grows for
      // more than a day of visits) is skipped, as a player would.
      s.orders.slots.forEach((sl, i) => {
        if (!sl.order) return;
        const blocked = Object.keys(sl.order.items).some((id) => {
          const c = cropOf(content, id);
          return !c || c.growSeconds > Math.max(gap * 2, 4 * 3600) || c.unlockLevel > s.player.level;
        });
        if (blocked) run({ type: 'skipOrder', slot: i }, t);
      });
      const nf = nextFloor(content, s);
      if (nf && s.player.level >= nf.unlockLevel && s.player.coins - RESERVE >= nf.unlockCost) run({ type: 'unlockFloor', floorId: nf.id }, t);
      s.floors.forEach((f, floor) => {
        const c = expandCost(content.floors.get(f.floorId)!, f);
        if (c !== null && s.player.coins - RESERVE >= c) run({ type: 'expandFloor', floor }, t);
        run({ type: 'upgradeFloorStar', floor }, t);
      });
      if (s.player.coins - RESERVE > 2 * storageUpgradeCost(content, s)) run({ type: 'upgradeStorage' }, t);
      // Mưa Mây on the first visit of the day when it costs at most half the gems held.
      if (m === 0) {
        const fi = s.floors.length - 1;
        const c = cloudRainCost(content, s, fi, t);
        if (c.pots > 0 && c.gems <= s.player.gems) run({ type: 'cloudRain', floor: fi }, t);
      }
      // Xưởng Bọ: raise a machine's star whenever the coins allow (it costs the machine's worker bug).
      for (const mc of content.recipes ? new Set([...content.recipes.values()].map((r) => r.machine)) : []) {
        const c = nextStarCost(content, mc, machineState(content, s, mc.id));
        if (c && s.player.level >= mc.unlockLevel && s.player.coins - c.coins >= RESERVE * 3) run({ type: 'upgradeMachine', machineId: mc.id }, t);
      }
      for (let k = 0; k < 20; k++) {
        const id = Object.keys(s.pots).find((pid) => {
          const c = nextUpgradeCost(content, s.pots[pid]!);
          return c && canAfford(s, c) && s.player.coins - c.coins >= RESERVE;
        });
        if (!id || !run({ type: 'upgradePot', potInstanceId: id }, t).ok) break;
      }
    }
    const bugsAfter = bookCount();
    const bugsByRarity = Object.fromEntries(Object.keys(bugsAfter).map((r) => [r, bugsAfter[r]! - (bugsBefore[r] ?? 0)]));
    const signaturePots = new Set(Object.values(s.pots).map((p) => p.potId).filter((id) => content.pots.get(id)?.sprite.startsWith('pots/sig/'))).size;
    out.push({
      day: day + 1, level: s.player.level, coins: s.player.coins, gems: s.player.gems, quests: questsClaimed, gemsEarned, unit: content.income.unit(s.player.level), floors: s.floors.length, pots: Object.keys(s.pots).length, harvests: s.stats.harvests, milestones,
      bugsByRarity, signaturePots, storageFullShare: visits ? fullVisits / visits : 0, ordersDelivered: s.stats.ordersDone - ordersBefore,
      birdBugs: birdCaught - birdBefore,
      birds: s.birds.length,
      bugStock: Object.entries(s.inventory).reduce((a, [id, q]) => a + (content.bugs.has(id) ? q : 0), 0),
      commonBugsPerPot: (bugsByRarity.common ?? 0) / Math.max(1, Object.keys(s.pots).length),
    });
    milestones = 0;
    gemsEarned = 0;
    questsClaimed = 0;
  }
  return { days: out, state: s, gemSources };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadBase } = await import('../tests/helpers.ts');
  const content = await loadBase();
  const visit = Number(process.argv[2] ?? 120);
  const days = Number(process.argv[3] ?? 30);
  const every = Number(process.argv[4] ?? 1);
  console.log(`| Ngày | Cấp | Tầng | Xu | U(cấp) | Xu/U | Ngọc | Ngọc kiếm | Mốc | Thu hoạch |\n|---|---|---|---|---|---|---|---|---|---|`);
  const result = simulateProgression(content, visit, days);
  console.error('ngọc theo nguồn', result.gemSources);
  for (const d of result.days) {
    if (d.day % every !== 0 && d.day !== 1) continue;
    console.log(`| ${d.day} | ${d.level} | ${d.floors} | ${d.coins} | ${Math.round(d.unit)} | ${(d.coins / d.unit).toFixed(1)} | ${d.gems} | ${d.gemsEarned} | ${d.milestones} | ${d.harvests} |`);
  }
}
