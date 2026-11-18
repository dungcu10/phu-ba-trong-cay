// Chỉ thị 11 TỔNG § C2: the four sky zones, five floors each (no browser-only imports, so tests use it).

/** Floors per sky zone (§ C2). */
export const FLOORS_PER_ZONE = 5;
export const ZONES = [
  { id: 'low', name: 'Trời Thấp', tint: 0xffffff, pedestal: 'grey' },
  { id: 'gold', name: 'Trời Vàng Kim', tint: 0xfff1dc, pedestal: 'sand' },
  { id: 'dusk', name: 'Hoàng Hôn Tím', tint: 0xf3e3f6, pedestal: 'moon' },
  { id: 'night', name: 'Thiên Giới Đêm', tint: 0xe0e3fb, pedestal: 'moon' },
] as const;
export type SkyZone = (typeof ZONES)[number];

/** Zone of floor index i (0-based): 0–4 low, 5–9 gold, 10–14 dusk, 15+ night. */
export function zoneOf(index: number): number {
  return Math.min(ZONES.length - 1, Math.floor(Math.max(0, index) / FLOORS_PER_ZONE));
}
