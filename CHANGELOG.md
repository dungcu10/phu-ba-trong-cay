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

### [2026-11-16] Thiết lập bộ quy tắc dự án — Giai đoạn 0
- Loại: Thêm
- Mô tả: Ban hành bộ tài liệu quản trị dự án: `PROJECT_RULES.md`, `GAME_ROADMAP.md`, `QUALITY_STANDARDS.md`, `CHANGELOG.md`, `ACCEPTANCE_CHECKLIST.md`.
- File/Module: thư mục gốc repository
- Ảnh hưởng save: Không
- Kiểm thử: Không áp dụng (tài liệu)
- Trạng thái nghiệm thu: Đạt — CTO ban hành
