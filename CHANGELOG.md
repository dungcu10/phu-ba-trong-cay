# CHANGELOG.md — PHÚ BÀ TRỒNG CÂY

> Nhật ký mọi thay đổi. Developer **phải** ghi vào đây sau mỗi lần giao việc, trước khi báo cáo.
> Mục mới nhất ở trên cùng. Mục chưa nghiệm thu nằm dưới `[Chưa phát hành]`.

## Quy ước

Mỗi mục ghi theo mẫu:

```
### [YYYY-MM-DD] Tên nhiệm vụ — Giai đoạn X
- Loại: Thêm / Sửa lỗi / Thay đổi / Tối ưu / Gỡ bỏ / Bảo mật dữ liệu
- Mô tả: ...
- File/Module: ...
- Ảnh hưởng save: Không / Có (saveVersion cũ → mới, đã có migration)
- Kiểm thử: lệnh/cách thử + kết quả
- Trạng thái nghiệm thu: Chờ / Đạt / Không đạt (lý do) — do CTO điền
```

Phân loại:
- **Thêm** — tính năng mới
- **Sửa lỗi** — ghi kèm mức P0–P3
- **Thay đổi** — thay đổi hành vi tính năng đã có
- **Tối ưu** — hiệu năng, ghi số liệu trước/sau
- **Gỡ bỏ** — tính năng/tài nguyên bị bỏ
- **Bảo mật dữ liệu** — liên quan lưu trữ/save

---

## [Chưa phát hành]

### [2026-11-16] Lõi mô phỏng, dữ liệu lát cắt dọc, lưu trữ — Giai đoạn 0
- Loại: Thêm
- Mô tả: Gói nội dung JSON (1 tầng, 4 chậu, 6 cây, 1 Bọ Mây, 5 cấp chậu); lõi mô phỏng không phụ thuộc phần vẽ (gieo, tưới, bắt bọ, thu hoạch, bán, nâng chậu, kho, lên cấp); RNG có hạt giống; chống lùi giờ; save có saveVersion + checksum, migration, 2 khe xoay vòng, xuất/nhập, IndexedDB store. Chưa có phần vẽ, Service Worker, công cụ dev — xem báo cáo.
- File/Module: `content/base/`, `src/core/`, `src/systems/`, `src/persistence/`, `tests/`
- Ảnh hưởng save: Có — định dạng đầu tiên, saveVersion 1 (chưa có save cũ cần migration)
- Kiểm thử: `tsx --test tests/*.test.ts` → 35/35 đạt; `tsc --noEmit -p .` → không lỗi. Chưa chạy trên Safari iPadOS.
- Trạng thái nghiệm thu: Chờ — chưa đủ điều kiện mục A (thiếu bằng chứng iPad). Báo cáo: `docs/reports/2026-11-16-giai-doan-0-tien-do.md`

### [2026-11-16] Thiết lập bộ quy tắc dự án — Giai đoạn 0
- Loại: Thêm
- Mô tả: Ban hành bộ tài liệu quản trị dự án: `PROJECT_RULES.md`, `GAME_ROADMAP.md`, `QUALITY_STANDARDS.md`, `CHANGELOG.md`, `ACCEPTANCE_CHECKLIST.md`.
- File/Module: thư mục gốc repository
- Ảnh hưởng save: Không
- Kiểm thử: Không áp dụng (tài liệu)
- Trạng thái nghiệm thu: Đạt — CTO ban hành
