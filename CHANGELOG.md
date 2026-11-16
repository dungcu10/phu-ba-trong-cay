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

### [2026-11-16] Vỏ ứng dụng, phần vẽ PixiJS, giao diện cổ tích, công cụ dev, bản thử — Giai đoạn 0 + 1
- Loại: Thêm
- Mô tả: 10 chậu mỗi tầng, góc chính diện + cây leo cổ thụ; ảnh đợt 1 (Leonardo) + hậu kỳ; PWA chạy offline; lưu theo vòng đời iPad; Sạp Hạt Giống, Bàn Thợ Gốm, Rương Mây, Cài Đặt theo DESIGN_SYSTEM; kéo tay qua hàng chậu; công cụ dev `?dev=1`; bản thử GitHub Pages có "BẢN THỬ · commit".
- File/Module: `src/app`, `src/render`, `src/ui`, `src/main.ts`, `src/styles.css`, `index.html`, `vite.config.ts`, `public/`, `assets/`, `tools/process_art.py`, `tests/browser/`, `.github/workflows/`, `content/base/floors.json`
- Ảnh hưởng save: Không (định dạng vẫn saveVersion 4; số chậu tăng chỉ áp dụng cho game mới)
- Kiểm thử: `npm test` 53/53; `npm run test:browser` 4/4 (vòng chơi, IndexedDB, đóng tab, offline) trên Chrome máy chủ; CI build được nhánh `gh-pages`. Chưa chạy trên Safari iPad.
- Trạng thái nghiệm thu: Chờ — báo cáo `docs/reports/2026-11-16-ban-thu-giai-doan-1.md`

### [2026-11-16] Sửa lỗi theo biên bản CTO số 01 (R1–R6) — Giai đoạn 0
- Loại: Sửa lỗi (R1, R2: P1 · R3–R6: P2) + Thay đổi tài liệu
- Mô tả:
  - R1: Cúc Bông Gòn miễn phí; gói nội dung bắt buộc có cây miễn phí mở từ cấp khởi đầu.
  - R2: Bọ Mây theo thời gian sinh trưởng (1 con / 1.800 giây, tối đa 4/vụ), đậu đến khi bắt hoặc thu hoạch; chỉnh giá Cúc 2→1, Cà Chua 4→7, Dâu Tây 22→32; công cụ bảng cân bằng.
  - R3: tưới không còn làm mất bọ (cơ chế từ R2, có test).
  - R4: thời gian game = đồng hồ + `clockOffsetMs`; chỉnh giờ về không làm game đứng im.
  - R5: đối chiếu save với nội dung khi đọc/nhập; chặn cây thu nhiều lần dưới 4 giai đoạn.
  - R6: `.gitignore`, Art Style Guide mục 4 và 9, `tools/validate-content.ts`; thay `PROJECT_RULES.md` 1.2 và `GAME_ROADMAP.md`.
  - Lưu `docs/DESIGN_SYSTEM.md`, `content/ui/design-tokens.json`; Art Style Guide mục 8 theo phong cách cổ tích.
- File/Module: `content/base/{crops,bugs}.json`, `src/core/{content,clock,game,state}.ts`, `src/systems/growth.ts`, `src/persistence/{migrations,serializer,saveManager,reconcile}.ts`, `tools/`, `tests/`, `docs/`
- Ảnh hưởng save: Có — saveVersion 1 → 4 (2: `caughtBugs`; 3: `clockOffsetMs`; 4: `seedCost`), có migration và test từng bước
- Kiểm thử: `tsx --test tests/*.test.ts` → 53/53 đạt; `tsc --noEmit -p .` → không lỗi. Test R1, R2(a), R4 đã được kiểm chứng là trượt với mã/dữ liệu cũ.
- Trạng thái nghiệm thu: Chờ — báo cáo `docs/reports/2026-11-16-sua-loi-bien-ban-01.md`

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
