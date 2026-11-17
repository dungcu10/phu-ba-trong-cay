// Chỉ thị 12 B6.3 (luồng tính năng): repeat sinks for bugs — sell spare bugs to a BOT trader at a
// low price (market reference value or one by rarity × factor). Xưởng batches using worker bugs are
// tested in workshop10.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { bugTraderPrice } from '../src/systems/neighbors.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const LADY = 'base:bug.ladybird';

test('giá thương lái: theo giá tham chiếu (hoặc theo độ hiếm) × hệ số; vật phẩm không phải bọ thì không bán ở đây', () => {
  const t = content.neighbors.market.bugTrader!;
  assert.equal(bugTraderPrice(content, LADY), Math.floor((content.neighbors.market.values[LADY] ?? t.rarityValue.common!) * t.factor));
  for (const b of content.bugList) assert.ok((bugTraderPrice(content, b.id) ?? 0) > 0, `${b.id} chưa có giá`);
  assert.equal(bugTraderPrice(content, 'base:item.cotton-daisy'), null);
});

test('bán bọ: trừ bọ, cộng xu; không bán quá số đang có', () => {
  const s = newGame(content, {}, 3);
  s.inventory[LADY] = 10;
  const coins = s.player.coins;
  assert.deepEqual(dispatch(content, s, { type: 'sellBugs', itemId: LADY, qty: 11 }, T0), { ok: false, error: 'not_enough_items' });
  const r = dispatch(content, s, { type: 'sellBugs', itemId: LADY, qty: 4 }, T0);
  assert.ok(r.ok);
  assert.equal(s.inventory[LADY], 6);
  assert.equal(s.player.coins - coins >= bugTraderPrice(content, LADY)! * 4, true);
  assert.deepEqual(dispatch(content, s, { type: 'sellBugs', itemId: 'base:item.cotton-daisy', qty: 1 }, T0), { ok: false, error: 'not_sellable' });
});
