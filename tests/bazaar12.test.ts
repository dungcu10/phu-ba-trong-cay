// Chỉ thị 12 TỔNG B2 + A3: the Sạp Săn Hàng (8 slots by rarity, free refresh every 4 h, paid reroll
// U × 0.15 × 1.5^n, Vận May pity at 10 / 40, "đồ đang thiếu" first) and level-scaled coin sinks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { loadContentPack, type ContentPack } from '../src/core/content.ts';
import { ensureBazaar, rerollCost, wantedItems } from '../src/systems/bazaar.ts';
import { floorUnlockCost } from '../src/systems/coinSinks.ts';
import { castRecipe } from '../src/systems/casting.ts';
import { nextFloor } from '../src/core/game.ts';
import { tidy } from '../src/core/income.ts';
import { grantPot } from '../src/systems/pots.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { CONTENT_DIR, HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const b = content.market!.bazaar!;

async function withMarket(patch: (m: Record<string, any>) => void): Promise<ContentPack> {
  return loadContentPack(async (f) => {
    const raw = JSON.parse(await readFile(join(CONTENT_DIR, f), 'utf8'));
    if (f === 'market.json') patch(raw);
    return raw;
  });
}

function player(level = 30, entropy = 7) {
  return newGame(content, { level, coins: 1e9, gems: 1e6 }, entropy);
}

test('8 ô; tỉ lệ độ hiếm đúng bảng (60 / 26 / 10 / 3,5 / 0,5%)', () => {
  const s = player();
  const count: Record<string, number> = {};
  let slots = 0;
  for (let w = 0; w < 3000; w++) {
    ensureBazaar(content, s, T0 + w * b.refreshHours * HOUR);
    assert.equal(s.bazaar!.slots.length, b.slots);
    for (const sl of s.bazaar!.slots) count[sl.rarity] = (count[sl.rarity] ?? 0) + 1;
    slots += s.bazaar!.slots.length;
  }
  const total = b.rarities.reduce((a, r) => a + r.weight, 0);
  for (const r of b.rarities) {
    const want = r.weight / total;
    const got = (count[r.id] ?? 0) / slots;
    assert.ok(Math.abs(got - want) < Math.max(0.012, want * 0.25), `${r.id}: ${got.toFixed(4)} ≠ ${want}`);
  }
});

test('tất định theo seed; tự làm mới sau 4 giờ, trong cùng khung thì giữ nguyên', () => {
  const a = player(30, 3);
  const c = player(30, 3);
  ensureBazaar(content, a, T0);
  ensureBazaar(content, c, T0);
  assert.deepEqual(a.bazaar, c.bazaar);
  const before = JSON.stringify(a.bazaar!.slots);
  assert.equal(ensureBazaar(content, a, T0 + 10 * 60_000), false);
  assert.equal(JSON.stringify(a.bazaar!.slots), before);
  const ev = updateWorld(content, a, T0 + b.refreshHours * HOUR + 1);
  assert.ok(ev.some((e) => e.type === 'bazaarRefreshed'));
  assert.notEqual(JSON.stringify(a.bazaar!.slots), before);
  assert.equal(newGame(content, { level: b.unlockLevel - 1 }).bazaar, undefined);
  assert.deepEqual(dispatch(content, newGame(content, { level: b.unlockLevel - 1, coins: 1e6 }), { type: 'rerollBazaar' }, T0), { ok: false, error: 'locked' });
});

test('giá đặt lại = U(cấp) × 0,15 × 1,5^n, n về 0 sang ngày mới', () => {
  const s = player(20);
  const u = content.income.unit(20);
  for (let n = 0; n < 6; n++) {
    const want = Math.max(b.reroll.minCoins, tidy(u * b.reroll.baseU * Math.pow(b.reroll.growth, n)));
    assert.equal(rerollCost(content, s, T0), want);
    const coins = s.player.coins;
    const r = dispatch(content, s, { type: 'rerollBazaar' }, T0);
    assert.ok(r.ok);
    assert.equal(coins - s.player.coins, want);
  }
  assert.equal(rerollCost(content, s, T0 + 24 * HOUR), Math.max(b.reroll.minCoins, tidy(u * b.reroll.baseU)));
  const poor = newGame(content, { level: 20, coins: 0 });
  assert.deepEqual(dispatch(content, poor, { type: 'rerollBazaar' }, T0), { ok: false, error: 'not_enough_coins' });
});

test('Vận May: đủ 10 chắc có ô Hiếm, đủ 40 chắc có ô Sử Thi; trúng thì về 0', () => {
  const s = player(30, 11);
  ensureBazaar(content, s, T0);
  s.bazaar!.luck = { rare: 10, epic: 3 };
  const r = dispatch(content, s, { type: 'rerollBazaar' }, T0);
  assert.ok(r.ok && r.events.some((e) => e.type === 'bazaarRerolled' && e.sure === 'rare'));
  assert.ok(s.bazaar!.slots.some((x) => ['rare', 'epic', 'legendary'].includes(x.rarity)));
  assert.equal(s.bazaar!.luck.rare, 0);
  s.bazaar!.luck = { rare: 2, epic: 40 };
  dispatch(content, s, { type: 'rerollBazaar' }, T0);
  assert.ok(s.bazaar!.slots.some((x) => x.rarity === 'epic' || x.rarity === 'legendary'));
  assert.equal(s.bazaar!.luck.epic, 0);
  assert.equal(s.bazaar!.luck.rare, 0);
  // Over many rerolls: never more than 10 in a row without Hiếm, nor 40 without Sử Thi.
  let dryRare = 0;
  let dryEpic = 0;
  for (let i = 0; i < 1500; i++) {
    s.player.coins = 1e12;
    // Ten rerolls a day (the price grows ×1.5 each time within a day).
    assert.ok(dispatch(content, s, { type: 'rerollBazaar' }, T0 + Math.floor(i / 10) * 24 * HOUR + (i % 10) * 60_000).ok);
    const sl = s.bazaar!.slots;
    dryRare = sl.some((x) => x.rarity !== 'common' && x.rarity !== 'good') ? 0 : dryRare + 1;
    dryEpic = sl.some((x) => x.rarity === 'epic' || x.rarity === 'legendary') ? 0 : dryEpic + 1;
    assert.ok(dryRare <= 10 && dryEpic <= 40, `rerolls ${i}: dry ${dryRare}/${dryEpic}`);
  }
});

test('mỗi ô mua 1 lần; xu về Phú Bà bày hàng; chậu Sử Thi trả ngọc', () => {
  const s = player(30, 5);
  ensureBazaar(content, s, T0);
  const i = s.bazaar!.slots.findIndex((x) => x.kind === 'item' && x.currency === 'coins');
  const sl = s.bazaar!.slots[i]!;
  const coins = s.player.coins;
  const seller = s.neighbors[sl.seller]!.coins;
  const have = s.inventory[sl.id] ?? 0;
  assert.ok(dispatch(content, s, { type: 'buyBazaar', slot: i }, T0).ok);
  assert.equal(coins - s.player.coins, sl.price);
  assert.equal(s.neighbors[sl.seller]!.coins - seller, sl.price);
  assert.equal(s.inventory[sl.id], have + sl.qty);
  assert.deepEqual(dispatch(content, s, { type: 'buyBazaar', slot: i }, T0), { ok: false, error: 'already_bought' });
  assert.deepEqual(dispatch(content, s, { type: 'buyBazaar', slot: 99 }, T0), { ok: false, error: 'bad_slot' });
  // Find a signature-pot slot by rerolling, and buy it with gems.
  let k = -1;
  for (let n = 0; n < 400 && k < 0; n++) {
    dispatch(content, s, { type: 'rerollBazaar' }, T0 + Math.floor(n / 10) * 24 * HOUR);
    k = s.bazaar!.slots.findIndex((x) => x.kind === 'pot');
  }
  assert.ok(k >= 0, 'không thấy ô chậu');
  const pot = s.bazaar!.slots[k]!;
  assert.equal(pot.currency, 'gems');
  const gems = s.player.gems;
  const r = dispatch(content, s, { type: 'buyBazaar', slot: k }, T0);
  assert.ok(r.ok);
  const ev = r.events.find((e) => e.type === 'bazaarBought');
  assert.ok(ev && ev.type === 'bazaarBought' && ev.potInstanceId);
  assert.equal(s.pots[ev.potInstanceId]!.potId, pot.id);
  assert.equal(gems - s.player.gems, pot.price);
});

test('không mua về bán lại có lãi: giá ô ≥ giá bán × markup', () => {
  const s = player(25, 9);
  for (let w = 0; w < 300; w++) {
    ensureBazaar(content, s, T0 + w * b.refreshHours * HOUR);
    for (const sl of s.bazaar!.slots) {
      if (sl.currency !== 'coins' || sl.kind !== 'item') continue;
      const sell = content.items.get(sl.id)?.sellPrice ?? 0;
      assert.ok(sl.price >= sell * sl.qty * content.neighbors.market.markup - 1, `${sl.id}`);
    }
  }
});

test('ô Khá ưu tiên đồ đang thiếu cho lần nâng chậu kế tiếp', () => {
  const s = player(30, 2);
  // Give a pot whose next level asks for a Khá bug.
  const isGood = (id: string) => content.bugs.get(id)?.rarity === 'good';
  let found = false;
  for (const def of content.potList) {
    const lv = def.levels.findIndex((l, i) => i > 0 && Object.keys(l.upgradeCost?.items ?? {}).some(isGood));
    if (lv > 0) {
      const id = grantPot(s, def.id, 'shop', T0);
      s.pots[id]!.level = lv;
      found = true;
      break;
    }
  }
  assert.ok(found);
  const inGoodPool = (id: string) => b.pools.good.some((e) => e.id === id || (e.pick === 'bug' && content.bugs.get(id)?.rarity === e.rarity && content.bugs.get(id)!.unlockLevel <= 30));
  const want = [...wantedItems(content, s)].filter(inGoodPool);
  assert.ok(want.some(isGood));
  let hit = 0;
  let good = 0;
  for (let w = 0; w < 800; w++) {
    ensureBazaar(content, s, T0 + w * b.refreshHours * HOUR);
    // The first Khá slot of each board (a board never shows the same thing twice).
    const sl = s.bazaar!.slots.find((x) => x.rarity === 'good');
    if (sl) ((good += 1), want.includes(sl.id) && (hit += 1));
  }
  assert.ok(hit / good > b.wantedChance * 0.8, `${hit}/${good}`);
});

test('A3: giá mở tầng, đúc chậu, nâng sao máy tăng theo cấp; hệ số 0 thì giữ giá cũ', async () => {
  const s = player(15);
  const floor = nextFloor(content, s)!;
  assert.equal(floorUnlockCost(content, floor, 15), floor.unlockCost);
  const pot = content.potList.find((p) => p.group === 'crafted' && p.rarity === 'rare')!;
  assert.equal(castRecipe(content, pot, 30)!.coins, castRecipe(content, pot)!.coins);
  const scaled = await withMarket((m) => {
    m.levelPricing.floorUnlockU = 0.5;
    m.levelPricing.castingU.rare = 1;
    m.levelPricing.machineStarU = 0.3;
  });
  const f = nextFloor(scaled, s)!;
  assert.equal(floorUnlockCost(scaled, f, 15), f.unlockCost + tidy(0.5 * scaled.income.unit(15)));
  assert.ok(floorUnlockCost(scaled, f, 25) > floorUnlockCost(scaled, f, 15));
  assert.equal(castRecipe(scaled, pot, 20)!.coins, castRecipe(scaled, pot)!.coins + tidy(scaled.income.unit(20)));
  // The command charges the scaled price.
  const t = newGame(scaled, { level: f.unlockLevel + 5, coins: 1e9 });
  for (const [id, q] of Object.entries(f.unlockItems ?? {})) t.inventory[id] = q;
  const coins = t.player.coins;
  assert.ok(dispatch(scaled, t, { type: 'unlockFloor', floorId: f.id }, T0).ok);
  assert.equal(coins - t.player.coins, floorUnlockCost(scaled, f, f.unlockLevel + 5));
});

test('save hỏng: bảng Sạp lỗi bị bỏ, ô món không còn bị bỏ, Vận May giữ', () => {
  const s = player(30);
  ensureBazaar(content, s, T0);
  s.bazaar!.slots[0]!.id = 'base:none';
  s.bazaar!.luck = { rare: 4, epic: -2 };
  const fixed = reconcile(s, content, 'local').state;
  assert.equal(fixed.bazaar!.slots.length, b.slots - 1);
  assert.deepEqual(fixed.bazaar!.luck, { rare: 4 });
  (s as { bazaar: unknown }).bazaar = { slots: 'x' };
  assert.equal(reconcile(s, content, 'local').state.bazaar, undefined);
});
