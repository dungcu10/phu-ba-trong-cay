// Orders, surprises and neighbour BOTs (owner decision 2026-11-16, parts 2–4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, type GameEvent } from '../src/core/game.ts';
import { SAVE_VERSION, type GameState } from '../src/core/state.ts';
import { sellPrice } from '../src/systems/economy.ts';
import { simulateNeighbors, valuation } from '../src/systems/neighbors.ts';
import { rollGift, rollMutation } from '../src/systems/surprises.ts';
import { flightFor } from '../src/systems/orders.ts';
import { migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { DAISY, HOUR, loadBase, MIN, newGame, SEC, T0, TOMATO } from './helpers.ts';

const content = await loadBase();
const DAISY_ITEM = 'base:item.cotton-daisy';
const TOMATO_ITEM = 'base:item.cherry-tomato';
const BUG = 'base:bug.ladybird';
const tick = (s: GameState, t: number) => {
  const r = dispatch(content, s, { type: 'tick' }, t);
  assert.ok(r.ok);
  return r.events;
};

// ---------------------------------------------------------------- orders

test('đơn hàng: bảng có 6 đơn, chỉ đòi nông sản đã mở khóa, tất định theo hạt giống', () => {
  const a = newGame(content, { level: 2 }, 5);
  const b = newGame(content, { level: 2 }, 5);
  const ev = tick(a, T0);
  tick(b, T0);
  assert.ok(ev.some((e) => e.type === 'ordersArrived'));
  assert.equal(a.orders.slots.filter((s) => s.order).length, 6);
  assert.deepEqual(a.orders, b.orders);
  const allowed = new Set(content.cropList.filter((c) => c.unlockLevel <= 2).map((c) => c.produce.id));
  for (const s of a.orders.slots) for (const id of Object.keys(s.order!.items)) assert.ok(allowed.has(id), id);
});

test('giao đơn: cần đủ hàng, thưởng nhiều hơn bán lẻ, khinh khí cầu quay lại sau thời gian chờ', () => {
  const s = newGame(content, { level: 2 }, 9);
  tick(s, T0);
  const order = s.orders.slots[0]!.order!;
  assert.deepEqual(dispatch(content, s, { type: 'deliverOrder', slot: 0 }, T0), { ok: false, error: 'not_enough_items' });
  let shopValue = 0;
  for (const [id, qty] of Object.entries(order.items)) {
    s.inventory[id] = qty;
    shopValue += sellPrice(content, s, id, T0)! * qty;
  }
  const coins = s.player.coins;
  const pays = flightFor(content, s, order, null, T0).coins; // order coins + today's Cây Hot bonus
  const r = dispatch(content, s, { type: 'deliverOrder', slot: 0 }, T0);
  assert.ok(r.ok);
  assert.ok(order.coins > shopValue, `đơn ${order.coins} xu > bán lẻ ${shopValue} xu`);
  // Chỉ thị 10 § 3.6: the coins come back with the balloon.
  assert.equal(s.player.coins, coins);
  assert.equal(s.orders.slots[0]!.order, null);
  tick(s, T0 + (content.orders.refillSeconds - 1) * SEC);
  assert.equal(s.orders.slots[0]!.order, null);
  const back = dispatch(content, s, { type: 'tick' }, T0 + content.orders.refillSeconds * SEC);
  assert.ok(back.ok && back.events.some((e) => e.type === 'balloonBack' && e.slot === 0 && e.coins === pays));
  assert.ok(s.orders.slots[0]!.order);
  assert.equal(s.stats.ordersDone, 1);
  assert.ok(s.neighbors[order.customer]!.friendship > 0, 'khách quen hơn sau khi giao đơn');
});

test('bỏ đơn phải chờ lâu hơn; trả Ngọc Mây để gọi khinh khí cầu về ngay', () => {
  const s = newGame(content, {}, 3);
  tick(s, T0);
  assert.ok(dispatch(content, s, { type: 'skipOrder', slot: 2 }, T0).ok);
  tick(s, T0 + content.orders.refillSeconds * SEC);
  assert.equal(s.orders.slots[2]!.order, null);
  const gems = s.player.gems;
  assert.ok(dispatch(content, s, { type: 'rushOrder', slot: 2 }, T0 + MIN).ok);
  assert.ok(s.orders.slots[2]!.order);
  assert.equal(s.player.gems, gems - content.orders.skipNowGems);
  s.player.gems = 0;
  dispatch(content, s, { type: 'skipOrder', slot: 3 }, T0 + MIN);
  assert.deepEqual(dispatch(content, s, { type: 'rushOrder', slot: 3 }, T0 + MIN), { ok: false, error: 'not_enough_gems' });
});

// ---------------------------------------------------------------- surprises

test('Biến Dị: hiếm, May mắn làm tăng tỉ lệ, quả vàng bán giá gấp nhiều lần', () => {
  const s = newGame(content);
  let plain = 0;
  let lucky = 0;
  for (let id = 1; id <= 20000; id++) {
    const p = { id, cropId: DAISY, seedCost: 0, cycleStartedAt: T0, harvestsDone: 0, bonusMs: 0, wateredStages: [], caughtBugs: {} };
    if (rollMutation(content, s, p, 0)) plain++;
    if (rollMutation(content, s, p, 1)) lucky++;
  }
  const expected = content.surprises.mutations.reduce((a, m) => a + m.chance, 0) * 20000;
  assert.ok(plain > expected * 0.7 && plain < expected * 1.3, `${plain} ~ ${expected}`);
  assert.ok(lucky > plain * 1.6, `may mắn ${lucky} so với ${plain}`);
  const golden = content.items.get(`${DAISY_ITEM}~golden`)!;
  assert.equal(golden.sellPrice, content.items.get(DAISY_ITEM)!.sellPrice! * 3);
});

test('quà bất ngờ tính theo thời gian sinh trưởng: cây ngắn ít quà mỗi lần thu hơn cây dài', () => {
  const s = newGame(content);
  let short = 0;
  let long = 0;
  for (let id = 1; id <= 5000; id++) {
    const p = { id, cropId: DAISY, seedCost: 0, cycleStartedAt: T0, harvestsDone: 0, bonusMs: 0, wateredStages: [], caughtBugs: {} };
    if (rollGift(content, s, p, 60, 0)) short++;
    if (rollGift(content, s, p, 7200, 0)) long++;
  }
  assert.ok(short < 60, `cúc 1 phút: ${short}/5000`);
  // Capped at giftChanceMax (12 TỔNG B1.3: about 10–15 gifts a day), numbers read from surprises.json.
  const cfg = content.surprises;
  const want = 5000 * Math.min(cfg.giftChanceMax, (cfg.giftChancePer10Min * 7200) / 600);
  assert.ok(long > want * 0.8 && long < want * 1.2 && long > short * 3, `hoa 2 giờ: ${long}/5000, mong ${want}`);
});

test('thu hoạch ghi Sổ Tay; mốc đầu tiên nhận Ngọc Mây, nhận hai lần bị từ chối', () => {
  const s = newGame(content);
  const at = { floor: 0, slot: 0 };
  dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0);
  dispatch(content, s, { type: 'harvest', ...at }, T0 + 2 * MIN);
  assert.equal(s.journal[DAISY]!.harvests, 1);
  const gems = s.player.gems;
  assert.ok(dispatch(content, s, { type: 'claimJournal', cropId: DAISY }, T0 + 2 * MIN).ok);
  assert.equal(s.player.gems, gems + content.surprises.journal.gems[0]!);
  assert.deepEqual(dispatch(content, s, { type: 'claimJournal', cropId: DAISY }, T0 + 2 * MIN), { ok: false, error: 'nothing_to_claim' });
});

// ---------------------------------------------------------------- neighbours

test('hàng xóm: mô phỏng 8 giờ một lần hay từng 7 phút cho cùng kết quả', () => {
  const run = (stepMs: number) => {
    const s = newGame(content, {}, 11);
    s.inventory[TOMATO_ITEM] = 20;
    dispatch(content, s, { type: 'listItem', itemId: TOMATO_ITEM, qty: 20, price: 6 }, T0);
    for (let t = T0 + stepMs; t <= T0 + 8 * HOUR; t += stepMs) simulateNeighbors(content, s, t);
    simulateNeighbors(content, s, T0 + 8 * HOUR);
    return { n: s.neighbors, coins: s.player.coins, stall: s.stall, inv: s.inventory };
  };
  assert.deepEqual(run(8 * HOUR), run(7 * MIN));
});

test('hàng xóm mua hàng rẻ ở Sạp: người chơi nhận xu thật, hàng giảm, có thư báo; hàng quá đắt thì không ai mua', () => {
  const s = newGame(content, {}, 4);
  s.inventory[TOMATO_ITEM] = 30;
  const base = content.items.get(TOMATO_ITEM)!.sellPrice!;
  assert.ok(dispatch(content, s, { type: 'listItem', itemId: TOMATO_ITEM, qty: 15, price: base }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'listItem', itemId: TOMATO_ITEM, qty: 15, price: base * 3 }, T0).ok);
  const coins = s.player.coins;
  const events = simulateNeighbors(content, s, T0 + 24 * HOUR);
  const sold = events.filter((e) => e.type === 'stallSold');
  assert.ok(sold.length > 0, 'có người mua món giá rẻ');
  assert.ok(sold.every((e) => e.type === 'stallSold' && e.coins === e.qty * base), 'không ai mua món giá gấp 3');
  const earned = sold.reduce((a, e) => a + (e.type === 'stallSold' ? e.coins : 0), 0);
  const gifts = events.reduce((a, e) => a + (e.type === 'neighborGift' && e.kind === 'coins' ? e.amount : 0), 0);
  assert.equal(s.player.coins, coins + earned + gifts);
  assert.ok(s.notices.some((n) => n.text.includes('mua')));
  assert.ok(s.stall.some((l) => l.price === base * 3 && l.qty === 15));
});

test('cùng một hàng xóm, tình huống khác thì quyết định khác (có / không có hàng rẻ ở Sạp), luôn ghi lý do', () => {
  const trader = [...content.bots.values()].filter((b) => !b.id.startsWith('gen:')).sort((a, b) => b.traits.trader - a.traits.trader)[0]!;
  const kinds = (withListing: boolean) => {
    const s = newGame(content, {}, 21);
    s.neighbors = { [trader.id]: s.neighbors[trader.id]! }; // only this neighbour, so nobody else buys first
    if (withListing) {
      s.inventory[TOMATO_ITEM] = 30;
      dispatch(content, s, { type: 'listItem', itemId: TOMATO_ITEM, qty: 30, price: Math.max(1, Math.floor(content.items.get(TOMATO_ITEM)!.sellPrice! * 0.5)) }, T0);
    }
    const seen: string[] = [];
    for (let h = 1; h <= 12; h++) {
      simulateNeighbors(content, s, T0 + h * HOUR);
      const a = s.neighbors[trader.id]!.lastAction;
      if (a) {
        assert.ok(a.reason.length > 5, 'có lý do');
        seen.push(a.kind);
      }
    }
    return seen;
  };
  assert.ok(kinds(true).includes('shop'));
  assert.ok(!kinds(false).includes('shop'));
  assert.ok(valuation(content, trader, TOMATO_ITEM) > content.items.get(TOMATO_ITEM)!.sellPrice!);
});

test('vắng 60 ngày: hàng xóm vẫn được mô phỏng, nhanh (dưới 1 giây)', () => {
  const s = newGame(content);
  const before = { ...s.neighbors['base:bot.ba-tam']! };
  const t0 = performance.now();
  simulateNeighbors(content, s, T0 + 60 * 24 * HOUR);
  assert.ok(performance.now() - t0 < 1000);
  assert.ok(s.neighbors['base:bot.ba-tam']!.coins + s.neighbors['base:bot.ba-tam']!.gardenValue > before.coins + before.gardenValue);
});

test('Sạp: giá ngoài khoảng cho phép, quá số chỗ bị từ chối; gỡ hàng trả về kho', () => {
  const s = newGame(content);
  s.inventory[DAISY_ITEM] = 50;
  assert.deepEqual(dispatch(content, s, { type: 'listItem', itemId: DAISY_ITEM, qty: 5, price: 99 }, T0), { ok: false, error: 'bad_price' });
  assert.deepEqual(dispatch(content, s, { type: 'listItem', itemId: BUG, qty: 1, price: 1 }, T0), { ok: false, error: 'not_sellable' });
  for (let i = 0; i < content.neighbors.stallSlots; i++) assert.ok(dispatch(content, s, { type: 'listItem', itemId: DAISY_ITEM, qty: 1, price: 1 }, T0).ok);
  assert.deepEqual(dispatch(content, s, { type: 'listItem', itemId: DAISY_ITEM, qty: 1, price: 1 }, T0), { ok: false, error: 'stall_full' });
  const id = s.stall[0]!.id;
  assert.ok(dispatch(content, s, { type: 'cancelListing', listingId: id }, T0).ok);
  assert.equal(s.inventory[DAISY_ITEM], 50 - content.neighbors.stallSlots + 1);
});

test('save bản 5 lên bản 6: có bảng đơn, hàng xóm, Sổ Tay sau khi đối chiếu', () => {
  const s = newGame(content);
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>;
  for (const k of ['orders', 'journal', 'neighbors', 'stall', 'notices']) delete raw[k];
  delete raw.player.gems;
  const m = migrate(raw, 5) as Record<string, any>;
  assert.equal(m.saveVersion, SAVE_VERSION);
  const { state } = reconcile(m as any, content, 'local');
  assert.equal(state.orders.slots.length, content.orders.slots);
  // Named neighbours (generated ones of chỉ thị 12 B3 move in on the first update).
  assert.equal(Object.keys(state.neighbors).length, [...content.bots.keys()].filter((id) => !id.startsWith('gen:')).length);
  const ev: GameEvent[] = [];
  const r = dispatch(content, state, { type: 'tick' }, T0);
  if (r.ok) ev.push(...r.events);
  assert.equal(state.orders.slots.filter((x) => x.order).length, content.orders.slots);
});
