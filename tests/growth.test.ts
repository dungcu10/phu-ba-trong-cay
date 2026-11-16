import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { cropStatus, REGROW_FROM_STAGE } from '../src/systems/growth.ts';
import { DAISY, HOUR, loadBase, MIN, MINT, newGame, SEC, T0, TOMATO } from './helpers.ts';

const content = await loadBase();
const at = { floor: 0, slot: 0 };

test('cây đi qua đủ 5 giai đoạn theo thời gian và chín đúng hạn', () => {
  const s = newGame(content);
  assert.ok(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0).ok);
  const slot = s.floors[0]!.slots[0]!;
  const growMs = 60 * SEC * (1 - 0.03); // chậu cấp 1: tốc độ 3%
  const stages: number[] = [];
  for (let t = 0; t <= growMs; t += growMs / 8) stages.push(cropStatus(content, s, slot, T0 + t)!.stage);
  assert.deepEqual([...new Set(stages)], [0, 1, 2, 3, 4]);
  assert.equal(cropStatus(content, s, slot, T0 + growMs - 1)!.ripe, false);
  assert.equal(cropStatus(content, s, slot, T0 + growMs)!.ripe, true);
});

test('chưa chín thì không thu hoạch được; chín rồi thì thu đúng một lần', () => {
  const s = newGame(content);
  dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0);
  assert.deepEqual(dispatch(content, s, { type: 'harvest', ...at }, T0 + 30 * SEC), { ok: false, error: 'not_ripe' });
  const r = dispatch(content, s, { type: 'harvest', ...at }, T0 + 2 * MIN);
  assert.ok(r.ok);
  assert.deepEqual(dispatch(content, s, { type: 'harvest', ...at }, T0 + 2 * MIN), { ok: false, error: 'slot_empty' });
});

test('tưới giảm 10% thời gian còn lại và chỉ tưới một lần mỗi giai đoạn', () => {
  const s = newGame(content, { level: 3 });
  dispatch(content, s, { type: 'plant', cropId: MINT, ...at }, T0);
  const slot = s.floors[0]!.slots[0]!;
  const before = cropStatus(content, s, slot, T0)!;
  assert.equal(before.thirsty, true);
  assert.ok(dispatch(content, s, { type: 'water', ...at }, T0).ok);
  const after = cropStatus(content, s, slot, T0)!;
  assert.ok(Math.abs(after.remainingMs - before.remainingMs * 0.9) < 1);
  assert.deepEqual(dispatch(content, s, { type: 'water', ...at }, T0), { ok: false, error: 'not_thirsty' });
});

test('cây thu hoạch nhiều lần mọc lại từ giai đoạn "Lớn" rồi trống chậu sau lần cuối', () => {
  const s = newGame(content, { level: 2 });
  dispatch(content, s, { type: 'plant', cropId: TOMATO, ...at }, T0);
  const slot = s.floors[0]!.slots[0]!;
  const t1 = T0 + 10 * MIN;
  const r1 = dispatch(content, s, { type: 'harvest', ...at }, t1);
  assert.ok(r1.ok && r1.events[0]!.type === 'harvested' && !r1.events[0]!.cleared);
  assert.equal(cropStatus(content, s, slot, t1)!.stage, REGROW_FROM_STAGE);
  const r2 = dispatch(content, s, { type: 'harvest', ...at }, t1 + 10 * MIN);
  assert.ok(r2.ok && r2.events[0]!.type === 'harvested' && r2.events[0]!.cleared);
  assert.equal(slot.planting, null);
});

test('nâng cấp chậu làm cây lớn nhanh hơn', () => {
  const s = newGame(content, { level: 3, coins: 1000 });
  s.inventory['base:bug.ladybird'] = 10;
  dispatch(content, s, { type: 'plant', cropId: MINT, ...at }, T0);
  const slot = s.floors[0]!.slots[0]!;
  const before = cropStatus(content, s, slot, T0)!.cycleMs;
  assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: slot.potInstanceId }, T0).ok);
  assert.equal(s.pots[slot.potInstanceId]!.level, 2);
  assert.ok(cropStatus(content, s, slot, T0)!.cycleMs < before);
});

test('cây ngoài cấp hiện tại bị khóa; thiếu tiền không gieo được', () => {
  const s = newGame(content, { level: 1, coins: 0 });
  assert.deepEqual(dispatch(content, s, { type: 'plant', cropId: MINT, ...at }, T0), { ok: false, error: 'locked' });
  assert.deepEqual(dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0), { ok: false, error: 'not_enough_coins' });
  assert.equal(s.floors[0]!.slots[0]!.planting, null);
});

test('chạm liên tục không gieo trùng và không trừ tiền hai lần', () => {
  const s = newGame(content);
  const coins = s.player.coins;
  for (let i = 0; i < 20; i++) dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0);
  assert.equal(s.player.coins, coins - 1);
});

test('cây chín không bao giờ héo, dù để rất lâu', () => {
  const s = newGame(content);
  dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, T0);
  assert.ok(dispatch(content, s, { type: 'harvest', ...at }, T0 + 400 * HOUR).ok);
});
