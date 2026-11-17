// Bổ sung A6.4–A6.5 (chỉ thị 12 TỔNG, mục A6 mới): crops that grow faster at night (Hoa Trăng Non),
// crop mastery ("Thông Thạo": stars from the harvest count in the Sổ Tay, each with a small bonus that
// goes through slotBonus and its caps), and the daily hot crop ("Cây Hot": picked from the seed and the
// local day, sells for more and makes orders that carry it pay more). Deterministic; BOTs use the same.

import type { ContentPack, CropDef, PotStatName } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';

/** Extra growth speed at night for this crop (Hoa Trăng Non: +100%, i.e. twice as fast). */
export function cropNightGrowth(content: ContentPack, cropId: string): number {
  return content.cropExtras?.nightGrowth[cropId] ?? 0;
}

/** Mastery stars (0–5) of a crop from its harvest count. */
export function masteryStars(content: ContentPack, state: GameState, cropId: string): number {
  const n = state.journal[cropId]?.harvests ?? 0;
  return (content.cropExtras?.mastery ?? []).filter((m) => n >= m.harvests).length;
}

/** Bonus of a crop's mastery stars to one stat. */
export function masteryBonus(content: ContentPack, state: GameState, crop: CropDef, stat: PotStatName): number {
  const n = state.journal[crop.id]?.harvests ?? 0;
  let v = 0;
  for (const m of content.cropExtras?.mastery ?? []) if (n >= m.harvests && m.stat === stat) v += m.value;
  return v;
}

/** Next mastery milestone of a crop (harvests needed), or null at full mastery. */
export function nextMastery(content: ContentPack, state: GameState, cropId: string): number | null {
  const n = state.journal[cropId]?.harvests ?? 0;
  return (content.cropExtras?.mastery ?? []).find((m) => n < m.harvests)?.harvests ?? null;
}

/** Today's hot crop: one of the crops open at this level, picked from the seed and the local day. */
export function hotCrop(content: ContentPack, state: GameState, level: number, now: number): CropDef | null {
  if (!content.cropExtras) return null;
  const open = content.cropList.filter((c) => c.unlockLevel <= level).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (open.length === 0) return null;
  return open[Math.floor(randomFor(state.seed, 'hotCrop', localDay(content, now)) * open.length)]!;
}

/** Sell price factor for an item today (the hot crop's produce sells for more). */
export function hotSellFactor(content: ContentPack, state: GameState, itemId: string, now: number): number {
  const hot = hotCrop(content, state, state.player.level, now);
  return hot && hot.produce.id === itemId ? 1 + (content.cropExtras?.hot.sellBonus ?? 0) : 1;
}
