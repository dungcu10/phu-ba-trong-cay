// Nâng cấp v3 đợt 2: quest engine, features, tutorials, old saves, and a newbie run that only
// follows the tracked quest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildContentPack, ContentError, type ContentPack } from '../src/core/content.ts';
import { dispatch, type GameEvent } from '../src/core/game.ts';
import { QUEST_TRIGGERS } from '../src/core/questdefs.ts';
import type { GameState } from '../src/core/state.ts';
import { SaveManager } from '../src/persistence/saveManager.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { checksumOf } from '../src/persistence/serializer.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { canDeliver } from '../src/systems/orders.ts';
import { canAfford, nextUpgradeCost } from '../src/systems/pots.ts';
import { botGarden } from '../src/systems/visit.ts';
import { featureOpen, monthKey, pendingTutorial, questActive, questReward, questView, recordQuests, trackQuests, trackedQuest, weekKey } from '../src/systems/quests.ts';
import { DAISY, HOUR, loadBase, MIN, newGame, readRaw, T0 } from './helpers.ts';

const content = await loadBase();
const VN = (iso: string) => Date.parse(`${iso}+07:00`);

test('nội dung nhiệm vụ: đủ 6 tuyến, chuỗi tân thủ nối nhau, tính năng và hướng dẫn hợp lệ', () => {
  assert.deepEqual([...content.questTracks.keys()], ['newbie', 'weekly', 'monthly', 'journey', 'achievement', 'secret']);
  const newbie = content.questList.filter((q) => q.track === 'newbie');
  assert.ok(newbie.length >= 15);
  newbie.slice(1).forEach((q, i) => assert.deepEqual(q.requires, [newbie[i]!.id]));
  assert.ok(content.questList.filter((q) => q.track === 'secret').every((q) => q.hidden));
  for (const f of content.features.values()) assert.ok(f.tutorial && content.tutorials.has(f.tutorial), f.id);
});

test('validator từ chối: trigger lạ, cây không có, vòng lặp requires, thưởng rỗng, tính năng trỏ nhiệm vụ không có', async () => {
  const cases: Array<[string, (raw: Record<string, any>) => void]> = [
    ['trigger "fly" không có', (r) => (r.quests.quests[0].trigger = 'fly')],
    ['không tồn tại', (r) => (r.quests.quests[0].filter = { cropId: 'base:crop.khong-co' })],
    ['vòng lặp requires', (r) => (r.quests.quests[0].requires = [r.quests.quests[2].id])],
    ['phần thưởng rỗng', (r) => (r.quests.quests[3].reward = {})],
    ['nhiệm vụ "x" không tồn tại', (r) => (r.features[0].quest = 'x')],
  ];
  for (const [msg, edit] of cases) {
    const raw = (await readRaw()) as unknown as Record<string, any>;
    edit(raw);
    assert.throws(() => buildContentPack(raw as never), (e: unknown) => e instanceof ContentError && e.problems.some((p) => p.includes(msg)), msg);
  }
});

/** A pack with one counted test quest per trigger (target 1), to check every trigger counts. */
async function triggerPack(): Promise<ContentPack> {
  const raw = (await readRaw()) as unknown as { quests: { tracks: unknown[]; quests: unknown[] } };
  raw.quests.tracks.push({ id: 'test', name: { vi: 'Thử' } });
  for (const t of QUEST_TRIGGERS) raw.quests.quests.push({ id: `test.${t}`, track: 'test', name: { vi: t }, trigger: t, target: 1, reward: { coins: 1 } });
  return buildContentPack(raw as never);
}

test('mỗi trigger đều được đếm từ đúng sự kiện game', async () => {
  const c = await triggerPack();
  const s = newGame(c, { level: 10 });
  const slot = { floor: 0, slot: 0 };
  const tomatoItem = c.crops.get('base:crop.cherry-tomato')!.produce.id;
  const pot = Object.keys(s.pots)[0]!;
  const events: Record<string, GameEvent> = {
    plant: { type: 'planted', slot, cropId: DAISY, cost: 0 },
    water: { type: 'watered', slot, savedMs: 1 },
    catchBug: { type: 'bugCaught', slot, itemId: 'base:bug.ladybird' },
    harvest: { type: 'harvested', slot, itemId: tomatoItem, qty: 3, xp: 1, cleared: false, mutation: null },
    harvestQty: { type: 'harvested', slot, itemId: tomatoItem, qty: 3, xp: 1, cleared: false, mutation: null },
    mutation: { type: 'harvested', slot, itemId: `${tomatoItem}~golden`, qty: 1, xp: 1, cleared: false, mutation: 'golden' },
    sell: { type: 'sold', itemId: tomatoItem, qty: 2, coins: 10 },
    earnCoins: { type: 'sold', itemId: tomatoItem, qty: 2, coins: 10 },
    deliverOrder: { type: 'orderDelivered', slot: 0, coins: 5, xp: 1, gems: 0, customer: 'x', rare: false },
    upgradePot: { type: 'potUpgraded', potInstanceId: pot, level: 2, milestone: false, skills: [] },
    buyPot: { type: 'potBought', potInstanceId: pot, potId: 'base:pot.terracotta', cost: 25 },
    unlockFloor: { type: 'floorUnlocked', floorId: 'x', index: 1, cost: 1 },
    expandFloor: { type: 'floorExpanded', floor: 0, slot: 6, cost: 1 },
    starFloor: { type: 'floorStarred', floor: 0, stars: 1 },
    helpNeighbor: { type: 'neighborHelped', botId: 'x', floor: 0, slot: 0, kind: 'water', coins: 1, xp: 1 },
    listStall: { type: 'itemListed', listingId: 1, itemId: tomatoItem, qty: 1, price: 5 },
    stallSold: { type: 'stallSold', botId: 'x', itemId: tomatoItem, qty: 1, coins: 5 },
    claimDaily: { type: 'missionClaimed', index: 0, coins: 1, xp: 1, gems: 0 },
    claimJournal: { type: 'journalClaimed', cropId: DAISY, gems: 1, harvests: 1 },
    cloudRain: { type: 'cloudRained', floor: 0, pots: 1, gems: 1 },
    upgradeStorage: { type: 'storageUpgraded', tier: 1, capacity: 80, cost: 1 },
    levelUp: { type: 'levelUp', level: 11 },
  };
  assert.deepEqual(Object.keys(events).sort(), [...QUEST_TRIGGERS].sort(), 'bảng thử phủ đủ mọi trigger');
  for (const t of QUEST_TRIGGERS) {
    const fresh = structuredClone(s);
    const done = recordQuests(c, fresh, [events[t]!], T0);
    assert.ok(done.includes(`test.${t}`), `${t} được đếm`);
    if (t === 'harvestQty') assert.equal(fresh.quests.progress['test.harvestQty'], 1, 'nhiệm vụ một lần dừng ở mục tiêu');
  }
});

test('bộ lọc: cây, họ cây, Biến Dị, tầng, khung giờ', async () => {
  const raw = (await readRaw()) as unknown as { quests: { tracks: unknown[]; quests: unknown[] } };
  raw.quests.tracks.push({ id: 'test', name: { vi: 'Thử' } });
  const add = (id: string, filter: object) => raw.quests.quests.push({ id, track: 'test', name: { vi: id }, trigger: 'harvest', filter, tiers: { base: 100, growth: 2 }, reward: { coins: 1 } });
  add('f.crop', { cropId: DAISY });
  add('f.family', { family: 'fruit' });
  add('f.floor', { floorMin: 1 });
  add('f.night', { hours: [0, 4] });
  const c = buildContentPack(raw as never);
  const s = newGame(c);
  const daisyItem = c.crops.get(DAISY)!.produce.id;
  const tomatoItem = c.crops.get('base:crop.cherry-tomato')!.produce.id;
  const h = (itemId: string, floor: number): GameEvent => ({ type: 'harvested', slot: { floor, slot: 0 }, itemId, qty: 1, xp: 1, cleared: true, mutation: null });
  recordQuests(c, s, [h(daisyItem, 0), h(tomatoItem, 1), h(tomatoItem, 0)], VN('2026-11-17T02:30:00'));
  recordQuests(c, s, [h(daisyItem, 0)], VN('2026-11-17T09:00:00'));
  assert.equal(s.quests.progress['f.crop'], 2);
  assert.equal(s.quests.progress['f.family'], 2);
  assert.equal(s.quests.progress['f.floor'], 1);
  assert.equal(s.quests.progress['f.night'], 3);
});

test('tân thủ: chỉ bước đầu mở; xong mới nhận; nhận đúng một lần; bước sau mới mở', () => {
  const s = newGame(content);
  const newbie = content.questList.filter((q) => q.track === 'newbie');
  assert.ok(questActive(content, s, newbie[0]!));
  assert.ok(!questActive(content, s, newbie[1]!));
  assert.equal(trackedQuest(content, s)!.def.id, newbie[0]!.id);
  const bad = dispatch(content, s, { type: 'claimQuest', questId: newbie[0]!.id }, T0);
  assert.equal(bad.ok ? 'ok' : bad.error, 'quest_not_ready');
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0).ok);
  assert.ok(questView(content, s, newbie[0]!).claimable);
  const coins = s.player.coins;
  const r = dispatch(content, s, { type: 'claimQuest', questId: newbie[0]!.id }, T0);
  assert.ok(r.ok);
  assert.equal(s.player.coins - coins, questReward(content, newGame(content), newbie[0]!).coins);
  const again = dispatch(content, s, { type: 'claimQuest', questId: newbie[0]!.id }, T0);
  assert.equal(again.ok ? 'ok' : again.error, 'quest_not_ready');
  assert.ok(questActive(content, s, newbie[1]!));
});

test('nhiệm vụ tuần đổi đúng 0 giờ thứ Hai, tháng đổi đúng ngày 1 (giờ Việt Nam); bốc thăm giữ nguyên cả kỳ', () => {
  assert.equal(weekKey(content, VN('2026-11-22T23:59:59')) + 1, weekKey(content, VN('2026-11-23T00:00:00')), 'thứ Hai 23/11');
  assert.equal(weekKey(content, VN('2026-11-17T00:00:00')), weekKey(content, VN('2026-11-22T23:00:00')));
  assert.equal(monthKey(content, VN('2026-11-30T23:59:59')) + 1, monthKey(content, VN('2026-12-01T00:00:00')));
  const s = newGame(content, { level: 20 });
  const t1 = VN('2026-11-18T10:00:00');
  dispatch(content, s, { type: 'tick' }, t1);
  const picks = s.quests.periods['weekly']!.picks;
  assert.equal(picks.length, content.questTracks.get('weekly')!.pick);
  const q = content.quests.get(picks[0]!)!;
  s.quests.progress[q.id] = 5;
  s.player.level = 40;
  dispatch(content, s, { type: 'tick' }, VN('2026-11-22T23:00:00'));
  assert.deepEqual(s.quests.periods['weekly']!.picks, picks, 'giữa tuần không bốc lại dù lên cấp');
  assert.equal(s.quests.progress[q.id], 5);
  dispatch(content, s, { type: 'tick' }, VN('2026-11-23T00:00:01'));
  assert.notEqual(s.quests.periods['weekly']!.key, weekKey(content, t1));
  assert.equal(s.quests.progress[q.id], undefined, 'tuần mới: tiến trình về 0');
  assert.equal(s.quests.periods['monthly']!.picks.length, content.questTracks.get('monthly')!.pick);
});

test('thành tựu nhiều bậc: mục tiêu tăng, nhận lần lượt từng bậc', () => {
  const s = newGame(content);
  const q = content.quests.get('achievement.harvest')!;
  const t0 = questView(content, s, q).target!;
  s.quests.progress[q.id] = 10_000;
  let n = 0;
  while (dispatch(content, s, { type: 'claimQuest', questId: q.id }, T0).ok) n++;
  assert.ok(n >= 3, `nhận ${n} bậc`);
  assert.ok(questView(content, s, q).target! > t0);
  assert.ok(questView(content, s, q).target! > 10_000);
});

test('nhiệm vụ bí mật ẩn tới khi đạt', () => {
  const s = newGame(content);
  assert.equal(trackQuests(content, s, 'secret').length, 0);
  s.quests.progress['secret.rain5'] = 5;
  assert.deepEqual(trackQuests(content, s, 'secret').map((v) => v.def.id), ['secret.rain5']);
});

test('tính năng mở theo cấp, hướng dẫn hiện một lần và được lưu', async () => {
  const s = newGame(content);
  assert.equal(featureOpen(content, s, 'orders'), false);
  assert.equal(pendingTutorial(content, s), null);
  s.player.level = 2;
  assert.ok(featureOpen(content, s, 'orders'));
  const p = pendingTutorial(content, s)!;
  assert.equal(p.featureId, 'orders');
  assert.ok(dispatch(content, s, { type: 'seeTutorial', tutorialId: p.tutorialId }, T0).ok);
  assert.notEqual(pendingTutorial(content, s)?.tutorialId, p.tutorialId);
  const store = new MemoryStore();
  await new SaveManager(store, content).save(s, T0);
  const r = await new SaveManager(store, content).load();
  assert.ok(r.kind === 'loaded' && r.state.tutorials.includes(p.tutorialId));
});

test('save cũ: người chơi cấp cao được bỏ qua tân thủ và không bị hướng dẫn lại; người mới thì không', async () => {
  const raw = await readFile(join(import.meta.dirname, 'fixtures', 'save-v8-e17dd05.json'), 'utf8');
  for (const level of [3, 12]) {
    const env = JSON.parse(raw) as { data: { player: { level: number } }; checksum: string };
    env.data.player.level = level;
    const data = JSON.stringify(env.data);
    const text = raw.replace(/"checksum":"[^"]*"/, `"checksum":"${checksumOf(data)}"`).replace(/"data":[\s\S]*\}\s*$/, `"data":${data}}`);
    const s = new SaveManager(new MemoryStore(), content).parseImport(text).state;
    const newbie = content.questList.filter((q) => q.track === 'newbie');
    if (level >= 6) {
      assert.ok(newbie.every((q) => (s.quests.claims[q.id] ?? 0) === 1), 'đã bỏ qua tân thủ');
      assert.equal(pendingTutorial(content, s), null, 'không hiện lại hướng dẫn');
      assert.notEqual(trackedQuest(content, s)?.def.track, 'newbie');
    } else {
      assert.ok(newbie.every((q) => !s.quests.claims[q.id]), 'người mới vẫn có tân thủ');
      assert.ok(s.tutorials.includes('tut.orders') && s.tutorials.includes('tut.shop'), 'tính năng đã mở thì không hướng dẫn lại');
    }
  }
});

/** A newbie who only does what the tracked quest says (plus harvesting and selling). */
function followTheGuide(c: ContentPack, s: GameState): { minutes: number; claimed: string[]; blocked: string[] } {
  const claimed: string[] = [];
  const blocked: string[] = [];
  const run = (cmd: Parameters<typeof dispatch>[2], t: number) => dispatch(c, s, cmd, t);
  for (let m = 0; m <= 8 * 60; m++) {
    const t = T0 + m * MIN;
    run({ type: 'tick' }, t);
    const q = trackedQuest(c, s);
    if (!q || q.def.track !== 'newbie') return { minutes: m, claimed, blocked };
    if (q.claimable) {
      if (run({ type: 'claimQuest', questId: q.def.id }, t).ok) claimed.push(q.def.id);
      continue;
    }
    const f = q.def.filter ?? {};
    // For an order: grow what the first open order asks for, and keep it out of the sale.
    const want = q.def.trigger === 'deliverOrder' ? s.orders.slots.find((o) => o.order)?.order?.items ?? {} : {};
    const missing = Object.entries(want).find(([id, n]) => (s.inventory[id] ?? 0) < n)?.[0];
    const orderCrop = missing ? c.cropList.find((cr) => cr.produce.id === missing)?.id : undefined;
    s.floors.forEach((fl, floor) =>
      fl.slots.forEach((sl, slot) => {
        const st = cropStatus(c, s, sl, t);
        if (st?.bug) run({ type: 'catchBug', floor, slot }, t);
        if (st?.thirsty) run({ type: 'water', floor, slot }, t);
        if (st?.ripe) run({ type: 'harvest', floor, slot }, t);
        if (!sl.planting) {
          const crop = f.cropId ?? orderCrop ?? (s.player.level >= 2 && s.player.coins >= 6 ? 'base:crop.cherry-tomato' : DAISY);
          run({ type: 'plant', cropId: crop, floor, slot }, t);
        }
      }),
    );
    for (let i = 0; i < s.missions.list.length; i++) run({ type: 'claimMission', index: i }, t);
    s.orders.slots.forEach((o, i) => o.order && canDeliver(s, o.order) && run({ type: 'deliverOrder', slot: i }, t));
    const trig = q.def.trigger;
    const feature = { deliverOrder: 'orders', helpNeighbor: 'neighbors', listStall: 'stall' }[trig as string];
    if (feature && !featureOpen(c, s, feature)) blocked.push(`${q.def.id} cần ${feature}`);
    const sellable = Object.entries(s.inventory).filter(([id, n]) => n > 0 && c.items.get(id)?.countsTowardStorage);
    if (trig === 'listStall' && sellable[0]) run({ type: 'listItem', itemId: sellable[0][0], qty: 1, price: c.items.get(sellable[0][0])!.sellPrice! }, t);
    else for (const [id, n] of sellable) if (!(id in want)) run({ type: 'sell', itemId: id, qty: n }, t);
    if (trig === 'upgradePot') for (const id of Object.keys(s.pots)) if (canAfford(s, nextUpgradeCost(c, s.pots[id]!) ?? { coins: Infinity, items: {} })) run({ type: 'upgradePot', potInstanceId: id }, t);
    if (trig === 'expandFloor') run({ type: 'expandFloor', floor: 0 }, t);
    if (trig === 'helpNeighbor')
      for (const botId of c.bots.keys())
        botGarden(c, s, botId, t).forEach((fl, floor) => fl.pots.forEach((p, slot) => p.need && run({ type: 'helpNeighbor', botId, floor, slot, kind: p.need }, t)));
    if (q.def.measure === 'floors') {
      const next = c.floorList[s.floors.length];
      if (next) run({ type: 'unlockFloor', floorId: next.id }, t);
    }
  }
  return { minutes: Infinity, claimed, blocked };
}

test('người mới chỉ làm theo ô nhiệm vụ: đi hết chuỗi tân thủ tới tầng 2, không bước nào bị khóa tính năng', () => {
  const s = newGame(content);
  const r = followTheGuide(content, s);
  const newbie = content.questList.filter((q) => q.track === 'newbie').map((q) => q.id);
  assert.deepEqual(r.claimed, newbie, `xong ${r.claimed.length}/${newbie.length}; kẹt ở ${trackedQuest(content, s)?.def.id}`);
  assert.deepEqual([...new Set(r.blocked)], [], 'bước nào cũng có tính năng đã mở');
  assert.ok(r.minutes < 6 * 60, `mất ${r.minutes} phút`);
  assert.ok(s.player.level >= 5 && s.floors.length >= 2);
  void HOUR;
});
