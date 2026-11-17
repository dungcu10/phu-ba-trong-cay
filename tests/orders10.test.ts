// Chỉ thị 10 § 3.6 (M6): balloon orders — the balloon flies off and pays when it comes back (exact
// while the game is closed), escorting birds, rare orders with a deadline and an extra item, orders
// with processed goods, more slots by level, neighbours chipping in once a day, nothing lost on reload.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, type GameEvent } from '../src/core/game.ts';
import { generateOrder, orderSlotsFor } from '../src/systems/orders.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import type { GameState } from '../src/core/state.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const base = await loadBase();
// The features are tested with their own numbers; the live values in orders.json are the economy's
// (extraSlots and rareItems stay empty until the CTO tunes them, GAME_SYSTEMS § 2).
const content = {
  ...base,
  orders: {
    ...base.orders,
    extraSlots: [{ level: 10, slots: 7 }, { level: 15, slots: 8 }, { level: 20, slots: 9 }],
    rareItems: ['base:mat.cloud-thread', 'base:mat.sky-dew'],
    rareHours: 24,
    goodsShare: 0.4,
  },
} as typeof base;
const FLIGHT = content.orders.refillSeconds * 1000;

/** A game with every order's items in stock. */
function stocked(level = 12, entropy = 3): GameState {
  const s = newGame(content, { level, coins: 1e6 }, entropy);
  dispatch(content, s, { type: 'tick' }, T0);
  for (const sl of s.orders.slots) for (const [id, q] of Object.entries(sl.order?.items ?? {})) s.inventory[id] = (s.inventory[id] ?? 0) + q;
  return s;
}

test('gửi đơn: hàng đi ngay, XP cộng ngay, xu về cùng khinh khí cầu (tắt game cũng đúng)', () => {
  const s = stocked();
  const order = s.orders.slots[0]!.order!;
  const coins = s.player.coins;
  const xp = s.player.xp + s.player.level * 1e9;
  const r = dispatch(content, s, { type: 'deliverOrder', slot: 0 }, T0);
  assert.ok(r.ok);
  assert.equal(s.player.coins, coins, 'trả xu ngay khi gửi');
  assert.ok(s.player.xp + s.player.level * 1e9 > xp, 'XP chưa cộng khi gửi');
  assert.ok(s.orders.slots[0]!.flight);
  dispatch(content, s, { type: 'tick' }, T0 + FLIGHT - 1);
  assert.equal(s.player.coins, coins);
  const back = dispatch(content, s, { type: 'tick' }, T0 + 8 * HOUR);
  const ev = back.ok ? back.events.find((e) => e.type === 'balloonBack') : undefined;
  assert.ok(ev && ev.type === 'balloonBack');
  assert.equal(ev.coins, order.coins);
  assert.equal(ev.xp, 0, 'XP đã cộng lúc gửi');
  assert.ok(s.player.coins >= coins + order.coins);
  assert.equal(s.orders.slots[0]!.flight ?? null, null);
  assert.ok(s.orders.slots[0]!.order, 'đơn mới tới');
  // Paid once only: no second balloonBack for slot 0.
  const again = dispatch(content, s, { type: 'tick' }, T0 + 9 * HOUR);
  assert.ok(again.ok && !again.events.some((e) => e.type === 'balloonBack' && e.slot === 0));
});

test('chim dẫn đường: mở ở cấp 11, đi cùng tới khi về (không bắt sâu), cộng thưởng theo loài', () => {
  const low = stocked(10);
  dispatch(content, low, { type: 'obtainBird', species: 'base:bird.sky-sparrow', how: 'rent' }, T0);
  assert.deepEqual(dispatch(content, low, { type: 'deliverOrder', slot: 0, birdId: low.birds[0]!.id }, T0), { ok: false, error: 'level_not_open' });
  const s = stocked(12);
  dispatch(content, s, { type: 'obtainBird', species: 'base:bird.sky-sparrow', how: 'rent' }, T0);
  const bird = s.birds[0]!;
  const order = s.orders.slots[0]!.order!;
  assert.ok(dispatch(content, s, { type: 'deliverOrder', slot: 0, birdId: bird.id }, T0).ok);
  assert.equal(bird.escort?.until, T0 + FLIGHT);
  assert.deepEqual(dispatch(content, s, { type: 'deliverOrder', slot: 1, birdId: bird.id }, T0), { ok: false, error: 'bird_busy' });
  const back = dispatch(content, s, { type: 'tick' }, T0 + FLIGHT);
  const ev = back.ok ? back.events.find((e) => e.type === 'balloonBack' && e.slot === 0) : undefined;
  const bonus = content.birds!.get('base:bird.sky-sparrow')!.escort.coins;
  assert.ok(ev && ev.type === 'balloonBack');
  assert.equal(ev.coins, Math.round(order.coins * (1 + bonus)));
  assert.equal(ev.bird, 'base:bird.sky-sparrow');
  dispatch(content, s, { type: 'tick' }, T0 + FLIGHT + MIN);
  assert.equal(s.birds[0]!.escort, null, 'chim về lại cành');
});

test('đơn hiếm: hết hạn sau rareHours thì đi, có vật phẩm thưởng thêm', () => {
  let found: { s: GameState; i: number } | null = null;
  for (let e = 0; e < 300 && !found; e++) {
    const s = newGame(content, { level: 12, coins: 1e6 }, e);
    dispatch(content, s, { type: 'tick' }, T0);
    const i = s.orders.slots.findIndex((x) => x.order?.rare);
    if (i >= 0) found = { s, i };
  }
  assert.ok(found, 'không gặp đơn hiếm');
  const { s, i } = found!;
  const o = s.orders.slots[i]!.order!;
  assert.equal(o.expiresAt, T0 + (content.orders.rareHours ?? 0) * HOUR);
  assert.ok(o.bonusItem && content.orders.rareItems!.includes(o.bonusItem));
  const r = dispatch(content, s, { type: 'tick' }, o.expiresAt!);
  assert.ok(r.ok && r.events.some((e: GameEvent) => e.type === 'rareOrderLeft'));
  assert.notEqual(s.orders.slots[i]!.order?.id, o.id);
});

test('đơn có hàng chế biến khi đã mở Xưởng (khoảng goodsShare), chưa mở thì không có', () => {
  const count = (level: number) => {
    let withGood = 0;
    const s = newGame(content, { level }, 9);
    for (let k = 0; k < 400; k++) if (Object.keys(generateOrder(content, s).items).some((id) => content.goods?.has(id))) withGood++;
    return withGood / 400;
  };
  assert.equal(count(5), 0);
  const share = count(12);
  assert.ok(Math.abs(share - (content.orders.goodsShare ?? 0)) < 0.08, `tỉ lệ ${share}`);
});

test('thêm ô đơn theo cấp (6 → 9)', () => {
  assert.equal(orderSlotsFor(content, 1), content.orders.slots);
  const s = newGame(content, { level: 25 }, 2);
  dispatch(content, s, { type: 'tick' }, T0);
  assert.equal(s.orders.slots.length, 9);
});

test('nhờ hàng xóm góp hàng: mỗi ngày 1 lần, hàng góp tính vào đơn', () => {
  const s = newGame(content, { level: 20, coins: 1e6 }, 4);
  dispatch(content, s, { type: 'tick' }, T0);
  for (const b of Object.values(s.neighbors)) {
    b.level = 40;
    b.friendship = 30;
  }
  const r = dispatch(content, s, { type: 'askNeighbors', slot: 0 }, T0);
  assert.ok(r.ok);
  const help = r.ok ? r.events.find((e) => e.type === 'neighborsChipped') : undefined;
  assert.ok(help && help.type === 'neighborsChipped' && help.help.length > 0);
  assert.deepEqual(dispatch(content, s, { type: 'askNeighbors', slot: 1 }, T0 + HOUR), { ok: false, error: 'help_used' });
  const o = s.orders.slots[0]!.order!;
  // Whatever is still missing after the help, give it; the order goes out with the help counted.
  for (const [id, q] of Object.entries(o.items)) s.inventory[id] = Math.max(0, q - (o.given?.[id] ?? 0));
  assert.ok(dispatch(content, s, { type: 'deliverOrder', slot: 0 }, T0 + HOUR).ok);
});

test('mở lại game: khinh khí cầu đang bay và ô đơn thêm theo cấp không mất', () => {
  const s = stocked(25, 6);
  assert.equal(s.orders.slots.length, 9);
  assert.ok(dispatch(content, s, { type: 'deliverOrder', slot: 8 }, T0).ok);
  const flight = s.orders.slots[8]!.flight!;
  const r = reconcile(JSON.parse(JSON.stringify(s)), content, 'local');
  assert.equal(r.state.orders.slots.length, 9);
  assert.deepEqual(r.state.orders.slots[8]!.flight, flight);
});
