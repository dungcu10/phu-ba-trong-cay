// Balance simulation (CTO review 01, R2). Plays one crop in one level-1 pot through the real
// command processor, visiting every N seconds, and measures coins, XP and Bọ Mây per hour.
// Used by tools/balance-report.ts and by tests/balance.test.ts.

import type { ContentPack, CropDef } from '../src/core/content.ts';
import { dispatch } from '../src/core/game.ts';
import { createNewGame } from '../src/core/state.ts';
import { cropStatus } from '../src/systems/growth.ts';

export interface PlayStyle {
  id: string;
  label: string;
  visitEverySeconds: number;
}

export const PLAY_STYLES: PlayStyle[] = [
  { id: 'active', label: 'Ghé mỗi 1 phút', visitEverySeconds: 60 },
  { id: 'regular', label: 'Ghé mỗi 15 phút', visitEverySeconds: 15 * 60 },
  { id: 'casual', label: 'Ghé mỗi 2 giờ', visitEverySeconds: 2 * 3600 },
];

export interface CropResult {
  crop: CropDef;
  coinsPerHour: number;
  xpPerHour: number;
  bugsPerHour: number;
}

const T0 = Date.UTC(2026, 10, 16, 0, 0, 0);

/**
 * Each visit: catch every bug, harvest if ripe, sell everything, water if thirsty, replant if
 * empty. Net coins = sales − seed costs. Averaged over several seeds to smooth randomness.
 */
export function simulate(fullContent: ContentPack, crop: CropDef, style: PlayStyle, hours = 24, seeds = [1, 2, 3, 4, 5]): CropResult {
  // Crops only: surprise gifts and mutations are measured separately, they would blur the comparison.
  const content: ContentPack = { ...fullContent, surprises: { ...fullContent.surprises, giftChancePer10Min: 0, mutations: [] } };
  let coins = 0;
  let xp = 0;
  let bugs = 0;
  for (const seed of seeds) {
    const s = createNewGame(content, T0, seed);
    s.player.level = content.config.levels.maxLevel;
    s.player.coins = 1_000_000;
    // Crops only: neighbours' gifts and surprise gifts would blur the comparison.
    s.neighbors = {};
    const start = s.player.coins;
    const at = { floor: 0, slot: 0 };
    const end = T0 + hours * 3_600_000;
    for (let t = T0; t <= end; t += style.visitEverySeconds * 1000) {
      while (dispatch(content, s, { type: 'catchBug', ...at }, t).ok) bugs += 1;
      const h = dispatch(content, s, { type: 'harvest', ...at }, t);
      if (h.ok) for (const e of h.events) if (e.type === 'harvested') xp += e.xp;
      for (const [itemId, qty] of Object.entries(s.inventory)) {
        if (qty > 0 && content.items.get(itemId)?.sellPrice != null) dispatch(content, s, { type: 'sell', itemId, qty }, t);
      }
      if (cropStatus(content, s, s.floors[0]!.slots[0]!, t)?.thirsty) dispatch(content, s, { type: 'water', ...at }, t);
      if (!s.floors[0]!.slots[0]!.planting) dispatch(content, s, { type: 'plant', cropId: crop.id, ...at }, t);
    }
    coins += s.player.coins - start;
  }
  const div = hours * seeds.length;
  return { crop, coinsPerHour: coins / div, xpPerHour: xp / div, bugsPerHour: bugs / div };
}

export type BalanceTable = Record<string, CropResult[]>;

export function balanceTable(content: ContentPack): BalanceTable {
  const table: BalanceTable = {};
  for (const style of PLAY_STYLES) table[style.id] = content.cropList.map((c) => simulate(content, c, style));
  return table;
}

/** Best crop for coins in a play style. */
export function bestForCoins(rows: CropResult[]): CropResult {
  return rows.reduce((a, b) => (b.coinsPerHour > a.coinsPerHour ? b : a));
}

/**
 * The play style that suits a crop: the one where the crop comes closest to that style's
 * best coins/hour (ties go to the less frequent style).
 */
export function fittingStyle(table: BalanceTable, cropId: string): PlayStyle {
  let best = PLAY_STYLES[0]!;
  let bestScore = -Infinity;
  for (const style of PLAY_STYLES) {
    const rows = table[style.id]!;
    const top = bestForCoins(rows).coinsPerHour;
    const row = rows.find((r) => r.crop.id === cropId)!;
    const score = top > 0 ? row.coinsPerHour / top : 0;
    if (score >= bestScore) {
      bestScore = score;
      best = style;
    }
  }
  return best;
}
