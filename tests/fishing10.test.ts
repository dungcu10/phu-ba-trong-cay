// Chỉ thị 10 § 3.9 + 3.10: fishing (free bait, making bait, deterministic bite, reel, trading, Sổ Cá)
// and floor decorations (bonus on that floor, cap per floor, take down returns the item).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { castLine } from '../src/systems/fishing.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const fr = content.fishing!;
const bait = fr.baits[0]!.item;
const DAY = 24 * 3_600_000;

test('mồi miễn phí mỗi ngày 1 lần; chế mồi từ nông sản', () => {
  const s = newGame(content, { level: fr.unlockLevel });
  assert.ok(dispatch(content, s, { type: 'claimFreeBait' }, T0).ok);
  assert.equal(s.inventory[bait], fr.freeBaitPerDay);
  assert.deepEqual(dispatch(content, s, { type: 'claimFreeBait' }, T0 + 60_000), { ok: false, error: 'already_claimed' });
  assert.ok(dispatch(content, s, { type: 'claimFreeBait' }, T0 + DAY).ok);
  assert.deepEqual(dispatch(content, s, { type: 'craftBait', bait }, T0), { ok: false, error: 'not_enough_items' });
  for (const [id, q] of Object.entries(fr.baits[0]!.recipes[0]!)) s.inventory[id] = q;
  assert.ok(dispatch(content, s, { type: 'craftBait', bait }, T0).ok);
  assert.equal(s.inventory[bait], fr.freeBaitPerDay * 2 + 1);
  assert.deepEqual(dispatch(content, newGame(content, { level: fr.unlockLevel - 1 }), { type: 'claimFreeBait' }, T0), { ok: false, error: 'locked' });
});

test('cá cắn câu tất định theo seed; tỉ lệ theo mồi; kéo được thì vào túi + Sổ Cá', () => {
  const a = newGame(content, { level: 20 }, 4);
  const b = newGame(content, { level: 20 }, 4);
  a.inventory[bait] = 500;
  b.inventory[bait] = 500;
  const count: Record<string, number> = {};
  for (let i = 0; i < 400; i++) {
    const x = castLine(content, a, bait);
    const y = castLine(content, b, bait);
    assert.ok(typeof x !== 'string' && typeof y !== 'string');
    assert.equal(x.fish.id, y.fish.id);
    count[x.fish.rarity] = (count[x.fish.rarity] ?? 0) + 1;
    a.fishing.hooked = null;
    b.fishing.hooked = null;
  }
  assert.ok((count.common ?? 0) > (count.rare ?? 0) && (count.rare ?? 0) > 0);
  const s = newGame(content, { level: 20 });
  s.inventory[bait] = 1;
  const r = dispatch(content, s, { type: 'castLine', bait }, T0);
  const ev = r.ok ? r.events.find((e) => e.type === 'lineCast') : undefined;
  assert.ok(ev && ev.type === 'lineCast');
  assert.deepEqual(dispatch(content, s, { type: 'castLine', bait }, T0), { ok: false, error: 'line_busy' });
  assert.ok(dispatch(content, s, { type: 'reelFish', success: true }, T0).ok);
  assert.equal(s.inventory[ev.fishId], 1);
  assert.equal(s.collections.fish[ev.fishId]!.count, 1);
  assert.deepEqual(dispatch(content, s, { type: 'castLine', bait }, T0), { ok: false, error: 'no_bait' });
  assert.deepEqual(dispatch(content, s, { type: 'reelFish', success: true }, T0), { ok: false, error: 'nothing_hooked' });
});

test('cá vùng ra thì mất mồi, không có cá', () => {
  const s = newGame(content, { level: 20 });
  s.inventory[bait] = 1;
  const r = dispatch(content, s, { type: 'castLine', bait }, T0);
  assert.ok(r.ok);
  const id = s.fishing.hooked!.fishId;
  assert.ok(dispatch(content, s, { type: 'reelFish', success: false }, T0).ok);
  assert.equal(s.inventory[id] ?? 0, 0);
  assert.equal(s.inventory[bait] ?? 0, 0);
});

test('đổi cá lấy xu / vật phẩm / bọ hiếm; Sổ Cá nhận thưởng theo điểm', () => {
  const s = newGame(content, { level: 20 });
  const f = content.fish.get('base:fish.moon')!;
  s.inventory[f.id] = 3;
  const coins = s.player.coins;
  assert.ok(dispatch(content, s, { type: 'exchangeFish', fishId: f.id, option: 0 }, T0).ok);
  assert.equal(s.player.coins, coins + f.exchange[0]!.coins!);
  const bugIdx = f.exchange.findIndex((x) => x.bug);
  const r = dispatch(content, s, { type: 'exchangeFish', fishId: f.id, option: bugIdx }, T0);
  const ev = r.ok ? r.events.find((e) => e.type === 'fishExchanged') : undefined;
  assert.ok(ev && ev.type === 'fishExchanged' && Object.keys(ev.items).some((id) => content.bugs.get(id)?.rarity === f.exchange[bugIdx]!.bug));
  assert.deepEqual(dispatch(content, s, { type: 'exchangeFish', fishId: f.id, option: 9 }, T0), { ok: false, error: 'bad_option' });
  assert.deepEqual(dispatch(content, s, { type: 'claimFishBook' }, T0), { ok: false, error: 'nothing_to_claim' });
  s.collections.fish[f.id] = { firstAt: T0, count: Math.ceil(fr.book[0]!.points / f.points) };
  const gems = s.player.gems;
  assert.ok(dispatch(content, s, { type: 'claimFishBook' }, T0).ok);
  assert.equal(s.player.gems, gems + (fr.book[0]!.gems ?? 0));
  assert.deepEqual(dispatch(content, s, { type: 'claimFishBook' }, T0), { ok: false, error: 'nothing_to_claim' });
});

test('trang trí: đèn lồng cộng EXP trên đúng tầng, có trần mỗi tầng; gỡ xuống trả lại túi', () => {
  const d = content.decor!;
  const [lantern, lit] = Object.entries(d.items).find(([, it]) => it.stat === 'xp')!;
  const s = newGame(content, { level: 20, coins: 1e6 });
  const slot = s.floors[0]!.slots[0]!;
  const crop = content.cropList[0]!;
  const before = slotBonus(content, s, slot, crop, 'xp');
  assert.ok(dispatch(content, s, { type: 'buyDecor', itemId: lantern }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'buyDecor', itemId: lantern }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'placeDecor', floor: 0, slot: 0, itemId: lantern }, T0).ok);
  assert.ok(dispatch(content, s, { type: 'placeDecor', floor: 0, slot: 1, itemId: lantern }, T0).ok);
  const after = slotBonus(content, s, slot, crop, 'xp');
  assert.ok(Math.abs(after - before - Math.min(d.floorCap, lit.bonus * 2)) < 1e-9 || after === content.config.bonusCaps?.xp);
  assert.equal(s.inventory[lantern] ?? 0, 0);
  assert.deepEqual(dispatch(content, s, { type: 'placeDecor', floor: 0, slot: 0, itemId: lantern }, T0), { ok: false, error: 'not_enough_items' });
  assert.ok(dispatch(content, s, { type: 'placeDecor', floor: 0, slot: 0, itemId: null }, T0).ok);
  assert.equal(s.inventory[lantern], 1);
  assert.deepEqual(dispatch(content, s, { type: 'placeDecor', floor: 0, slot: 5, itemId: null }, T0), { ok: false, error: 'bad_slot' });
});
