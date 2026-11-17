// Directive 05 (CTO): balance of the 50 signature pots. Locks the rules written in
// tools/signature-balance.ts so retuning one pot cannot silently break the ladder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PotDef } from '../src/core/content.ts';
import { powerScore } from '../src/systems/pots.ts';
import { THEMES } from '../tools/signature-balance.ts';
import { loadBase } from './helpers.ts';

const content = await loadBase();
const sig = content.potList.filter((d) => d.id.startsWith('base:pot.sig-'));
const clay = content.pots.get('base:pot.terracotta')!;
const TIERS = ['rare', 'epic', 'legendary'] as const;
const LEVELS = [10, 25, 50];
const mean = (ds: PotDef[], lv: number) => ds.reduce((a, d) => a + powerScore(d, lv), 0) / ds.length;
const byTier = (t: string) => sig.filter((d) => d.rarity === t);

test('đủ 50 chậu, mỗi độ hiếm đều có chậu', () => {
  assert.equal(sig.length, 50);
  for (const t of TIERS) assert.ok(byTier(t).length > 0, t);
});

test('sức mạnh tăng dần theo độ hiếm ở cấp 10, 25, 50; mọi chậu đặc trưng mạnh hơn Đất Nung (thường) cùng cấp', () => {
  for (const lv of LEVELS) {
    for (const d of sig) assert.ok(powerScore(d, lv) > powerScore(clay, lv), `${d.id} cấp ${lv} phải > Đất Nung`);
    for (let i = 1; i < TIERS.length; i++) {
      const lowMax = Math.max(...byTier(TIERS[i - 1]!).map((d) => powerScore(d, lv)));
      const highMin = Math.min(...byTier(TIERS[i]!).map((d) => powerScore(d, lv)));
      assert.ok(highMin > lowMax, `cấp ${lv}: ${TIERS[i]} yếu nhất (${highMin}) phải > ${TIERS[i - 1]} mạnh nhất (${lowMax})`);
    }
  }
});

test('cấp 50: mỗi bậc hiếm hơn bậc dưới ít nhất 10%; bậc thấp nhất hơn Đất Nung ít nhất 10%', () => {
  let below = powerScore(clay, 50);
  for (const t of TIERS) {
    const m = mean(byTier(t), 50);
    assert.ok(m >= below * 1.1, `${t}: ${m.toFixed(3)} phải ≥ 1,1 × ${below.toFixed(3)}`);
    below = m;
  }
});

test('cùng độ hiếm chênh nhau không quá ±8% ở cấp 10, 25, 50', () => {
  for (const t of TIERS) {
    for (const lv of LEVELS) {
      const m = mean(byTier(t), lv);
      for (const d of byTier(t)) {
        const dev = Math.abs(powerScore(d, lv) / m - 1);
        assert.ok(dev <= 0.08, `${d.id} cấp ${lv}: lệch ${(dev * 100).toFixed(1)}% so với trung bình ${t}`);
      }
    }
  }
});

test('mỗi nhóm một hướng: chỉ số chủ đạo của nhóm là chỉ số lớn nhất hoặc nằm trong cặp chủ đạo', () => {
  for (const d of sig) {
    const t = THEMES[d.theme!];
    assert.ok(t, `${d.id}: nhóm ${d.theme} chưa có thiết kế`);
    assert.equal(d.focus, t.focus, d.id);
    const top = d.levels[49]!.stats;
    const vals = Object.values(top) as number[];
    const best = Math.max(...vals);
    if (d.theme === 'Thần thoại') {
      // Balanced: no stat is more than 1.8× another.
      assert.ok(best <= Math.min(...vals) * 1.8, `${d.id}: Thần thoại phải cân bằng`);
    } else {
      const lead = [t.focus, ...t.swing].map((s) => top[s] ?? 0);
      assert.ok(Math.max(...lead) === best, `${d.id}: chỉ số lớn nhất phải thuộc hướng của nhóm ${d.theme}`);
    }
  }
});

test('Thần thoại có kỹ năng cấp 50 mạnh nhất trong cùng độ hiếm', () => {
  const skill50 = (d: PotDef) => {
    const sk = d.skills.find((s) => s.level === 50)!;
    return powerScore(d, 50) - powerScore({ ...d, skills: d.skills.filter((s) => s !== sk) }, 50);
  };
  for (const t of TIERS) {
    const myth = byTier(t).filter((d) => d.theme === 'Thần thoại');
    const rest = byTier(t).filter((d) => d.theme !== 'Thần thoại');
    if (myth.length === 0 || rest.length === 0) continue;
    assert.ok(Math.min(...myth.map(skill50)) > Math.max(...rest.map(skill50)), t);
  }
});

test('chậu đặc trưng mở tới cấp 10 như các dòng chậu khác; chi phí cấp 1→10 tăng theo độ hiếm', () => {
  const cost = (d: PotDef) => d.levels.slice(1, 10).reduce((a, l) => a + (l.upgradeCost?.coins ?? 0), 0);
  let prev = 0;
  for (const t of TIERS) {
    for (const d of byTier(t)) assert.equal(d.openTo, 10, d.id);
    const c = cost(byTier(t)[0]!);
    assert.ok(c > prev, `${t}: ${c}`);
    prev = c;
  }
});
