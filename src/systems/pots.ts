// Pot lines (docs/POT_SYSTEM.md): every line has its own levels 1–50, looks, skills and materials.
// Definitions live in content; what the player owns (level, when, how, history) lives in state.

import type { ContentPack, PotDef, PotLevelDef, PotLook, PotSkill, PotStatName } from '../core/content.ts';
import type { GameState, PotInstance } from '../core/state.ts';

export function potLevelDef(content: ContentPack, pot: PotInstance): PotLevelDef {
  const def = content.pots.get(pot.potId);
  if (!def) throw new Error(`Không có chậu ${pot.potId}`);
  const lv = def.levels[pot.level - 1];
  if (!lv) throw new Error(`Chậu ${pot.potId} không có cấp ${pot.level}`);
  return lv;
}

export function unlockedSkills(def: PotDef, level: number): PotSkill[] {
  return def.skills.filter((s) => s.level <= level);
}

/** Stat of a pot: its level value plus stat skills it has unlocked. */
export function potStat(content: ContentPack, pot: PotInstance, stat: PotStatName): number {
  const def = content.pots.get(pot.potId);
  let v = potLevelDef(content, pot).stats[stat] ?? 0;
  if (def) for (const s of unlockedSkills(def, pot.level)) if (s.effect.kind === 'stat' && s.effect.stat === stat) v += s.effect.value;
  // Pot stars ("Hoàn Mỹ" from casting; pot stars later): a share more of every stat per star.
  if (pot.stars) v *= 1 + (content.casting?.starStatBonus ?? 0) * pot.stars;
  return v;
}

/** Chance that a harvest in this pot gives double produce (skills, additive). */
export function doubleYieldChance(content: ContentPack, pot: PotInstance): number {
  const def = content.pots.get(pot.potId);
  if (!def) return 0;
  return Math.min(0.5, unlockedSkills(def, pot.level).reduce((n, s) => n + (s.effect.kind === 'doubleYield' ? s.effect.chance : 0), 0));
}

/** Multiplier on mutation chances for crops in this pot (skills, multiplicative). */
export function mutationMultiplier(content: ContentPack, pot: PotInstance): number {
  const def = content.pots.get(pot.potId);
  if (!def) return 1;
  return unlockedSkills(def, pot.level).reduce((m, s) => m * (s.effect.kind === 'mutationBoost' ? s.effect.multiplier : 1), 1);
}

export function maxPotLevel(content: ContentPack, potId: string): number {
  return content.pots.get(potId)?.levels.length ?? 0;
}

/** Appearance for a level: the look, its index, and how many small steps past its start. */
export function potLook(def: PotDef, level: number): { look: PotLook | null; index: number; step: number } {
  let index = -1;
  def.looks.forEach((l, i) => {
    if (level >= l.from) index = i;
  });
  const look = def.looks[index] ?? null;
  return { look, index, step: look ? level - look.from : 0 };
}

/** True when reaching this level changes the pot's picture (an evolution milestone). */
export function isMilestone(def: PotDef, level: number): boolean {
  return def.looks.some((l) => l.from === level && level > 1);
}

/** Stage name (POT_SYSTEM 2): ten stages of five levels. */
export const STAGE_NAMES = ['Khởi Nguyên', 'Nảy Mầm', 'Tinh Xảo', 'Ma Thuật', 'Hiếm', 'Cao Quý', 'Sử Thi', 'Huyền Thoại', 'Thần Thoại', 'Tối Thượng'];
export const stageOf = (level: number) => Math.min(STAGE_NAMES.length - 1, Math.floor((level - 1) / 5));

/** Cost to reach the next level, or null when the pot is already at its last level. */
export function nextUpgradeCost(content: ContentPack, pot: PotInstance) {
  const def = content.pots.get(pot.potId);
  const next = def?.levels[pot.level];
  return next?.upgradeCost ?? null;
}

export type UpgradeBlock = 'max_level' | 'level_not_open' | 'locked' | null;

/** Why the next upgrade cannot happen yet (costs aside). */
export function upgradeBlock(content: ContentPack, state: GameState, pot: PotInstance): UpgradeBlock {
  const def = content.pots.get(pot.potId);
  if (!def || pot.level >= def.levels.length) return 'max_level';
  if (pot.level >= def.openTo) return 'level_not_open';
  if (state.player.level < (def.levelReq[pot.level] ?? 1)) return 'locked';
  return null;
}

export function canAfford(state: GameState, cost: { coins: number; items: Record<string, number> }): boolean {
  if (state.player.coins < cost.coins) return false;
  return Object.entries(cost.items).every(([id, qty]) => (state.inventory[id] ?? 0) >= qty);
}

/** Records a pot line in the collection book (first time and best level). */
export function noteInBook(state: GameState, potId: string, level: number, now: number): void {
  const e = state.potBook[potId];
  if (!e) state.potBook[potId] = { firstAt: now, bestLevel: level };
  else e.bestLevel = Math.max(e.bestLevel, level);
}

/** Gives the player a new pot (goes to the pot stock). Returns its instance id. */
export function grantPot(state: GameState, potId: string, source: NonNullable<PotInstance['source']>, now: number): string {
  const potInstanceId = `pot-b${state.nextId++}`;
  state.pots[potInstanceId] = { potId, level: 1, obtainedAt: now, source, history: [{ level: 1, at: now }] };
  state.potStock.push(potInstanceId);
  noteInBook(state, potId, 1, now);
  return potInstanceId;
}

/** Power score used by balance checks (POT_SYSTEM 4): one number to compare lines fairly. */
export const POWER_WEIGHTS: Record<PotStatName, number> = { speed: 1, yield: 1, xp: 0.6, luck: 0.5, attract: 0.3, care: 0.3 };
export function powerScore(def: PotDef, level: number): number {
  const lv = def.levels[level - 1];
  if (!lv) return 0;
  let s = 0;
  for (const [k, v] of Object.entries(lv.stats) as Array<[PotStatName, number]>) s += v * POWER_WEIGHTS[k];
  for (const sk of unlockedSkills(def, level)) {
    if (sk.effect.kind === 'stat') s += sk.effect.value * POWER_WEIGHTS[sk.effect.stat];
    else if (sk.effect.kind === 'doubleYield') s += sk.effect.chance; // +chance × yield ≈ +chance of output
    else s += 0.03 * (sk.effect.multiplier - 1); // mutations are rare: small expected value
  }
  return Math.round(s * 1000) / 1000;
}
