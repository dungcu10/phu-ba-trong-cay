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
  not_next_floor: 'Phải mở các tầng bên dưới trước.',
  not_for_sale: 'Chậu này không bán ở cửa hàng.',
  not_in_stock: 'Chậu này không còn trong kho chậu.',
  no_order: 'Đơn này không còn nữa.',
  not_waiting: 'Khinh khí cầu đã về rồi.',
  not_enough_gems: 'Chưa đủ Ngọc Mây.',
  nothing_to_claim: 'Chưa có phần thưởng để nhận.',
  stall_full: 'Sạp đã kín chỗ — chờ hàng xóm mua bớt nhé.',
  bad_price: 'Giá không hợp lệ.',
  unknown_listing: 'Món này không còn trên sạp.',
  max_slots: 'Tầng này đã mở rộng hết chỗ.',
  max_stars: 'Tầng này đã đủ 3 sao.',
  not_complete: 'Nhiệm vụ chưa xong.',
  already_claimed: 'Đã nhận thưởng rồi.',
  unknown_neighbor: 'Không tìm thấy hàng xóm này.',
  no_help_needed: 'Chậu này đang ổn, không cần giúp.',
  help_limit: 'Hôm nay đã giúp nhà này đủ rồi. Mai ghé tiếp nhé!',
  level_not_open: 'Các cấp tiếp theo của dòng chậu này sẽ mở ở bản cập nhật sau.',
  not_obtainable: 'Chậu này không đổi được bằng vật phẩm.',
  nothing_growing: 'Không có cây nào đang lớn trên tầng này.',
  unknown_quest: 'Không tìm thấy nhiệm vụ này.',
  quest_not_ready: 'Nhiệm vụ chưa xong.',
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
/** Short countdown for badges: "26 ngày", "1 ngày 5 giờ", "5:07" (h:mm under a day). */
export function formatTimeLeft(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 2) return `${days} ngày`;
  if (days === 1) return hours > 0 ? `1 ngày ${hours} giờ` : '1 ngày';
  return formatClock(ms).replace(/:\d\d$/, '');
}

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

export const STAT_TEXT: Record<string, string> = {
  speed: 'Lớn nhanh',
  yield: 'Sản lượng',
  xp: 'Kinh nghiệm',
  attract: 'Thu hút bọ',
  luck: 'May mắn',
  care: 'Chăm sóc',
};

/** Percent with one decimal when small (pot stats grow in small steps). */
export function formatStat(fraction: number): string {
  const v = Math.round(fraction * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')}%`;
}

export const GROUP_TEXT: Record<string, string> = { shop: 'Cửa hàng', daily: 'Nhiệm vụ ngày', weekly: 'Nhiệm vụ tuần', monthly: 'Nhiệm vụ tháng', challenge: 'Thử thách', event: 'Sự kiện', crafted: 'Chế tạo' };

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export const FAMILY_TEXT: Record<string, string> = { flower: 'Hoa', fruit: 'Quả', herb: 'Rau Thảo', wonder: 'Kỳ Hoa' };

export const RARITY_TEXT: Record<string, string> = { common: 'Thường', good: 'Tốt', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại' };

/** Number of marks shown next to a rarity (DESIGN_SYSTEM 3.3: never colour alone). */
export const RARITY_MARKS: Record<string, number> = { common: 0, good: 1, rare: 2, epic: 3, legendary: 4 };
