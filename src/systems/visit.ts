// Visiting a neighbour's garden (REDESIGN_V2 3). BOT gardens are not simulated pot by pot; what
// you see is derived deterministically from the neighbour's level, likes and the day, so it is
// stable while you look, changes over the day as plants grow, and costs nothing to keep.
// Some pots need help (thirsty or a Bọ Mây); helping is a real command with a daily limit.

import type { ContentPack, CropDef, FloorDef, PotDef } from '../core/content.ts';
import type { BotState, GameState } from '../core/state.ts';
import { randomFor } from '../core/rng.ts';
import { localDay } from './missions.ts';

export type HelpKind = 'water' | 'bug';

export interface VisitPot {
  key: string;
  pot: PotDef;
  level: number;
  crop: CropDef;
  stage: number;
  ripe: boolean;
  progress: number;
  remainingMs: number;
  need: HelpKind | null;
}

export interface VisitFloor {
  def: FloorDef;
  stars: number;
  pots: VisitPot[];
}

const pick = <T>(list: T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]!;

/** Today's help record for a neighbour (resets when the local day changes). */
export function helpToday(content: ContentPack, bot: BotState, now: number): string[] {
  return bot.help.day === localDay(content, now) ? bot.help.pots : [];
}

export function helpsLeft(content: ContentPack, bot: BotState, now: number): number {
  return Math.max(0, content.neighbors.help.perBotPerDay - helpToday(content, bot, now).length);
}

export function helpReward(content: ContentPack, bot: BotState): { coins: number; xp: number } {
  const h = content.neighbors.help;
  return { coins: Math.round(h.coinsBase + h.coinsPerLevel * bot.level), xp: h.xp };
}

export function botGarden(content: ContentPack, state: GameState, botId: string, now: number): VisitFloor[] {
  const def = content.bots.get(botId);
  const bot = state.neighbors[botId];
  if (!def || !bot) return [];
  const seed = state.seed;
  const day = localDay(content, now);
  const helped = new Set(helpToday(content, bot, now));
  const lv = bot.level;
  const pots = content.potList.filter((p) => p.unlockLevel <= lv && !p.retired);
  const crops = content.cropList.filter((c) => c.unlockLevel <= lv);
  const liked = crops.filter((c) => c.family === def.likes);
  const floors = content.floorList.filter((f) => f.unlockLevel <= lv);
  return floors.map((fdef, fi) => {
    const extra = Math.floor((lv - fdef.unlockLevel) / 3);
    const slots = Math.min(fdef.maxSlots, fdef.slotCount + extra);
    const stars = fdef.stars.filter((s) => s.level + 2 <= lv).length;
    // Each floor has a favourite pot (neighbours like matching sets), mostly the best they can get.
    const rich = [...pots].sort((a, b) => b.unlockLevel - a.unlockLevel);
    const main = pick(rich.slice(0, Math.max(1, Math.ceil(rich.length / 2))), randomFor(seed, 'vpot', botId, fi));
    const list: VisitPot[] = [];
    for (let i = 0; i < slots; i++) {
      const key = `${fi}:${i}`;
      const pot = randomFor(seed, 'vpotmix', botId, fi, i) < 0.7 ? main : pick(pots, randomFor(seed, 'vpot2', botId, fi, i));
      const level = 1 + Math.floor(randomFor(seed, 'vlv', botId, fi, i) * pot.levels.length * Math.min(1, lv / 20));
      const crop = liked.length > 0 && randomFor(seed, 'vlike', botId, key, day) < 0.6 ? pick(liked, randomFor(seed, 'vcl', botId, key, day)) : pick(crops, randomFor(seed, 'vc', botId, key, day));
      const cycle = crop.growSeconds * 1000;
      const t = now / cycle + randomFor(seed, 'vphase', botId, key, day);
      const progress = t - Math.floor(t);
      const ripe = progress >= 0.85;
      const stage = ripe ? crop.stages - 1 : Math.min(crop.stages - 2, Math.floor((progress / 0.85) * (crop.stages - 1)));
      const r = randomFor(seed, 'vneed', botId, key, day);
      const need: HelpKind | null = ripe || stage < 1 || helped.has(key) || r >= 0.4 ? null : r < 0.22 ? 'water' : 'bug';
      list.push({ key, pot, level: Math.min(level, pot.levels.length), crop, stage, ripe, progress, remainingMs: ripe ? 0 : (0.85 - progress) * cycle, need });
    }
    return { def: fdef, stars, pots: list };
  });
}
