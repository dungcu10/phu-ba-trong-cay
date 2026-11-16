// Vietnamese player-facing text and number/time formatting.

import type { ErrorCode } from '../core/game.ts';

export const ERROR_TEXT: Record<ErrorCode, string> = {
  bad_slot: 'Không có chậu ở đây.',
  slot_busy: 'Chậu này đang có cây rồi.',
  slot_empty: 'Chậu đang trống.',
  unknown_crop: 'Không có giống cây này.',
  locked: 'Giống này chưa mở khóa — lên cấp thêm nhé!',
  not_enough_coins: 'Chưa đủ xu.',
  not_enough_items: 'Chưa đủ vật phẩm.',
  not_thirsty: 'Cây chưa khát.',
  no_bug: 'Bọ đã bay mất rồi.',
  not_ripe: 'Cây chưa chín.',
  storage_full: 'Kho đầy! Bán bớt nông sản rồi thu hoạch tiếp nhé.',
  bad_quantity: 'Số lượng không hợp lệ.',
  not_sellable: 'Món này không bán được.',
  unknown_pot: 'Không tìm thấy chậu.',
  max_level: 'Chậu đã đạt cấp tối đa.',
};

const numberFormat = new Intl.NumberFormat('vi-VN');

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** "45 giây", "4 phút 05 giây", "1 giờ 20 phút". Rounds up so "0 giây" never shows while growing. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  if (m > 0) return `${m} phút ${String(s).padStart(2, '0')} giây`;
  return `${s} giây`;
}

/** Short form for labels under pots: "45s", "4:05", "1:20:00". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) return `${m}:${pad(s)}`;
  return `${s}s`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
