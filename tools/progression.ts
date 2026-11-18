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
import { floorUnlockCost } from '../src/systems/coinSinks.ts';
import { castablePots, castRecipe } from '../src/systems/casting.ts';
import { randomFor } from '../src/core/rng.ts';
import { seaOpen } from '../src/systems/sea.ts';
import { fishingOpen } from '../src/systems/fishing.ts';
import { decorPrice } from '../src/systems/decor.ts';
import { nextHouseCost } from '../src/systems/village.ts';
import { bazaarOpen, rerollCost, wantedItems } from '../src/systems/bazaar.ts';
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
  /** Coins earned this day (every gain, before spending): the "one day of income" of 12 TỔNG A3. */
  income: number;
  /** Quà bất ngờ found this day (12 TỔNG B1.3: 10–15). */
  gifts: number;
}

const T0 = Date.parse('2026-11-17T08:00:00+07:00');
const RESERVE = 300;
const BUG_RESERVE = 40;
const BAZAAR_REROLLS = 2;
const FISH_PER_DAY = 10;

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

export function simulateProgression(content: ContentPack, visitMinutes: number, days: number, seed = 42): { days: DayReport[]; state: GameState; gemSources: Record<string, number>; coinFlow: Record<string, number> } {
  const s = createNewGame(content, T0, seed);
  let milestones = 0;
  let gemsEarned = 0;
  let birdCaught = 0;
  let questsClaimed = 0;
  const gemSources: Record<string, number> = {};
  /** Coins in (+) and out (−) by command over the whole run (A3: where the coins come from and go). */
  const coinFlow: Record<string, number> = {};
  let dayIncome = 0;
  let giftsFound = 0;
  const giftKinds: Record<string, number> = {};
  const run = (cmd: Command, t: number) => {
    const gems = s.player.gems;
    const coinsBefore = s.player.coins;
    const r = dispatch(content, s, cmd, t);
    if (s.player.coins !== coinsBefore) coinFlow[cmd.type] = (coinFlow[cmd.type] ?? 0) + s.player.coins - coinsBefore;
    if (s.player.coins > coinsBefore) dayIncome += s.player.coins - coinsBefore;
    if (r.ok) {
      if (s.player.gems > gems) {
        gemsEarned += s.player.gems - gems;
        gemSources[cmd.type] = (gemSources[cmd.type] ?? 0) + s.player.gems - gems;
      }
      for (const e of r.events) {
        if (e.type === 'birdCaught') birdCaught += 1;
        if (e.type === 'giftFound') { giftsFound += 1; giftKinds[e.gift.kind] = (giftKinds[e.gift.kind] ?? 0) + 1; }
        if (e.type === 'floorUnlocked' || e.type === 'floorExpanded' || e.type === 'floorStarred') milestones++;
        if (e.type === 'potBought' || (e.type === 'potUpgraded' && e.milestone) || e.type === 'storageUpgraded') milestones++;
        // Also progress a player sees: a level (often a new crop), a crafted pot, a machine star, a Sổ Tay reward.
        if (e.type === 'levelUp' || e.type === 'potObtained' || e.type === 'machineStar' || e.type === 'journalClaimed' || e.type === 'houseUpgraded' || e.type === 'medalAwarded') milestones++;
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
      // Xưởng Bọ (B6): fill every free machine slot, goods the open orders ask for first, then the
      // best-paying recipe whose produce and worker bugs are in the bag.
      if (content.recipes) {
        const wanted = new Set(s.orders.slots.flatMap((sl) => Object.keys(sl.order?.items ?? {})));
        const recipes = [...content.recipes.values()]
          .filter(({ machine }) => machine.unlockLevel <= s.player.level)
          .sort((a, b) => Number(wanted.has(b.recipe.output)) - Number(wanted.has(a.recipe.output)) || (content.items.get(b.recipe.output)?.sellPrice ?? 0) - (content.items.get(a.recipe.output)?.sellPrice ?? 0));
        for (const { recipe } of recipes) for (let k = 0; k < 4; k++) if (!run({ type: 'startJob', recipeId: recipe.id }, t).ok) break;
      }
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
        // Lò Gốm (M7): cast the cheapest castable pot not owned yet when the minerals are in the bag;
        // B7: put shards together into a pot, then spend the rest on stars.
        const cast = castablePots(content, s.player.level)
          .filter((d) => !owned.has(d.id) && d.id !== pick?.id)
          .sort((a, b) => (rank[a.rarity] ?? 3) - (rank[b.rarity] ?? 3))
          .find((d) => { const r = castRecipe(content, d, s.player.level); return r && canAfford(s, { coins: r.coins + RESERVE, items: r.items }); });
        if (cast) run({ type: 'castPot', potId: cast.id }, t);
        for (const d of content.potList) if (d.group === 'crafted' && !owned.has(d.id)) run({ type: 'combineShards', potId: d.id }, t);
        for (const id of Object.keys(s.pots)) while (run({ type: 'starUpPot', potInstanceId: id }, t).ok);
      }
      // Câu cá (M7): the free bait plus a few crafted ones each day; 70% of pulls hold the line. Common
      // fish go for coins, rarer ones for their last (best) option; the Sổ Cá rewards are claimed.
      if (m === 0 && fishingOpen(content, s)) {
        run({ type: 'claimFreeBait' }, t);
        for (let k = 0; k < FISH_PER_DAY; k++) {
          const bait = content.fishing!.baits.map((b) => b.item).find((id) => (s.inventory[id] ?? 0) > 0 || run({ type: 'craftBait', bait: id }, t).ok);
          if (!bait) break;
          const cast = run({ type: 'castLine', bait }, t);
          if (!cast.ok) break;
          const reel = run({ type: 'reelFish', success: randomFor(s.seed, 'simFish', day, k) < 0.7 }, t);
          const ev = reel.ok ? reel.events.find((e) => e.type === 'fishReeled') : undefined;
          if (ev && ev.type === 'fishReeled' && ev.landed) {
            const f = content.fishing!.fish.find((x) => x.id === ev.fishId)!;
            run({ type: 'exchangeFish', fishId: f.id, option: f.rarity === 'common' ? 0 : f.exchange.length - 1 }, t);
          }
        }
        while (run({ type: 'claimFishBook' }, t).ok);
      }
      // Biển Mây (M7): spend the Năng Lượng Gió on the next hidden clouds, row by row.
      if (seaOpen(content, s)) {
        run({ type: 'tick' }, t);
        for (let k = 0; k < 60; k++) {
          const cell = Array.from({ length: s.seaMap.open.length + 1 }, (_, i) => i).find((i) => !s.seaMap.open.includes(i)) ?? -1;
          if (cell < 0 || !run({ type: 'blowCloud', cell }, t).ok) break;
        }
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
      if (nf && s.player.level >= nf.unlockLevel && s.player.coins - RESERVE >= floorUnlockCost(content, nf, s.player.level)) run({ type: 'unlockFloor', floorId: nf.id }, t);
      s.floors.forEach((f, floor) => {
        const c = expandCost(content.floors.get(f.floorId)!, f, content, s.player.level);
        if (c !== null && s.player.coins - RESERVE >= c) run({ type: 'expandFloor', floor }, t);
        run({ type: 'upgradeFloorStar', floor }, t);
      });
      // Sạp Săn Hàng (12 TỔNG B2): take every Hiếm-or-better slot and anything an order wants; pots for
      // gems when 20 gems stay. Then a hunter's few paid rerolls while one costs ≤ 5% of the coins.
      if (bazaarOpen(content, s)) {
        const shop = () => {
          const wanted = wantedItems(content, s);
          (s.bazaar?.slots ?? []).forEach((sl, i) => {
            if (sl.sold) return;
            const good = sl.rarity === 'rare' || sl.rarity === 'epic' || sl.rarity === 'legendary' || wanted.has(sl.id);
            if (sl.currency === 'gems' ? s.player.gems - sl.price >= 20 : good && s.player.coins - sl.price >= RESERVE) run({ type: 'buyBazaar', slot: i }, t);
          });
        };
        run({ type: 'tick' }, t);
        shop();
        for (let k = 0; k < BAZAAR_REROLLS && rerollCost(content, s, t) <= 0.05 * s.player.coins; k++) {
          if (!run({ type: 'rerollBazaar' }, t).ok) break;
          shop();
        }
      }
      // Trang trí (M7): fill empty decor slots, lantern then crystal, when 3× the price is in hand.
      if (content.decor) s.floors.forEach((f, fi) => f.decor.forEach((d, si) => {
        if (d) return;
        const id = si === 0 ? 'base:decor.lantern' : 'base:decor.crystal';
        const price = decorPrice(content, s, id);
        if (price !== null && s.player.coins - RESERVE > 3 * price && run({ type: 'buyDecor', itemId: id }, t).ok) run({ type: 'placeDecor', floor: fi, slot: si, itemId: id }, t);
      }));
      // Làng Phú Bà (11 TỔNG N4): start the cheapest house upgrade whose items are in the bag when 2× its coins are.
      if (content.village) {
        const next = content.village.houses
          .map((h) => ({ h, c: nextHouseCost(content, s, h.id) }))
          .filter((x) => x.c && canAfford(s, { coins: 2 * x.c.coins + RESERVE, items: x.c.items }))
          .sort((a, b) => a.c!.coins - b.c!.coins)[0];
        if (next) run({ type: 'upgradeHouse', house: next.h.id }, t);
        run({ type: 'claimCheckIn' }, t);
      }
      if (s.player.coins - RESERVE > 2 * storageUpgradeCost(content, s)) run({ type: 'upgradeStorage' }, t);
      // Mưa Mây on the first visit of the day when it costs at most half the gems held.
      if (m === 0) {
        const fi = s.floors.length - 1;
        const c = cloudRainCost(content, s, fi, t);
        if (c.pots > 0 && c.gems <= s.player.gems) run({ type: 'cloudRain', floor: fi }, t);
      }
      // Xưởng Bọ: raise a machine's star whenever the coins allow (it costs the machine's worker bug).
      for (const mc of content.recipes ? new Set([...content.recipes.values()].map((r) => r.machine)) : []) {
        const c = nextStarCost(content, mc, machineState(content, s, mc.id), s.player.level);
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
    // Bugs beyond a working reserve (pot upgrades, Xưởng workers) go to the bug trader at day's end.
    for (const id of content.bugs.keys()) {
      const extra = (s.inventory[id] ?? 0) - BUG_RESERVE;
      if (extra > 0) run({ type: 'sellBugs', itemId: id, qty: extra }, T0 + day * 86_400_000 + 86_399_000);
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
      commonBugsPerPot: (bugsByRarity.common ?? 0) / Math.max(1, s.floors.reduce((a, f) => a + f.slots.filter((x) => x.potInstanceId).length, 0)),
      income: dayIncome,
      gifts: giftsFound,
    });
    dayIncome = 0;
    giftsFound = 0;
    milestones = 0;
    gemsEarned = 0;
    questsClaimed = 0;
  }
  return { days: out, state: s, gemSources, coinFlow };
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
