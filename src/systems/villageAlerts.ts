// Chỉ thị 11 § D1: the bubble on a house roof — what is waiting there right now. Pure reads of the save,
// computed when the state changes (not every frame). Used by the village window and the village scene.

import type { ContentPack } from '../core/content.ts';
import type { GameState } from '../core/state.ts';
import { hungryAt, rentEndsSoon } from './birds.ts';
import { checkInReady, houseBonus, houseOpen } from './village.ts';
import { missionDef } from './missions.ts';
import { canDeliver } from './orders.ts';
import { canAfford, nextUpgradeCost, upgradeBlock } from './pots.ts';
import { energyMax } from './sea.ts';
import { freeBaitReady } from './fishing.ts';

export type HouseAlert = { house: string; text: string };

export function houseAlerts(content: ContentPack, state: GameState, now: number): HouseAlert[] {
  const out: HouseAlert[] = [];
  const add = (house: string, text: string) => houseOpen(content, state, house) && out.push({ house, text });
  const doneMissions = state.missions.list.some((m) => !m.claimed && m.progress >= (missionDef(content, m.id)?.target ?? Infinity));
  if (checkInReady(content, state, now)) add('hall', 'Điểm danh hôm nay');
  else if (doneMissions) add('hall', 'Nhiệm vụ đã xong');
  if (state.orders.slots.some((s) => s.order && !s.flight && canDeliver(state, s.order))) add('balloon', 'Có đơn đủ hàng để gửi');
  const potReady = Object.values(state.pots).some((p) => {
    const c = nextUpgradeCost(content, p);
    return c && !upgradeBlock(content, state, p) && canAfford(state, c);
  });
  if (potReady) add('kiln', 'Đủ đồ nâng chậu');
  if (state.birds.some((b) => hungryAt(content, b) <= now || rentEndsSoon(content, b, now))) add('birds', 'Chim đói hoặc sắp hết hạn thuê');
  if (state.stall.length < content.neighbors.stallSlots + houseBonus(content, state, 'market', 'stallSlots')) add('market', 'Sạp còn chỗ bày hàng');
  if (Object.values(state.workshop).some((m) => m.queue.length === 0)) add('workshop', 'Máy đang nghỉ');
  if (content.sea && state.player.level >= content.sea.unlockLevel && state.energy.value >= energyMax(content, state)) add('gate', 'Năng Lượng Gió đã đầy');
  if (freeBaitReady(content, state, now)) out.push({ house: 'river', text: 'Có mồi câu miễn phí' });
  return out;
}
