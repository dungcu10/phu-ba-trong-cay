// Chỉ thị 10 § 3.11: Xu Xu, the mascot in the corner. A tap gets a reaction and a line; at most once per
// rewardMinutes the tap also brings a small gift. The next feature to open is what Xu Xu talks about
// first. Pure rules (deterministic line choice by tap count).

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { addItem } from './economy.ts';

export function xuxuGiftReady(content: ContentPack, state: GameState, now: number): boolean {
  const x = content.xuxu;
  if (!x) return false;
  return !state.xuxu || now - state.xuxu.giftAt >= x.rewardMinutes * 60_000;
}

/** The next feature the player will open, if any. */
export function nextFeature(content: ContentPack, state: GameState): { name: string; level: number } | null {
  let best: { name: string; level: number } | null = null;
  for (const f of content.features.values()) {
    const lv = f.level ?? 0;
    if (lv > state.player.level && (!best || lv < best.level)) best = { name: f.name.vi, level: lv };
  }
  return best;
}

export function xuxuLine(content: ContentPack, state: GameState): string {
  const lines = content.xuxu?.lines ?? [];
  const taps = state.xuxu?.taps ?? 0;
  const next = nextFeature(content, state);
  if (next && taps % 3 === 0) return `Lên cấp ${next.level} là mở ${next.name} đó, cố lên!`;
  return lines[taps % Math.max(1, lines.length)] ?? '';
}

export function tapXuxu(content: ContentPack, state: GameState, now: number): { line: string; gift: { coins: number; items: Record<string, number> } | null } {
  const ready = xuxuGiftReady(content, state, now);
  const line = xuxuLine(content, state);
  const x = (state.xuxu ??= { giftAt: 0, taps: 0 });
  x.taps += 1;
  if (!ready || !content.xuxu) return { line, gift: null };
  x.giftAt = now;
  const r = content.xuxu.reward;
  state.player.coins += r.coins ?? 0;
  for (const [id, q] of Object.entries(r.items ?? {})) addItem(state, id, q);
  return { line, gift: { coins: r.coins ?? 0, items: r.items ?? {} } };
}
