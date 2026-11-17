// Chỉ thị 10 § 3.8 (M7): casting crafted pots at the Lò Gốm — level 12, one recipe tier per rarity
// (rarer minerals for rarer pots), coins and items taken, about 10% "Hoàn Mỹ" (a star: stats up).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { castRecipe } from '../src/systems/casting.ts';
import { potStat } from '../src/systems/pots.ts';
import { reconcile } from '../src/persistence/reconcile.ts';
import { loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const crafted = (rarity: string) => content.potList.find((p) => p.group === 'crafted' && p.rarity === rarity)!;

function rich(level = 25, entropy = 1) {
  const s = newGame(content, { level, coins: 1e7 }, entropy);
  for (const t of content.casting!.tiers) for (const [id, q] of Object.entries(t.items)) s.inventory[id] = (s.inventory[id] ?? 0) + q * 50;
  return s;
}

test('mở ở cấp 12; chỉ chậu nhóm crafted; chậu chưa tới cấp thì chưa đúc được', () => {
  const pot = crafted('rare');
  assert.deepEqual(dispatch(content, rich(11), { type: 'castPot', potId: pot.id }, T0), { ok: false, error: 'level_not_open' });
  const shop = content.potList.find((p) => p.group !== 'crafted')!;
  assert.deepEqual(dispatch(content, rich(), { type: 'castPot', potId: shop.id }, T0), { ok: false, error: 'not_castable' });
  const legend = crafted('legendary');
  assert.deepEqual(dispatch(content, rich(legend.unlockLevel - 1), { type: 'castPot', potId: legend.id }, T0), { ok: false, error: 'locked' });
});

test('khoáng càng hiếm thì chậu càng hiếm: mỗi độ hiếm một bậc công thức, đắt dần', () => {
  const r = castRecipe(content, crafted('rare'))!;
  const e = castRecipe(content, crafted('epic'))!;
  const l = castRecipe(content, crafted('legendary'))!;
  assert.ok(r.coins < e.coins && e.coins < l.coins);
  assert.ok('base:mat.copper-bit' in r.items && 'base:mat.silver-bit' in e.items && 'base:mat.gold-dust' in l.items);
});

test('đúc: trừ xu và nguyên liệu, chậu vào kho chậu; thiếu thì không đúc', () => {
  const pot = crafted('epic');
  const s = rich();
  const recipe = castRecipe(content, pot)!;
  const coins = s.player.coins;
  const before = { ...s.inventory };
  const r = dispatch(content, s, { type: 'castPot', potId: pot.id }, T0);
  assert.ok(r.ok);
  const ev = r.ok ? r.events.find((e) => e.type === 'potCast') : undefined;
  assert.ok(ev && ev.type === 'potCast');
  assert.equal(s.pots[ev.potInstanceId]!.potId, pot.id);
  assert.ok(s.potStock.includes(ev.potInstanceId));
  assert.ok(coins - s.player.coins >= recipe.coins);
  for (const [id, q] of Object.entries(recipe.items)) assert.equal(s.inventory[id], before[id]! - q);
  const poor = newGame(content, { level: 25, coins: 1e7 }, 2);
  assert.deepEqual(dispatch(content, poor, { type: 'castPot', potId: pot.id }, T0), { ok: false, error: 'not_enough_items' });
});

test('khoảng 10% ra chậu Hoàn Mỹ (1 sao); sao làm chỉ số cao hơn, save hỏng thì sao bị kẹp lại', () => {
  let perfect = 0;
  const N = 400;
  let one: { s: ReturnType<typeof rich>; id: string } | null = null;
  for (let e = 0; e < N; e++) {
    const s = rich(25, e);
    const r = dispatch(content, s, { type: 'castPot', potId: crafted('rare').id }, T0);
    const ev = r.ok ? r.events.find((x) => x.type === 'potCast') : undefined;
    if (ev && ev.type === 'potCast' && ev.perfect) {
      perfect++;
      one ??= { s, id: ev.potInstanceId };
    }
  }
  assert.ok(Math.abs(perfect / N - content.casting!.perfectChance) < 0.05, `${perfect}/${N}`);
  const { s, id } = one!;
  const pot = s.pots[id]!;
  assert.equal(pot.stars, content.casting!.perfectStars);
  const stat = (['speed', 'yield', 'xp', 'luck'] as const).find((st) => potStat(content, { ...pot, stars: 0 }, st) > 0)!;
  assert.ok(potStat(content, pot, stat) > potStat(content, { ...pot, stars: 0 }, stat));
  const broken = JSON.parse(JSON.stringify(s));
  broken.pots[id].stars = 99;
  assert.equal(reconcile(broken, content, 'local').state.pots[id]!.stars, 5);
});
