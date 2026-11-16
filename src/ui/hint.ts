// "What should I do next?" — one short line always shown under the HUD (QUALITY_STANDARDS 3.4).
// Pure function of content, state and time so it can be tested without a browser.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { cropStatus } from '../systems/growth.ts';
import { nextFloor } from '../core/game.ts';
import { storageFree } from '../systems/economy.ts';
import { canAfford, nextUpgradeCost } from '../systems/pots.ts';
import { formatDuration } from './text.ts';

export type HintKind = 'harvest' | 'storageFull' | 'bug' | 'water' | 'plant' | 'sell' | 'upgrade' | 'floor' | 'wait' | 'idle';

export interface Hint {
  kind: HintKind;
  text: string;
}

export function nextHint(content: ContentPack, state: GameState, now: number): Hint {
  let ripe = 0;
  let bug = false;
  let thirsty = false;
  let empty = 0;
  let soonest: { name: string; ms: number } | null = null;

  for (const floor of state.floors) {
    for (const slot of floor.slots) {
      const st = cropStatus(content, state, slot, now);
      if (!st) {
        empty += 1;
        continue;
      }
      if (st.ripe) ripe += 1;
      if (st.bug) bug = true;
      if (st.thirsty) thirsty = true;
      if (!st.ripe && (!soonest || st.remainingMs < soonest.ms)) soonest = { name: st.crop.name.vi, ms: st.remainingMs };
    }
  }

  const hasSellable = Object.entries(state.inventory).some(([id, qty]) => qty > 0 && content.items.get(id)?.sellPrice != null);
  if (ripe > 0 && storageFree(content, state) <= 0) {
    return { kind: 'storageFull', text: 'Kho đầy rồi — mở Kho để bán bớt nông sản.' };
  }
  if (ripe > 0) return { kind: 'harvest', text: 'Cây đã chín! Chạm hoặc kéo tay qua các chậu để thu hoạch.' };
  if (bug) return { kind: 'bug', text: 'Có Bọ Mây đậu trên cây — chạm để bắt, dùng để nâng cấp chậu.' };
  if (thirsty) return { kind: 'water', text: 'Cây đang khát — chạm vào chậu để tưới, cây lớn nhanh hơn.' };

  if (empty > 0) {
    const affordable = content.cropList.some((c) => c.unlockLevel <= state.player.level && c.seedPrice <= state.player.coins);
    if (affordable) return { kind: 'plant', text: 'Chạm vào chậu trống để gieo hạt.' };
    if (hasSellable) return { kind: 'sell', text: 'Bán nông sản trong Kho để có xu mua hạt giống.' };
  }

  const floor = nextFloor(content, state);
  if (floor && state.player.level >= floor.unlockLevel && state.player.coins >= floor.unlockCost) {
    return { kind: 'floor', text: `Đủ điều kiện mở ${floor.name.vi} — vuốt lên dọc cây leo và chạm vào tầng mờ.` };
  }

  for (const pot of Object.values(state.pots)) {
    const cost = nextUpgradeCost(content, pot);
    if (cost && canAfford(state, cost)) {
      return { kind: 'upgrade', text: 'Đủ xu và bọ để nâng cấp chậu — chạm vào chậu để xem.' };
    }
  }

  if (soonest) return { kind: 'wait', text: `${soonest.name} chín sau ${formatDuration(soonest.ms)}.` };
  if (hasSellable) return { kind: 'sell', text: 'Mở Kho để bán nông sản lấy xu.' };
  return { kind: 'idle', text: 'Chạm vào chậu để bắt đầu.' };
}
