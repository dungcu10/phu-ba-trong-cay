// Chỉ thị 10 § 3.5 (M6): Xưởng Bọ — jobs run one after another, keep running while the game is closed,
// goods go to storage (wait in the machine when it is full), stars make a machine faster, value cap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { jobMs } from '../src/systems/workshop.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const R = 'base:recipe.jam-pot.cloud-strawberry';
const STRAW = 'base:item.cloud-strawberry';
const JAM = 'base:good.jam.cloud-strawberry';
const POT = 'base:machine.jam-pot';

const WORKER = content.machines!.get(POT)!.worker;

function game(level = 20) {
  const s = newGame(content, { level, coins: 1e6 }, 5);
  s.inventory[STRAW] = 40;
  s.inventory[WORKER] = 20;
  return s;
}

test('mỗi mẻ tốn bọ thợ của máy (B6: chỗ tiêu bọ lặp lại); thiếu bọ thợ thì không làm được', () => {
  const s = game();
  s.inventory[WORKER] = 0;
  assert.deepEqual(dispatch(content, s, { type: 'startJob', recipeId: R }, T0), { ok: false, error: 'not_enough_items' });
  s.inventory[WORKER] = 3;
  assert.ok(dispatch(content, s, { type: 'startJob', recipeId: R }, T0).ok);
  assert.equal(s.inventory[WORKER], 3 - (content.recipes!.get(R)!.recipe.workerBugs ?? 1));
});

test('giá hàng chế biến không quá 1,6 lần nông sản đầu vào; mọi công thức có thật', () => {
  assert.ok(content.recipes && content.recipes.size >= 4);
  for (const { recipe } of content.recipes.values()) {
    const out = content.items.get(recipe.output)!;
    const inValue = Object.entries(recipe.inputs).reduce((a, [id, q]) => a + (content.items.get(id)!.sellPrice ?? 0) * q, 0);
    if (out.sellPrice && inValue > 0) assert.ok(out.sellPrice <= inValue * 1.6, recipe.id);
  }
});

test('làm hàng: lấy nông sản ngay, thành phẩm vào kho khi xong; chưa đủ cấp thì không làm được', () => {
  const low = game(5);
  assert.deepEqual(dispatch(content, low, { type: 'startJob', recipeId: R }, T0), { ok: false, error: 'locked' });
  const s = game();
  assert.ok(dispatch(content, s, { type: 'startJob', recipeId: R }, T0).ok);
  assert.equal(s.inventory[STRAW], 36);
  const ms = jobMs(content, content.recipes!.get(R)!.recipe, 1);
  dispatch(content, s, { type: 'tick' }, T0 + ms - 1);
  assert.equal(s.inventory[JAM] ?? 0, 0);
  const r = dispatch(content, s, { type: 'tick' }, T0 + ms);
  assert.equal(s.inventory[JAM], 1);
  assert.ok(r.ok && r.events.some((e) => e.type === 'goodsMade'));
});

test('hàng chờ 2 khe chạy nối tiếp; khe thứ 3 phải mua bằng xu', () => {
  const s = game();
  const ms = jobMs(content, content.recipes!.get(R)!.recipe, 1);
  assert.ok(dispatch(content, s, { type: 'startJob', recipeId: R }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'startJob', recipeId: R }, T0).ok);
  assert.deepEqual(dispatch(content, s, { type: 'startJob', recipeId: R }, T0), { ok: false, error: 'queue_full' });
  assert.equal(s.workshop[POT]!.queue[1]!.endsAt, T0 + 2 * ms);
  assert.ok(dispatch(content, s, { type: 'buyMachineSlot', machineId: POT }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'startJob', recipeId: R }, T0).ok);
  assert.equal(s.workshop[POT]!.queue[2]!.endsAt, T0 + 3 * ms);
});

test('tắt game: máy vẫn chạy; mở lại sau 8 giờ khớp chơi liên tục', () => {
  const a = game();
  const b = game();
  for (const s of [a, b]) {
    dispatch(content, s, { type: 'buyMachineSlot', machineId: POT }, T0);
    for (let k = 0; k < 3; k++) dispatch(content, s, { type: 'startJob', recipeId: R }, T0);
  }
  dispatch(content, a, { type: 'tick' }, T0 + 8 * HOUR);
  for (let t = T0 + 7 * MIN; t <= T0 + 8 * HOUR; t += 7 * MIN) dispatch(content, b, { type: 'tick' }, t);
  dispatch(content, b, { type: 'tick' }, T0 + 8 * HOUR);
  assert.equal(a.inventory[JAM], 3);
  assert.deepEqual(a.workshop, b.workshop);
  assert.equal(a.inventory[JAM], b.inventory[JAM]);
});

test('kho đầy: thành phẩm chờ trong máy, không mất; có chỗ thì vào kho', () => {
  const s = game();
  dispatch(content, s, { type: 'startJob', recipeId: R }, T0);
  // Fill the produce storage.
  const cap = 10_000;
  s.inventory['base:item.cotton-daisy'] = cap;
  dispatch(content, s, { type: 'tick' }, T0 + 4 * HOUR);
  assert.equal(s.inventory[JAM] ?? 0, 0);
  assert.equal(s.workshop[POT]!.queue.length, 1);
  delete s.inventory['base:item.cotton-daisy'];
  dispatch(content, s, { type: 'tick' }, T0 + 4 * HOUR + MIN);
  assert.equal(s.inventory[JAM], 1);
  assert.equal(s.workshop[POT]!.queue.length, 0);
});

test('nâng sao bằng bọ thợ + xu; mỗi sao nhanh hơn 5%', () => {
  const s = game();
  const worker = WORKER;
  s.inventory[worker] = 0;
  assert.deepEqual(dispatch(content, s, { type: 'upgradeMachine', machineId: POT }, T0), { ok: false, error: 'not_enough_items' });
  s.inventory[worker] = 5;
  assert.ok(dispatch(content, s, { type: 'upgradeMachine', machineId: POT }, T0).ok);
  assert.equal(s.workshop[POT]!.stars, 2);
  assert.equal(s.inventory[worker] ?? 0, 0);
  const recipe = content.recipes!.get(R)!.recipe;
  assert.equal(jobMs(content, recipe, 2), Math.round(jobMs(content, recipe, 1) * 0.95));
});
