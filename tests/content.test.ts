import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContentError } from '../src/core/content.ts';
import { dispatch } from '../src/core/game.ts';
import { createNewGame } from '../src/core/state.ts';
import { buildContentPack, loadBase, MIN, readRaw, T0 } from './helpers.ts';

test('gói nội dung gốc hợp lệ: 3 tầng × 6–10 chậu, 7 loại chậu, 6 giống cây, 1 loại Bọ Mây', async () => {
  const c = await loadBase();
  assert.equal(c.floors.size, 3);
  for (const f of c.floorList) {
    assert.equal(f.slotCount, 6);
    assert.equal(f.maxSlots, 10);
    assert.equal(f.stars.length, 3);
  }
  assert.equal(c.pots.size, 7);
  assert.deepEqual([...new Set(c.potList.map((p) => p.rarity))].sort(), ['common', 'epic', 'good', 'legendary', 'rare']);
  assert.equal(c.crops.size, 6);
  assert.equal(c.bugs.size, 1);
  for (const crop of c.cropList) assert.ok(crop.stages >= 4, `${crop.id} phải có >= 4 giai đoạn`);
});

test('thêm một giống cây mới chỉ cần thêm dữ liệu, không sửa code', async () => {
  const raw = await readRaw();
  (raw.crops as unknown[]).push({
    id: 'test:crop.moon-melon',
    name: { vi: 'Dưa Trăng' },
    family: 'fruit',
    unlockLevel: 1,
    seedPrice: 3,
    growSeconds: 120,
    regrowSeconds: 60,
    harvests: 2,
    yield: 2,
    sellPrice: 5,
    xp: 3,
    stages: 5,
    produce: { id: 'test:item.moon-melon', name: { vi: 'Dưa Trăng' } },
    sprite: 'crops/moon-melon',
  });
  const c = buildContentPack(raw);
  const s = createNewGame(c, T0, 1);
  const at = { floor: 0, slot: 0 };
  assert.ok(dispatch(c, s, { type: 'plant', cropId: 'test:crop.moon-melon', ...at }, T0).ok);
  assert.ok(dispatch(c, s, { type: 'harvest', ...at }, T0 + 3 * MIN).ok);
  assert.ok(dispatch(c, s, { type: 'sell', itemId: 'test:item.moon-melon', qty: s.inventory['test:item.moon-melon']! }, T0 + 3 * MIN).ok);
});

test('dữ liệu sai (thiếu trường, trùng id, tham chiếu hỏng) bị báo lỗi đầy đủ', async () => {
  const raw = await readRaw();
  const crops = raw.crops as Array<Record<string, unknown>>;
  crops.push({ ...crops[0]!, produce: { id: 'x:item.y', name: { vi: 'y' } } });
  crops[1]!.growSeconds = 'nhanh';
  (raw.floors as Array<Record<string, unknown>>)[0]!.startingPot = 'khong:co';
  try {
    buildContentPack(raw);
    assert.fail('phải báo lỗi');
  } catch (e) {
    assert.ok(e instanceof ContentError);
    const text = e.problems.join('\n');
    assert.match(text, /trùng id/);
    assert.match(text, /growSeconds/);
    assert.match(text, /không có chậu/);
  }
});
