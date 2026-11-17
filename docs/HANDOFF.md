# Bàn giao tiến độ — Phú Bà Trồng Cây

Cập nhật: 2026-11-16. Đọc file này và 5 file quy tắc ở thư mục gốc trước khi làm bất cứ việc gì.

## Tài liệu trong kho

| File | Nội dung |
| --- | --- |
| `PROJECT_RULES.md`, `QUALITY_STANDARDS.md`, `ACCEPTANCE_CHECKLIST.md`, `GAME_ROADMAP.md`, `CHANGELOG.md` | Bộ quy tắc của CTO — giữ nguyên nội dung, muốn đổi thì đề xuất trong báo cáo |
| `docs/GAMEPLAY_DESIGN.md` | Thiết kế gameplay lõi: chậu trên các tầng mây |
| `docs/ARCHITECTURE.md` | Kiến trúc kỹ thuật, công nghệ, lưu trữ, BOT, kiểm thử |
| `docs/ART_STYLE_GUIDE.md` | Phong cách hình ảnh, quy trình tạo ảnh AI, hậu kỳ |
| `docs/reports/` | Báo cáo giao việc theo ngày |

## Quyết định đã chốt (chủ dự án, 16/11/2026)

- Tên: PHÚ BÀ TRỒNG CÂY. Nền tảng: iPad (iPad Pro M2), cảm ứng, PWA cài lên màn hình chính, offline 100% sau lần tải đầu.
- Công nghệ: TypeScript; PixiJS v8 (WebGPU, lùi WebGL); IndexedDB; Service Worker; host GitHub Pages (kho công khai — chủ dự án đã đồng ý).
- Không nạp tiền, không quảng cáo, không mua bán bằng tiền thật.
- Gameplay lõi: chậu trên các tầng mây (xem `docs/GAMEPLAY_DESIGN.md`).
- Đồ họa: 2.5D isometric, ảnh minh họa AI theo Style Guide + hậu kỳ; code chỉ lo chuyển động/hiệu ứng.

## Phạm vi đang làm (chỉ thị CTO 16/11/2026)

Giai đoạn 0 + 1, lát cắt dọc: 1 tầng mây, 4 vị trí chậu, 6 giống cây, 1 loại Bọ Mây, nâng cấp chậu, bán lấy tiền, lên cấp. **Không làm**: Linh Thú, bộ chậu, biến dị, BOT, giao thương, sự kiện.

## Vướng mắc cần chủ dự án xử lý

1. ~~Kho GitHub chưa tồn tại~~ — đã tạo `dungcu10/phu-ba-trong-cay` ngày 16/11/2026.
2. **Không cài được thư viện** (npm bị chặn trong phiên). Cần bật quyền cài gói trong cài đặt mạng của Claude và mở phiên mới; khi đó cài PixiJS v8 và làm phần vẽ.
3. **Kiểm thử khói trên Safari iPad** (`ACCEPTANCE_CHECKLIST.md` mục C) cần thiết bị thật — developer không có iPad.

## Nhánh

- `main`: bộ quy tắc + tài liệu (chưa có mã đã nghiệm thu).
- `feat/foundation`: giai đoạn 0 đang làm — lõi mô phỏng, dữ liệu, lưu trữ, kiểm thử.

## Việc tiếp theo

Xem mục "Những gì CHƯA làm" trong báo cáo mới nhất ở `docs/reports/`.
