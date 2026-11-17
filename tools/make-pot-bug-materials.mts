// Chỉ thị 10 § 3.4: pot upgrades use the new bugs. Rewrites growth.materials / growth.milestones of every pot
// in content/base/pots.json (generated data: do not hand-edit). Idempotent.
//   Levels 1–9: common bugs (Bọ Rùa Mây, kept as it was; Sâu Lá Non from level 5).
//   From level 10: the "good" bug of the pot's family (favoredFamily; pots without one take a family by turn).
//   From level 25: a rare bug (Bọ Hung Vàng or Đom Đóm Sao, by turn).
//   Evolution milestones (20, 30, 40, 50): 1–3 Ve Sầu Ngọc.
// Old materials (Đất Sét Mây, the line's shard) are kept unchanged.
// Usage: npx tsx tools/make-pot-bug-materials.mts

import { readFileSync, writeFileSync } from 'node:fs';

const POTS = 'content/base/pots.json';
const GOOD: Record<string, string> = { flower: 'base:bug.pink-moth', fruit: 'base:bug.jade-beetle', herb: 'base:bug.dew-hopper' };
const FAMILIES = ['flower', 'fruit', 'herb'];
const RARE = ['base:bug.gold-scarab', 'base:bug.star-firefly'];
const EPIC = 'base:bug.jade-cicada';
const EPIC_AT: Record<string, number> = { 20: 1, 30: 1, 40: 2, 50: 3 };
const NEW = new Set(['base:bug.leaf-worm', ...Object.values(GOOD), ...RARE]);

type Mat = { item: string; from: number; base: number; growth: number };
type Rule = { maxLevel: number; items: Record<string, { base: number; growth: number; from?: number }> };
type Pot = { id: string; favoredFamily?: string | null; levelRule?: Rule; growth?: { maxLevel: number; materials: Mat[]; milestones: Record<string, Record<string, number>> } };

const pots = JSON.parse(readFileSync(POTS, 'utf8')) as Pot[];
let changed = 0;
pots.forEach((p, i) => {
  const fam = p.favoredFamily && GOOD[p.favoredFamily] ? p.favoredFamily : FAMILIES[i % FAMILIES.length]!;
  // Older pots described by a level rule: the same tiers, as items with a first level. They have no
    // evolution milestones, so no Ve Sầu Ngọc (it would be needed at every level and block them).
  const r = p.levelRule;
  if (r) {
    for (const id of Object.keys(r.items)) if (NEW.has(id) || id === EPIC) delete r.items[id];
    if (r.maxLevel >= 5) r.items['base:bug.leaf-worm'] = { base: 1, growth: 1.05, from: 5 };
    if (r.maxLevel >= 10) r.items[GOOD[fam]!] = { base: 1, growth: 1.05, from: 10 };
    if (r.maxLevel >= 25) r.items[RARE[i % RARE.length]!] = { base: 1, growth: 1.04, from: 25 };
    changed++;
    return;
  }
  const g = p.growth;
  if (!g || !Array.isArray(g.materials)) return;
  const mats = g.materials.filter((m) => !NEW.has(m.item));
  mats.push({ item: 'base:bug.leaf-worm', from: 5, base: 1, growth: 1.05 });
  if (g.maxLevel >= 10) mats.push({ item: GOOD[fam]!, from: 10, base: 1, growth: 1.05 });
  if (g.maxLevel >= 25) mats.push({ item: RARE[i % RARE.length]!, from: 25, base: 1, growth: 1.04 });
  g.materials = mats;
  for (const [lv, q] of Object.entries(EPIC_AT)) {
    if (Number(lv) > g.maxLevel) continue;
    const m = (g.milestones[lv] ??= {});
    m[EPIC] = q;
  }
  changed++;
});
writeFileSync(POTS, JSON.stringify(pots, null, 2) + '\n');
console.log(`pots.json: ${changed} dòng chậu có công thức bọ mới`);
