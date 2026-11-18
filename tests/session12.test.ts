// Chỉ thị 12 B1: Lộc Phiên (3 lần/ngày, cách nhau 2 giờ, quà tăng dần) và Hẹn giờ.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { luckStatus } from '../src/systems/sessionLuck.ts';
import { upcoming } from '../src/systems/timers.ts';
import { stealTurns } from '../src/systems/social.ts';
import { HOUR, loadBase, MIN, newGame, T0, TOMATO } from './helpers.ts';

const content = await loadBase();

test('Lộc Phiên: tối đa 3 lần mỗi ngày, cách nhau ít nhất 2 giờ; xu → đặt lại chợ miễn phí → lượt trộm', () => {
  const s = newGame(content, { level: 20 });
  dispatch(content, s, { type: 'tick' }, T0);
  const coins = s.player.coins;
  const a = dispatch(content, s, { type: 'claimSessionLuck' }, T0 + MIN);
  assert.ok(a.ok && a.events.some((e) => e.type === 'luckClaimed' && e.coins > 0));
  assert.ok(s.player.coins > coins);
  assert.deepEqual(dispatch(content, s, { type: 'claimSessionLuck' }, T0 + HOUR), { ok: false, error: 'nothing_to_claim' });
  const b = dispatch(content, s, { type: 'claimSessionLuck' }, T0 + 2 * HOUR + MIN);
  assert.ok(b.ok && b.events.some((e) => e.type === 'luckClaimed' && (e.bazaarReroll > 0 || e.gems > 0)));
  if (s.bazaar) {
    const paid = s.bazaar.rerolls;
    const c0 = s.player.coins;
    assert.ok(dispatch(content, s, { type: 'rerollBazaar' } as never, T0 + 2 * HOUR + 2 * MIN).ok);
    assert.equal(s.bazaar.rerolls, paid, 'lượt miễn phí không tính vào giá');
    assert.ok(s.player.coins >= c0 - 0, 'không tốn xu');
  }
  s.social.steal.tokens = 2;
  s.social.steal.at = T0 + 4 * HOUR;
  const c = dispatch(content, s, { type: 'claimSessionLuck' }, T0 + 4 * HOUR + 3 * MIN);
  assert.ok(c.ok && c.events.some((e) => e.type === 'luckClaimed' && e.stealTurn === 1));
  assert.equal(stealTurns(content, s, T0 + 4 * HOUR + 3 * MIN), 3);
  assert.equal(luckStatus(content, s, T0 + 8 * HOUR)!.nextAt, null);
  assert.deepEqual(dispatch(content, s, { type: 'claimSessionLuck' }, T0 + 8 * HOUR), { ok: false, error: 'nothing_to_claim' });
  // Next day: again.
  assert.ok(dispatch(content, s, { type: 'claimSessionLuck' }, T0 + 30 * HOUR).ok);
});

test('Hẹn giờ: liệt kê việc sắp xong theo thứ tự thời gian (tầng chín, lượt trộm, Lộc Phiên…)', () => {
  const s = newGame(content, { level: 12, coins: 1e6 });
  dispatch(content, s, { type: 'tick' }, T0);
  s.floors[0]!.slots.forEach((_, i) => dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId: TOMATO }, T0));
  s.social.steal.tokens = 1;
  s.social.steal.at = T0;
  dispatch(content, s, { type: 'claimSessionLuck' }, T0);
  const list = upcoming(content, s, T0 + MIN);
  assert.ok(list.some((t) => t.kind === 'crop' && t.text.startsWith('Tầng 1 chín')));
  assert.ok(list.some((t) => t.kind === 'steal'));
  assert.ok(list.some((t) => t.kind === 'luck'));
  for (let i = 1; i < list.length; i++) assert.ok(list[i]!.at >= list[i - 1]!.at);
  assert.ok(list.every((t) => t.at > T0));
});
