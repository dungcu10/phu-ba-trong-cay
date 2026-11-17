// Directive 05 (CTO): balance of the 50 signature pots (base:pot.sig-NN-…).
//
// Rules (locked by tests/signature-balance.test.ts):
// - Power score (src/systems/pots.ts powerScore) at levels 10, 25 and 50 rises with rarity:
//   rare < epic < legendary, every tier >= 10% above the one below at level 50, and every
//   signature pot above Chậu Đất Nung (common) at the same level.
// - Pots of the same rarity stay within ±8% of their tier's mean at levels 10, 25, 50.
// - Each shop theme has its own direction, so picking a pot is a decision, not just "the strongest":
//     Đồ ăn       -> Sản lượng (yield)
//     Linh vật    -> Kinh nghiệm + May mắn (xp, luck)
//     Thiên nhiên -> Lớn nhanh + Chăm sóc (speed, care)
//     Gốm Á Đông  -> Chăm sóc + Hút bọ (care, attract)
//     Thần thoại  -> balanced stats, the strongest level-50 skill
// Stats are solved so each pot hits its tier's level-50 target exactly; inside a theme, pots
// alternate which secondary stat they lean on (±15%) so two pots of one theme still differ.

import type { PotGrowth, PotSkill, PotStatName } from '../src/core/content.ts';
import { POWER_WEIGHTS } from '../src/systems/pots.ts';

export type Tier = 'rare' | 'epic' | 'legendary';

/** Level-50 power score target per tier (Chậu Đất Nung, common, is 0.826 at level 50). */
export const TIER_TARGET: Record<Tier, number> = { rare: 0.95, epic: 1.07, legendary: 1.2 };
/** Skill strength per tier. */
const TIER_SKILL: Record<Tier, number> = { rare: 1, epic: 1.12, legendary: 1.25 };
/** Upgrade cost scale per tier (coins and milestone materials). */
const TIER_COST: Record<Tier, { coins: number; clay: number }> = {
  rare: { coins: 250, clay: 1 },
  epic: { coins: 400, clay: 1.5 },
  legendary: { coins: 600, clay: 2 },
};

/** Share of the level-50 value a pot already has at level 1. */
const START = 0.15;
const CURVE = 0.85;

interface ThemeDesign {
  focus: PotStatName;
  /** Relative stat mix; the first two non-focus entries alternate ±15% between pots. */
  mix: Partial<Record<PotStatName, number>>;
  swing: [PotStatName, PotStatName];
  /** Skills at 10, 25, 50 (rare strength). Power value of each is the same across themes,
   *  except Thần thoại whose level-50 skill is 1.5× stronger. */
  skills: Array<{ id: string; level: number; name: string; desc: (v: number) => string; effect: (v: number) => PotSkill['effect']; value: number }>;
}

const pct = (v: number) => `${String(Math.round(v * 1000) / 10).replace('.', ',')}%`;
const statSkill = (stat: PotStatName, label: string) => ({
  effect: (v: number): PotSkill['effect'] => ({ kind: 'stat', stat, value: v }),
  desc: (v: number) => `${label} +${pct(v)}.`,
});
const double = {
  effect: (v: number): PotSkill['effect'] => ({ kind: 'doubleYield', chance: v }),
  desc: (v: number) => `${pct(v)} cơ hội thu hoạch gấp đôi.`,
};

export const THEMES: Record<string, ThemeDesign> = {
  'Đồ ăn': {
    focus: 'yield',
    mix: { yield: 1, speed: 0.3, xp: 0.3, luck: 0.2 },
    swing: ['speed', 'xp'],
    skills: [
      { id: 'sig-warm-oven', level: 10, name: 'Bếp Ấm', ...statSkill('yield', 'Sản lượng'), value: 0.03 },
      { id: 'sig-double-batch', level: 25, name: 'Mẻ Bánh Đôi', ...double, value: 0.04 },
      { id: 'sig-cloud-feast', level: 50, name: 'Tiệc Mây', ...statSkill('yield', 'Sản lượng'), value: 0.06 },
    ],
  },
  'Linh vật': {
    focus: 'xp',
    mix: { xp: 1, luck: 1, yield: 0.3, speed: 0.15 },
    swing: ['xp', 'luck'],
    skills: [
      { id: 'sig-little-helper', level: 10, name: 'Bạn Nhỏ Chăm Chỉ', ...statSkill('xp', 'Kinh nghiệm'), value: 0.05 },
      { id: 'sig-lucky-charm', level: 25, name: 'Bùa May', ...statSkill('luck', 'May mắn'), value: 0.08 },
      { id: 'sig-soulmate', level: 50, name: 'Tri Kỷ', ...statSkill('xp', 'Kinh nghiệm'), value: 0.1 },
    ],
  },
  'Thiên nhiên': {
    focus: 'speed',
    mix: { speed: 1, care: 1.4, yield: 0.5, xp: 0.3, luck: 0.2 },
    swing: ['yield', 'care'],
    skills: [
      { id: 'sig-morning-dew', level: 10, name: 'Sương Sớm', ...statSkill('care', 'Chăm sóc'), value: 0.1 },
      { id: 'sig-young-sun', level: 25, name: 'Nắng Non', ...statSkill('speed', 'Lớn nhanh'), value: 0.04 },
      { id: 'sig-sacred-grove', level: 50, name: 'Rừng Thiêng', ...statSkill('speed', 'Lớn nhanh'), value: 0.06 },
    ],
  },
  'Gốm Á Đông': {
    focus: 'care',
    mix: { care: 1, attract: 1, yield: 0.4, speed: 0.25, xp: 0.2 },
    swing: ['care', 'attract'],
    skills: [
      { id: 'sig-glaze-scent', level: 10, name: 'Men Hương', ...statSkill('attract', 'Hút bọ'), value: 0.1 },
      { id: 'sig-old-kiln', level: 25, name: 'Lò Cổ', ...statSkill('care', 'Chăm sóc'), value: 0.13 },
      { id: 'sig-heirloom', level: 50, name: 'Báu Vật Gia Truyền', ...double, value: 0.06 },
    ],
  },
  'Thần thoại': {
    focus: 'luck',
    mix: { speed: 0.6, yield: 0.6, xp: 0.6, luck: 0.6, attract: 0.4, care: 0.4 },
    swing: ['speed', 'luck'],
    skills: [
      { id: 'sig-blessing', level: 10, name: 'Phúc Khí', ...statSkill('luck', 'May mắn'), value: 0.06 },
      { id: 'sig-divine-grace', level: 25, name: 'Thần Ân', ...double, value: 0.04 },
      { id: 'sig-heaven-mandate', level: 50, name: 'Thiên Mệnh', ...double, value: 0.09 },
    ],
  },
};

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function skillPower(e: PotSkill['effect']): number {
  if (e.kind === 'stat') return e.value * POWER_WEIGHTS[e.stat];
  if (e.kind === 'doubleYield') return e.chance;
  return 0.03 * (e.multiplier - 1);
}

export interface SignatureEconomy {
  focus: PotStatName;
  source: { vi: string };
  growth: PotGrowth;
  skills: PotSkill[];
}

/** Growth, skills and focus of signature pot number n (1–50) of a theme and tier. */
export function signatureEconomy(n: number, theme: string, tier: Tier): SignatureEconomy {
  const t = THEMES[theme];
  if (!t) throw new Error(`nhóm chậu không có thiết kế cân bằng: ${theme}`);
  const sk = TIER_SKILL[tier];
  const skills: PotSkill[] = t.skills.map((s) => {
    const v = round3(s.value * sk);
    return { id: s.id, level: s.level, name: { vi: s.name }, desc: { vi: s.desc(v) }, effect: s.effect(v) };
  });
  const skillTotal = skills.reduce((a, s) => a + skillPower(s.effect), 0);

  // Alternate the lean between the two swing stats, so neighbours in a theme differ.
  const lean = n % 2 === 0 ? 1 : -1;
  const mix: Partial<Record<PotStatName, number>> = { ...t.mix };
  mix[t.swing[0]] = (mix[t.swing[0]] ?? 0) * (1 + 0.15 * lean);
  mix[t.swing[1]] = (mix[t.swing[1]] ?? 0) * (1 - 0.15 * lean);
  const weighted = (Object.entries(mix) as Array<[PotStatName, number]>).reduce((a, [k, v]) => a + v * POWER_WEIGHTS[k], 0);
  const scale = (TIER_TARGET[tier] - skillTotal) / weighted;

  const stats: Partial<Record<PotStatName, [number, number]>> = {};
  for (const [k, v] of Object.entries(mix) as Array<[PotStatName, number]>) {
    const top = round3(v * scale);
    stats[k] = [round3(top * START), top];
  }

  const cost = TIER_COST[tier];
  const milestones: Record<string, Record<string, number>> = {};
  [2, 4, 6, 8, 10, 12, 15, 18, 22, 30].forEach((q, i) => {
    milestones[String((i + 1) * 5)] = { 'base:mat.cloud-clay': Math.round(q * cost.clay) };
  });

  return {
    focus: t.focus,
    source: { vi: 'Mua ở Lò Gốm Bà Mây' },
    growth: {
      maxLevel: 50,
      openTo: 10,
      curve: CURVE,
      stats,
      coins: { base: cost.coins, growth: 1.15 },
      materials: [
        { item: 'base:bug.ladybird', from: 2, base: 2, growth: 1.06 },
        { item: 'base:mat.cloud-clay', from: 6, base: 1, growth: 1.05 },
      ],
      milestones,
      stagePlayerLevel: [1, 3, 6, 9, 12, 15, 18, 21, 24, 27],
    },
    skills,
  };
}
