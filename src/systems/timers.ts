// Chỉ thị 12 B1.2: Hẹn giờ — what will be done and when, so the player can plan the next visit:
// "14:30 Tầng 2 chín · 15:10 Khinh khí cầu về · 16:00 Chợ tự làm mới · 18:00 Lượt trộm hồi".

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { cropStatus } from './growth.ts';
import { bazaarOpen, nextFreeRefreshAt } from './bazaar.ts';
import { nextStealTurnAt } from './social.ts';
import { luckStatus } from './sessionLuck.ts';
import { energyMax, seaRules } from './sea.ts';

export interface Timer {
  at: number;
  text: string;
  kind: 'crop' | 'balloon' | 'bazaar' | 'steal' | 'workshop' | 'errand' | 'house' | 'energy' | 'luck';
}

export function upcoming(content: ContentPack, state: GameState, now: number, limit = 12): Timer[] {
  const out: Timer[] = [];
  state.floors.forEach((f, i) => {
    let first = Infinity;
    let count = 0;
    for (const s of f.slots) {
      const st = s.planting ? cropStatus(content, state, s, now) : null;
      if (st && !st.ripe) {
        first = Math.min(first, st.readyAt);
        count += 1;
      }
    }
    if (count > 0) out.push({ at: first, text: `Tầng ${i + 1} chín${count > 1 ? ` (${count} chậu đang lớn)` : ''}`, kind: 'crop' });
  });
  const balloon = state.orders.slots.filter((s) => !s.order && s.readyAt > now).map((s) => s.readyAt);
  if (balloon.length) out.push({ at: Math.min(...balloon), text: 'Khinh khí cầu về với đơn mới', kind: 'balloon' });
  if (content.market?.bazaar && bazaarOpen(content, state)) out.push({ at: nextFreeRefreshAt(content, now), text: 'Sạp Săn Hàng tự làm mới', kind: 'bazaar' });
  const steal = nextStealTurnAt(content, state, now);
  if (steal) out.push({ at: steal, text: 'Có thêm 1 lượt trộm', kind: 'steal' });
  for (const [id, m] of Object.entries(state.workshop)) {
    const next = m.queue.find((j) => j.endsAt > now);
    if (next) out.push({ at: next.endsAt, text: `${content.machines?.get(id)?.name.vi ?? "Xưởng"} làm xong`, kind: 'workshop' });
  }
  for (const e of state.errands.list) if (e.pet && !e.done && (e.endsAt ?? 0) > now) out.push({ at: e.endsAt!, text: `${content.pets?.species.find((s) => s.id === e.pet)?.name.vi ?? 'Thú cưng'} đi việc vặt về`, kind: 'errand' });
  for (const [id, b] of Object.entries(state.buildings)) if (b.upgradeEndsAt && b.upgradeEndsAt > now) out.push({ at: b.upgradeEndsAt, text: `${content.village?.houses.find((h) => h.id === id)?.name.vi ?? 'Nhà'} nâng cấp xong`, kind: 'house' });
  const sea = seaRules(content);
  if (sea && state.energy.value < energyMax(content, state)) {
    const full = state.energy.at + (energyMax(content, state) - state.energy.value) * sea.energy.regenMinutes * 60_000;
    out.push({ at: full, text: 'Năng Lượng Gió đầy', kind: 'energy' });
  }
  const luck = luckStatus(content, state, now);
  if (luck?.nextAt && luck.nextAt > now) out.push({ at: luck.nextAt, text: `Lộc Phiên lần ${luck.count + 1}`, kind: 'luck' });
  return out.sort((a, b) => a.at - b.at).slice(0, limit);
}
