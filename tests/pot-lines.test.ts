// POT_SYSTEM prototype acceptance: Chậu Đất Nung 1–10, mission pot (Đỉnh Đồng Công Trạng),
// event pot (Sen Ngọc Trăng Rằm), balance rules, saving, and adding new lines safely.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { SAVE_VERSION, type GameState } from '../src/core/state.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { potLook, potStat, powerScore } from '../src/systems/pots.ts';
import { activeEvents } from '../src/systems/events.ts';
import { deserialize, serialize } from '../src/persistence/serializer.ts';
import { migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { buildContentPack, DAISY, HOUR, loadBase, MIN, newGame, readRaw, T0 } from './helpers.ts';

const content = await loadBase();
const CLAY = 'base:pot.terracotta';
const BRONZE = 'base:pot.bronze-tripod';
const LOTUS = 'base:pot.jade-lotus';
const EVENT = 'base:event.moon-festival';
const ev = content.events.find((e) => e.id === EVENT)!;
const at = (floor: number, slot: number) => ({ floor, slot });

/** Gives exactly what the next upgrade of a pot needs (coins, items, player level). */
function fund(s: GameState, potInstanceId: string): void {
  const pot = s.pots[potInstanceId]!;
  const def = content.pots.get(pot.potId)!;
  const cost = def.levels[pot.level]!.upgradeCost!;
  s.player.coins += cost.coins;
  for (const [id, q] of Object.entries(cost.items)) s.inventory[id] = (s.inventory[id] ?? 0) + q;
  s.player.level = Math.max(s.player.level, def.levelReq[pot.level]!);
}

test('Chậu Đất Nung 1→10: nâng thật, trừ đúng chi phí, ngoại hình đổi ở cấp 5 và 10, có lịch sử, dừng ở cấp mở', () => {
  const s = newGame(content);
  const id = s.floors[0]!.slots[0]!.potInstanceId;
  const def = content.pots.get(CLAY)!;
  const looks: number[] = [];
  for (let lv = 2; lv <= 10; lv++) {
    fund(s, id);
    const before = { coins: s.player.coins };
    const cost = def.levels[lv - 1]!.upgradeCost!;
    const r = dispatch(content, s, { type: 'upgradePot', potInstanceId: id }, T0 + lv * MIN);
    assert.ok(r.ok, `lên cấp ${lv}`);
    assert.equal(s.player.coins, before.coins - cost.coins);
    const e = r.events[0]!;
    assert.ok(e.type === 'potUpgraded' && e.level === lv);
    if (e.type === 'potUpgraded') assert.equal(e.milestone, lv === 5 || lv === 10, `mốc tiến hóa ở cấp ${lv}`);
    looks.push(potLook(def, lv).index);
  }
  assert.deepEqual([...new Set(looks)], [0, 1, 2]);
  assert.equal(potLook(def, 7).step, 2, 'cấp 7 = ngoại hình cấp 5 + 2 bậc nhỏ');
  assert.equal(s.pots[id]!.history!.at(-1)!.level, 10);
  assert.equal(s.potBook[CLAY]!.bestLevel, 10);
  fund(s, id);
  assert.deepEqual(dispatch(content, s, { type: 'upgradePot', potInstanceId: id }, T0 + HOUR), { ok: false, error: 'level_not_open' });
});

test('cấp chậu cần cấp người chơi theo giai đoạn; thiếu thì không trừ gì', () => {
  const s = newGame(content);
  const id = s.floors[0]!.slots[0]!.potInstanceId;
  for (let i = 0; i < 4; i++) {
    fund(s, id);
    assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: id }, T0).ok);
  }
  fund(s, id);
  s.player.level = 1;
  const coins = s.player.coins;
  assert.deepEqual(dispatch(content, s, { type: 'upgradePot', potInstanceId: id }, T0), { ok: false, error: 'locked' });
  assert.equal(s.player.coins, coins);
});

test('kỹ năng Giữ Ẩm (Đất Nung cấp 10) làm mỗi lần tưới rút ngắn nhiều thời gian hơn', () => {
  const save = (lv: number) => {
    const s = newGame(content);
    const id = s.floors[0]!.slots[0]!.potInstanceId;
    s.pots[id]!.level = lv;
    s.player.level = 10;
    assert.ok(dispatch(content, s, { type: 'plant', cropId: 'base:crop.cloud-mint', ...at(0, 0) }, T0).ok);
    let t = T0;
    while (!cropStatus(content, s, s.floors[0]!.slots[0]!, t)!.thirsty) t += MIN;
    const r = dispatch(content, s, { type: 'water', ...at(0, 0) }, t);
    assert.ok(r.ok && r.events[0]!.type === 'watered');
    return r.ok && r.events[0]!.type === 'watered' ? r.events[0]!.savedMs : 0;
  };
  const s9 = newGame(content);
  const id9 = s9.floors[0]!.slots[0]!.potInstanceId;
  s9.pots[id9]!.level = 10;
  assert.ok(potStat(content, s9.pots[id9]!, 'care') > content.pots.get(CLAY)!.levels[9]!.stats.care!, 'kỹ năng cộng vào chăm sóc');
  assert.ok(save(10) > save(9) * 1.2, 'tưới ở cấp 10 tiết kiệm nhiều hơn rõ rệt');
});

test('chậu nhiệm vụ: không mua được; xong nhiệm vụ ngày nhận Ấn; đủ 5 Ấn đổi được chậu', () => {
  const s = newGame(content, { coins: 1_000_000, level: 20 });
  assert.deepEqual(dispatch(content, s, { type: 'buyPot', potId: BRONZE }, T0), { ok: false, error: 'not_for_sale' });
  assert.deepEqual(dispatch(content, s, { type: 'obtainPot', potId: BRONZE }, T0), { ok: false, error: 'not_enough_items' });
  for (let day = 0; day < 5; day++) {
    const t = T0 + day * 24 * HOUR;
    dispatch(content, s, { type: 'tick' }, t);
    for (const m of s.missions.list) m.progress = content.missions.pool.find((p) => p.id === m.id)!.target;
    for (let i = 0; i < s.missions.list.length; i++) assert.ok(dispatch(content, s, { type: 'claimMission', index: i }, t).ok);
    assert.ok(dispatch(content, s, { type: 'claimMissionBonus' }, t).ok);
  }
  assert.equal(s.inventory['base:mat.merit-seal'], 5);
  const r = dispatch(content, s, { type: 'obtainPot', potId: BRONZE }, T0 + 5 * 24 * HOUR);
  assert.ok(r.ok && r.events[0]!.type === 'potObtained');
  assert.equal(s.inventory['base:mat.merit-seal'] ?? 0, 0);
  const inst = s.pots[s.potStock.at(-1)!]!;
  assert.equal(inst.potId, BRONZE);
  assert.equal(inst.source, 'exchange');
  assert.ok(s.potBook[BRONZE]);
});

test('kỹ năng Mùa Bội Thu (Đỉnh Đồng cấp 10) thật sự cho thu hoạch gấp đôi khoảng 12% số lần', () => {
  const s = newGame(content, { level: 20 });
  const id = s.floors[0]!.slots[0]!.potInstanceId;
  s.pots[id] = { potId: BRONZE, level: 10, history: [] };
  let doubled = 0;
  let t = T0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 0) }, t).ok);
    t += 2 * MIN;
    s.inventory = {};
    const r = dispatch(content, s, { type: 'harvest', ...at(0, 0) }, t);
    assert.ok(r.ok);
    if (r.ok && r.events.some((e) => e.type === 'harvested' && e.doubled)) doubled++;
  }
  assert.ok(doubled > N * 0.07 && doubled < N * 0.18, `gấp đôi ${doubled}/${N}`);
  s.pots[id]!.level = 9;
  let none = 0;
  for (let i = 0; i < 100; i++) {
    dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 0) }, t);
    t += 2 * MIN;
    s.inventory = {};
    const r = dispatch(content, s, { type: 'harvest', ...at(0, 0) }, t);
    if (r.ok && r.events.some((e) => e.type === 'harvested' && e.doubled)) none++;
  }
  assert.equal(none, 0, 'chưa tới cấp 10 thì không có kỹ năng');
});

test('chậu sự kiện: tích điểm trong thời gian sự kiện, mốc 100 điểm trao chậu, sau sự kiện vẫn giữ và nâng cấp được', () => {
  const s = newGame(content, { level: 10 });
  const during = ev.start + HOUR;
  assert.equal(activeEvents(content, during).length, 1);
  let t = during;
  while ((s.events[EVENT]?.points ?? 0) < 100) {
    dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 0) }, t);
    t += 2 * MIN;
    s.inventory = {};
    const r = dispatch(content, s, { type: 'harvest', ...at(0, 0) }, t);
    assert.ok(r.ok && r.events.some((e) => e.type === 'eventPoints'));
  }
  const potMilestone = ev.milestones.findIndex((m) => m.reward.pot === LOTUS);
  for (let i = 0; i <= potMilestone; i++) assert.ok(dispatch(content, s, { type: 'claimEventMilestone', eventId: EVENT }, t).ok, `mốc ${i}`);
  const lotusId = Object.keys(s.pots).find((k) => s.pots[k]!.potId === LOTUS)!;
  assert.ok(lotusId);
  assert.equal(s.pots[lotusId]!.source, 'event');
  assert.deepEqual(dispatch(content, s, { type: 'buyPot', potId: LOTUS }, t), { ok: false, error: 'not_for_sale' });

  // After the event: no more points, the pot stays and still levels up with materials.
  const after = ev.end + HOUR;
  const pts = s.events[EVENT]!.points;
  dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 1) }, after);
  dispatch(content, s, { type: 'harvest', ...at(0, 1) }, after + 2 * MIN);
  assert.equal(s.events[EVENT]!.points, pts, 'hết sự kiện không cộng điểm');
  fund(s, lotusId);
  assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: lotusId }, after + 3 * MIN).ok);
  assert.equal(s.pots[lotusId]!.level, 2);
});

test('Hạt Sen Trăng vẫn kiếm được sau sự kiện: rơi khi thu hoạch trong Sen Ngọc', () => {
  const s = newGame(content, { level: 10 });
  const id = s.floors[0]!.slots[0]!.potInstanceId;
  s.pots[id] = { potId: LOTUS, level: 1, history: [] };
  let t = ev.end + HOUR;
  for (let i = 0; i < 200; i++) {
    dispatch(content, s, { type: 'plant', cropId: DAISY, ...at(0, 0) }, t);
    t += 2 * MIN;
    for (const k of Object.keys(s.inventory)) if (k.startsWith('base:item.')) delete s.inventory[k];
    dispatch(content, s, { type: 'harvest', ...at(0, 0) }, t);
  }
  const seeds = s.inventory['base:mat.moon-seed'] ?? 0;
  assert.ok(seeds > 10 && seeds < 60, `hạt sen ${seeds}/200 lần thu`);
});

test('cân bằng: mỗi dòng có hướng riêng; chậu nhiệm vụ/sự kiện cấp 1 yếu hơn Đất Nung cấp 50; cấp 50 hơn nhưng không quá 30%', () => {
  const clay = content.pots.get(CLAY)!;
  const top = powerScore(clay, 50);
  for (const id of [BRONZE, LOTUS]) {
    const d = content.pots.get(id)!;
    assert.ok(powerScore(d, 1) < top, `${id} cấp 1 < Đất Nung cấp 50`);
    assert.ok(powerScore(d, 50) <= top * 1.3, `${id} cấp 50 ≤ 1,3 × Đất Nung cấp 50`);
  }
  assert.ok(powerScore(content.pots.get(BRONZE)!, 50) > top, 'chậu nhiệm vụ cấp 50 có giá trị hơn chậu phổ thông cấp 50');
  assert.deepEqual([CLAY, BRONZE, LOTUS].map((id) => content.pots.get(id)!.focus), ['speed', 'yield', 'luck']);
  // Totals are capped whatever stacks up.
  const s = newGame(content);
  const slot = s.floors[0]!.slots[0]!;
  s.pots[slot.potInstanceId] = { potId: CLAY, level: 50, history: [] };
  s.floors[0]!.stars = 3;
  assert.ok(slotBonus(content, s, slot, content.crops.get(DAISY)!, 'speed') <= content.config.bonusCaps!.speed!);
});

test('lưu và mở lại: cấp, lịch sử, bộ sưu tập, sự kiện giữ nguyên', () => {
  const s = newGame(content);
  const id = s.floors[0]!.slots[0]!.potInstanceId;
  fund(s, id);
  dispatch(content, s, { type: 'upgradePot', potInstanceId: id }, T0 + MIN);
  s.events[EVENT] = { points: 42, claimed: 2 };
  const back = deserialize(serialize(s, T0 + 2 * MIN)).state;
  const { state } = reconcile(back, content, 'local');
  assert.equal(state.pots[id]!.level, 2);
  assert.deepEqual(state.pots[id]!.history, s.pots[id]!.history);
  assert.deepEqual(state.potBook, s.potBook);
  assert.deepEqual(state.events[EVENT], { points: 42, claimed: 2 });
});

test('save bản 7 lên bản 8: giữ cấp chậu, tạo sổ sưu tập, không mất chậu', () => {
  const s = newGame(content);
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>;
  raw.saveVersion = 7;
  delete raw.potBook;
  delete raw.potBookClaimed;
  delete raw.events;
  for (const p of Object.values(raw.pots) as any[]) {
    delete p.history;
    delete p.source;
  }
  raw.pots['pot-1'].level = 4;
  const migrated = migrate(raw, 7) as any;
  assert.equal(migrated.saveVersion, SAVE_VERSION);
  const { state } = reconcile(migrated, content, 'local');
  assert.equal(state.pots['pot-1']!.level, 4);
  assert.equal(state.pots['pot-1']!.source, 'old-save');
  assert.equal(state.potBook[CLAY]!.bestLevel, 4);
  assert.equal(Object.keys(state.pots).length, Object.keys(s.pots).length);
});

test('thêm dòng chậu mới vào nội dung không đổi dữ liệu chậu cũ', async () => {
  const s = newGame(content);
  const before = JSON.stringify(s.pots);
  const raw = await readRaw();
  const extra = JSON.parse(JSON.stringify((raw.pots as any[]).find((p) => p.id === CLAY)));
  extra.id = 'base:pot.test-new-line';
  extra.name = { vi: 'Chậu Thử' };
  (raw.pots as any[]).push(extra);
  const bigger = buildContentPack(raw);
  assert.equal(bigger.pots.size, content.pots.size + 1);
  const { state } = reconcile(JSON.parse(JSON.stringify(s)), bigger, 'local');
  assert.equal(JSON.stringify(state.pots), before);
  assert.ok(dispatch(bigger, state, { type: 'plant', cropId: DAISY, ...at(0, 0) }, T0).ok);
});
