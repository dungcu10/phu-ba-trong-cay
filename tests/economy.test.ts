import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { sellPrice, storageFree, xpToNextLevel } from '../src/systems/economy.ts';
import { BUG, DAISY, loadBase, MIN, newGame, SEC, T0 } from './helpers.ts';

const content = await loadBase();

test('bán nông sản: tiền tăng đúng bằng giá ngày × số lượng', () => {
  const s = newGame(content);
  const item = 'base:item.cotton-daisy';
  s.inventory[item] = 5;
  const price = sellPrice(content, s, item, T0)!;
  const coins = s.player.coins;
  const r = dispatch(content, s, { type: 'sell', itemId: item, qty: 3 }, T0);
  assert.ok(r.ok);
  assert.equal(s.player.coins, coins + price * 3);
  assert.equal(s.inventory[item], 2);
});

test('giá dao động trong ±5% và giống nhau trong cùng một ngày', () => {
  const s = newGame(content);
  const item = 'base:item.cloud-strawberry';
  for (let d = 0; d < 30; d++) {
    const p = sellPrice(content, s, item, T0 + d * 86_400_000)!;
    const base = content.items.get(item)!.sellPrice!;
    assert.ok(p >= Math.round(base * 0.95) && p <= Math.round(base * 1.05), `ngày ${d}: ${p}`);
  }
  assert.equal(sellPrice(content, s, item, T0), sellPrice(content, s, item, T0 + 60_000));
});

test('bán: số lượng sai, không đủ hàng, vật phẩm không bán được đều bị từ chối', () => {
  const s = newGame(content);
  s.inventory['base:item.cotton-daisy'] = 1;
  s.inventory[BUG] = 3;
  assert.deepEqual(dispatch(content, s, { type: 'sell', itemId: 'base:item.cotton-daisy', qty: 2 }, T0), { ok: false, error: 'not_enough_items' });
  assert.deepEqual(dispatch(content, s, { type: 'sell', itemId: 'base:item.cotton-daisy', qty: 0 }, T0), { ok: false, error: 'bad_quantity' });
  assert.deepEqual(dispatch(content, s, { type: 'sell', itemId: BUG, qty: 1 }, T0), { ok: false, error: 'not_sellable' });
});

test('kho đầy thì không thu hoạch, cây vẫn nằm chờ trên chậu', () => {
  const s = newGame(content);
  s.inventory['base:item.cotton-daisy'] = content.config.storageCapacity;
  assert.equal(storageFree(content, s), 0);
  dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0);
  assert.deepEqual(dispatch(content, s, { type: 'harvest', floor: 0, slot: 0 }, T0 + 5 * MIN), { ok: false, error: 'storage_full' });
  assert.notEqual(s.floors[0]!.slots[0]!.planting, null);
});

test('lên cấp: XP vượt ngưỡng thì tăng cấp, cộng thưởng xu, giữ XP dư', () => {
  const s = newGame(content);
  const need = xpToNextLevel(content, 1);
  s.player.xp = need - 1;
  const coins = s.player.coins;
  s.inventory = {};
  dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0);
  const r = dispatch(content, s, { type: 'harvest', floor: 0, slot: 0 }, T0 + 2 * MIN);
  assert.ok(r.ok && r.events.some((e) => e.type === 'levelUp' && e.level === 2));
  assert.equal(s.player.level, 2);
  assert.equal(s.player.xp, 1);
  assert.equal(s.player.coins, coins - content.crops.get(DAISY)!.seedPrice + content.config.levels.levelUpCoins);
});

test('người chơi mới đạt cấp 2 trong vòng 5 phút với 4 chậu Cúc Bông Gòn', () => {
  const s = newGame(content);
  let t = T0;
  while (s.player.level < 2 && t < T0 + 5 * MIN) {
    for (let i = 0; i < 4; i++) {
      const at = { floor: 0, slot: i };
      dispatch(content, s, { type: 'harvest', ...at }, t);
      dispatch(content, s, { type: 'plant', cropId: DAISY, ...at }, t);
    }
    for (const id of Object.keys(s.inventory)) {
      if (content.items.get(id)?.sellPrice) dispatch(content, s, { type: 'sell', itemId: id, qty: s.inventory[id]! }, t);
    }
    t += 10 * SEC;
  }
  assert.equal(s.player.level, 2, `cấp ${s.player.level} sau ${(t - T0) / 1000}s`);
  assert.ok(t - T0 <= 5 * MIN);
});

test('bắt Bọ Mây: có bọ mới bắt được, mỗi lần bắt bớt đúng 1 con; dùng bọ để nâng chậu', () => {
  const at = { floor: 0, slot: 0 };
  let total = 0;
  let s = newGame(content, { level: 3, coins: 500 }, 0);
  for (let entropy = 0; entropy < 10; entropy++) {
    s = newGame(content, { level: 3, coins: 500 }, entropy);
    dispatch(content, s, { type: 'plant', cropId: 'base:crop.cloud-mint', ...at }, T0);
    const slot = s.floors[0]!.slots[0]!;
    let caught = 0;
    for (let t = T0; t < T0 + 20 * MIN; t += 15 * SEC) {
      const st = cropStatus(content, s, slot, t);
      const r = dispatch(content, s, { type: 'catchBug', ...at }, t);
      assert.equal(r.ok, Boolean(st?.bug));
      if (r.ok) {
        caught += 1;
        const after = cropStatus(content, s, slot, t);
        assert.equal(after?.bug?.count ?? 0, st!.bug!.count - 1);
      }
    }
    assert.equal(s.inventory[BUG] ?? 0, caught);
    total += caught;
  }
  assert.ok(total >= 5, `10 vụ bạc hà chỉ có ${total} bọ`);
  const slot = s.floors[0]!.slots[0]!;
  s.inventory[BUG] = 2;
  assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: slot.potInstanceId }, T0).ok);
  assert.equal(s.inventory[BUG], undefined);
});

test('nâng chậu: thiếu bọ hoặc đã cấp tối đa thì bị từ chối, không trừ gì', () => {
  const s = newGame(content, { coins: 99999 });
  const pot = s.floors[0]!.slots[0]!.potInstanceId;
  assert.deepEqual(dispatch(content, s, { type: 'upgradePot', potInstanceId: pot }, T0), { ok: false, error: 'not_enough_items' });
  assert.equal(s.player.coins, 99999);
  s.inventory[BUG] = 1000;
  for (const id of content.materials.keys()) s.inventory[id] = 1000;
  s.player.level = 30;
  const def = content.pots.get(s.pots[pot]!.potId)!;
  for (let i = 1; i < def.openTo; i++) assert.ok(dispatch(content, s, { type: 'upgradePot', potInstanceId: pot }, T0).ok);
  // Levels past what this build opens are designed but locked; never past the last level.
  assert.deepEqual(dispatch(content, s, { type: 'upgradePot', potInstanceId: pot }, T0), { ok: false, error: 'level_not_open' });
});
