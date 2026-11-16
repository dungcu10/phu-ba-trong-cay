import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, dispatch } from '../src/core/game.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { serialize, deserialize } from '../src/persistence/serializer.ts';
import { HOUR, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();

test('tắt game 8 giờ: mở lại thấy cây đã chín đúng, tính trong dưới 1 giây', () => {
  const s = newGame(content, { level: 9, coins: 1000 });
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.golden-gerbera', floor: 0, slot: 0 }, T0);
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 0, slot: 1 }, T0);
  const saved = serialize(s, T0);

  const started = performance.now();
  const { state } = deserialize(saved);
  const now = advanceTime(state, T0 + 8 * HOUR);
  const statuses = state.floors[0]!.slots.map((sl) => cropStatus(content, state, sl, now));
  const elapsed = performance.now() - started;

  assert.equal(statuses[0]!.ripe, true);
  assert.equal(statuses[1]!.ripe, true);
  assert.ok(elapsed < 1000, `mất ${elapsed} ms`);
});

test('tắt game giữa chừng: tiến độ đúng bằng thời gian thật đã trôi', () => {
  const s = newGame(content, { level: 4, coins: 100 });
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.sky-carrot', floor: 0, slot: 0 }, T0);
  const { state } = deserialize(serialize(s, T0));
  const st = cropStatus(content, state, state.floors[0]!.slots[0]!, T0 + 15 * MIN)!;
  const expected = (15 * MIN) / (30 * MIN * 0.97);
  assert.ok(Math.abs(st.progress - expected) < 1e-9);
});

test('tính một lần hay chia nhỏ cho cùng kết quả (bọ, sản lượng tất định)', () => {
  const play = (stepMs: number) => {
    const s = newGame(content, { level: 3, coins: 500 }, 7);
    const at = { floor: 0, slot: 0 };
    dispatch(content, s, { type: 'plant', cropId: 'base:crop.cloud-mint', ...at }, T0);
    const seen: string[] = [];
    for (let t = T0; t <= T0 + 3 * HOUR; t += stepMs) {
      const st = cropStatus(content, s, s.floors[0]!.slots[0]!, t);
      if (st?.bug) seen.push(`${st.bug.stage}@${Math.floor(st.bug.leavesAt / 1000)}`);
    }
    dispatch(content, s, { type: 'harvest', ...at }, T0 + 3 * HOUR);
    return { bugs: [...new Set(seen)], inv: JSON.stringify(s.inventory) };
  };
  assert.deepEqual(play(5_000), play(1_000));
});

test('lùi giờ thiết bị: thời gian game không lùi, không thu hoạch được sớm hơn', () => {
  const s = newGame(content);
  const at = { floor: 0, slot: 0 };
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.cotton-daisy', ...at }, T0 + 10 * MIN);
  // Đồng hồ bị chỉnh lùi 1 giờ rồi chỉnh tới lại: cây không chín trước thời điểm thật.
  assert.equal(advanceTime(s, T0 - HOUR), T0 + 10 * MIN);
  assert.deepEqual(dispatch(content, s, { type: 'harvest', ...at }, T0 - HOUR), { ok: false, error: 'not_ripe' });
  assert.ok(dispatch(content, s, { type: 'harvest', ...at }, T0 + 12 * MIN).ok);
});

test('lùi giờ không cho thu hoạch hai lần cùng một vụ', () => {
  const s = newGame(content, { level: 2 });
  const at = { floor: 0, slot: 0 };
  dispatch(content, s, { type: 'plant', cropId: 'base:crop.cherry-tomato', ...at }, T0);
  assert.ok(dispatch(content, s, { type: 'harvest', ...at }, T0 + 10 * MIN).ok);
  assert.deepEqual(dispatch(content, s, { type: 'harvest', ...at }, T0), { ok: false, error: 'not_ripe' });
});
