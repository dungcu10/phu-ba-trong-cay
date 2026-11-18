// Chỉ thị 07: Chợ Mây (buying from neighbours' stalls) and 40 Phú Bà on the board.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import type { GameState } from '../src/core/state.ts';
import { sellPrice } from '../src/systems/economy.ts';
import { localDay } from '../src/systems/missions.ts';
import { askingPrice, playerPrice, rankings, simulateNeighbors } from '../src/systems/neighbors.ts';
import { migrate } from '../src/persistence/migrations.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { bestOf, HOUR, loadBase, newGame, PERF_SLACK, T0 } from './helpers.ts';

const content = await loadBase();
const DAY = 24 * HOUR;
const listings = (s: GameState) =>
  Object.entries(s.neighbors).flatMap(([botId, b]) => b.stall.map((l) => ({ botId, ...l })));

/** A game where neighbours have had a day to fill their stalls. */
function marketGame(entropy = 7): GameState {
  const s = newGame(content, { level: 12, coins: 500_000 }, entropy);
  simulateNeighbors(content, s, T0 + DAY);
  return s;
}

test('có 40 Phú Bà, id và tên không trùng, mỗi người có biệt danh; có vài đại gia cấp cao', () => {
  const bots = [...content.bots.values()];
  assert.equal(bots.length, 40);
  assert.equal(new Set(bots.map((b) => b.name.vi)).size, 40);
  for (const b of bots) assert.ok(b.title?.vi, `${b.id} thiếu biệt danh`);
  assert.ok(bots.filter((b) => b.startLevel >= 25).length >= 4, 'ít nhất 4 đại gia đầu bảng');
});

test('sau một ngày, hàng xóm bày hàng; không bao giờ bày chậu hay ngọc; mỗi sạp ≤ 4 món', () => {
  const s = marketGame();
  const all = listings(s);
  assert.ok(all.length >= 20, `chợ phải có hàng (đang có ${all.length})`);
  for (const b of Object.values(s.neighbors)) assert.ok(b.stall.length <= content.neighbors.market.perSession);
  for (const l of all) {
    assert.ok(content.items.has(l.itemId), l.itemId);
    assert.ok(!l.itemId.includes(':pot.') && !l.itemId.includes('gem'), `không bán ${l.itemId}`);
    assert.ok(l.qty >= 1 && l.qty <= content.neighbors.market.maxQty);
  }
});

test('không có vòng mua–bán ra lãi: giá ở chợ luôn > giá Rương mua lại cao nhất (kể cả dao động ngày)', () => {
  const s = marketGame(11);
  const amp = content.config.market.dailyPriceVariation;
  for (const bot of content.bots.values()) {
    for (const item of content.items.values()) {
      if (item.sellPrice === null) continue;
      const ask = askingPrice(content, bot, item.id);
      assert.ok(ask > Math.round(item.sellPrice * (1 + amp)), `${bot.id} bán ${item.id} giá ${ask}`);
    }
  }
  for (let d = 0; d < 30; d++) {
    for (const l of listings(s)) {
      const back = sellPrice(content, s, l.itemId, T0 + d * DAY);
      if (back !== null) assert.ok(playerPrice(content, s, l) > back);
    }
  }
});

test('mua thành công: trừ xu đúng giá, hàng vào Rương, hàng xóm nhận xu và thêm thân thiết', () => {
  const s = marketGame(3);
  const l = listings(s).find((x) => content.items.get(x.itemId)?.sellPrice !== null)!;
  const bot = s.neighbors[l.botId]!;
  const coins = s.player.coins;
  const botCoins = bot.coins;
  const friend = bot.friendship;
  const have = s.inventory[l.itemId] ?? 0;
  const price = playerPrice(content, s, l);
  const r = dispatch(content, s, { type: 'buyFromNeighbor', botId: l.botId, itemId: l.itemId, qty: 1 }, T0 + DAY);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(s.player.coins, coins - price);
  assert.equal(bot.coins, botCoins + price);
  assert.equal(bot.friendship, friend + content.neighbors.market.friendship);
  assert.equal(s.inventory[l.itemId], have + 1);
});

test('nông sản chưa mở khóa đắt gấp 1,6', () => {
  const s = newGame(content, { level: 1 }, 5);
  const l = { itemId: 'base:item.golden-gerbera', qty: 1, price: 200 };
  assert.equal(playerPrice(content, s, l), Math.ceil(200 * content.neighbors.market.lockedMarkup));
  s.player.level = 30;
  assert.equal(playerPrice(content, s, l), 200);
});

test('giới hạn 20 lượt mua mỗi ngày, sang ngày mới được mua tiếp', () => {
  const s = marketGame(5);
  const at = T0 + DAY;
  const limit = content.neighbors.market.buysPerDay;
  let ok = 0;
  for (const l of listings(s)) {
    for (let i = 0; i < l.qty && ok < limit; i++) {
      const r = dispatch(content, s, { type: 'buyFromNeighbor', botId: l.botId, itemId: l.itemId, qty: 1 }, at);
      if (r.ok) ok += 1;
    }
  }
  assert.equal(ok, limit);
  const next = listings(s)[0]!;
  const blocked = dispatch(content, s, { type: 'buyFromNeighbor', botId: next.botId, itemId: next.itemId, qty: 1 }, at);
  assert.deepEqual(blocked, { ok: false, error: 'market_limit' });
  assert.equal(s.market.day, localDay(content, at));
  simulateNeighbors(content, s, at + DAY);
  const again = listings(s)[0]!;
  assert.ok(dispatch(content, s, { type: 'buyFromNeighbor', botId: again.botId, itemId: again.itemId, qty: 1 }, at + DAY).ok);
});

test('Rương đầy thì không mua được nông sản, xu không bị trừ; thiếu xu cũng không mua được', () => {
  const s = marketGame(9);
  const l = listings(s).find((x) => content.items.get(x.itemId)?.countsTowardStorage)!;
  s.inventory['base:item.cotton-daisy'] = 100_000;
  const coins = s.player.coins;
  assert.deepEqual(dispatch(content, s, { type: 'buyFromNeighbor', botId: l.botId, itemId: l.itemId, qty: 1 }, T0 + DAY), { ok: false, error: 'storage_full' });
  assert.equal(s.player.coins, coins);
  delete s.inventory['base:item.cotton-daisy'];
  s.player.coins = 0;
  assert.deepEqual(dispatch(content, s, { type: 'buyFromNeighbor', botId: l.botId, itemId: l.itemId, qty: 1 }, T0 + DAY), { ok: false, error: 'not_enough_coins' });
});

test('chợ chạy theo thời gian: giả lập một lần 8 giờ và từng 10 phút cho cùng kết quả', () => {
  const a = newGame(content, { level: 12 }, 21);
  const b = newGame(content, { level: 12 }, 21);
  simulateNeighbors(content, a, T0 + 8 * HOUR);
  for (let t = 10; t <= 8 * 60; t += 10) simulateNeighbors(content, b, T0 + t * 60_000);
  assert.deepEqual(a.neighbors, b.neighbors);
});

test('40 Phú Bà, 7 ngày offline: tính xong nhanh (mục tiêu < 50 ms trên iPad; ngưỡng test 400 ms, máy CI ×3)', () => {
  const ms = bestOf(3, (k) => simulateNeighbors(content, newGame(content, { level: 12 }, 33 + k + 1), T0 + 7 * DAY));
  console.log(`  40 Phú Bà × 7 ngày: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 400 * PERF_SLACK, `${ms} ms`);
});

test('save cũ (bản 10, 8 hàng xóm) lên bản 11: giữ tình thân, thêm hàng xóm mới, sạp rỗng', () => {
  const old = newGame(content, { level: 9 }, 2) as unknown as Record<string, any>;
  const keep = Object.keys(old.neighbors).slice(0, 8);
  old.neighbors = Object.fromEntries(keep.map((id) => [id, { ...old.neighbors[id], friendship: 7 }]));
  for (const b of Object.values(old.neighbors) as any[]) delete b.stall;
  delete old.market;
  delete old.ranks;
  old.saveVersion = 10;
  const migrated = migrate(old, 10) as GameState;
  const s = reconcile(migrated, content, 'local').state;
  assert.equal(Object.keys(s.neighbors).length, 40);
  for (const id of keep) {
    assert.equal(s.neighbors[id]!.friendship, 7);
    assert.deepEqual(s.neighbors[id]!.stall, []);
  }
  assert.deepEqual(s.market, { day: -1, buys: 0 });
});

test('bảng Phú Bà: đủ 41 người (40 + bạn), xếp theo tài sản; ảnh hạng hôm qua để hiện mũi tên', () => {
  const s = newGame(content, { level: 5 }, 4);
  dispatch(content, s, { type: 'tick' }, T0);
  const r = rankings(content, s);
  assert.equal(r.length, 41);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1]!.wealth >= r[i]!.wealth);
  assert.equal(Object.keys(s.ranks.prev).length, 41);
  assert.equal(s.ranks.day, localDay(content, T0));
});
