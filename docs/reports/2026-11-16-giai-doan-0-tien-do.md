## Báo cáo giao việc — Giai đoạn 0: lõi mô phỏng, dữ liệu, lưu trữ (báo cáo tiến độ, CHƯA yêu cầu nghiệm thu)

Ngày: 2026-11-16 · Nhánh: `feat/foundation` · Developer: Claude

Cách hiểu đã chọn: chỉ thị CTO yêu cầu giai đoạn 0 + 1 dạng lát cắt dọc. Báo cáo này giao phần **không phụ thuộc thư viện**. Phần vẽ PixiJS chưa làm được (xem "Chưa làm"). Vì thiếu bằng chứng chạy trên Safari iPadOS, theo `ACCEPTANCE_CHECKLIST.md` mục A, phần này **chưa đủ điều kiện đưa vào nghiệm thu**.

- **Đã làm:**
  - Đưa 5 file quy tắc vào thư mục gốc, đã so từng byte với bản đính kèm, nội dung giữ nguyên (commit trên `main`).
  - Đưa vào `docs/`: `GAMEPLAY_DESIGN.md`, `ARCHITECTURE.md`, `ART_STYLE_GUIDE.md`, `HANDOFF.md` (commit trên `main`).
  - Dữ liệu cấu hình `content/base/`: 1 tầng mây (4 vị trí chậu), 1 loại chậu với 5 cấp (chỉ số và chi phí nâng cấp), 6 giống cây, 1 loại Bọ Mây, cấu hình kinh tế/cấp độ. Lõi không viết cứng giống cây, chậu hay số liệu nào.
  - Bộ nạp và kiểm tra gói nội dung (`src/core/content.ts`): báo đủ mọi lỗi như thiếu trường, trùng id, tham chiếu hỏng.
  - Lõi mô phỏng thuần TypeScript, không phụ thuộc DOM/PixiJS (`src/core`, `src/systems`): gieo, tưới (giảm 10% thời gian còn lại), bắt Bọ Mây, thu hoạch (cây thu nhiều lần thì mọc lại), bán (giá ngày dao động ±5%, tất định), nâng cấp chậu bằng xu + Bọ Mây, kho có giới hạn, XP và lên cấp.
  - Số ngẫu nhiên có hạt giống, là hàm thuần của (hạt giống, khóa sự kiện) (`src/core/rng.ts`), nên tính một lần hay chia nhỏ đều cho cùng kết quả. Đây là nền cho BOT chạy offline.
  - Thời gian: chỉ lưu mốc, trạng thái tính từ thời gian hiện tại. Chống lùi giờ: thời gian game không bao giờ lùi (`maxSeenAt`).
  - Lưu trữ (`src/persistence`): khung save có `saveVersion` và checksum; khung migration; 2 khe xoay vòng; tự khôi phục khe trước khi khe mới hỏng; cả hai khe hỏng thì báo lỗi, không tự tạo game mới đè lên; xuất/nhập file có kiểm tra; IndexedDB store (ghi xong mới báo thành công).
- **File đã thay đổi:** `content/base/*.json`, `src/core/{content,rng,clock,state,game}.ts`, `src/systems/{growth,pots,economy}.ts`, `src/persistence/{serializer,migrations,saveManager,store}.ts`, `tests/*.ts`, `package.json`, `tsconfig.json`, `CHANGELOG.md`, `docs/reports/2026-11-16-giai-doan-0-tien-do.md`.
- **Cách kiểm thử đã chạy (lệnh + kết quả thực tế):**
  - `tsx --test tests/*.test.ts` → `tests 35 · pass 35 · fail 0`.
  - `tsc --noEmit -p .` (thư mục `src`) → không lỗi.
  - Các test chính:
    - Sinh trưởng: đủ 5 giai đoạn, chín đúng hạn, tưới, mọc lại, nâng chậu làm lớn nhanh hơn.
    - Kinh tế: bán đúng tiền; từ chối số lượng sai, thiếu hàng, vật phẩm không bán được; kho đầy; lên cấp; người chơi mới đạt cấp 2 trong ≤ 5 phút.
    - Tiến trình offline: 8 giờ vắng mặt tính đúng và dưới 1 giây; tiến độ giữa chừng đúng; tính một lần bằng chia nhỏ.
    - Lùi giờ: không thu hoạch sớm, không thu hoạch hai lần.
    - Lưu/đọc: đọc lại y nguyên; phát hiện save bị sửa hoặc bị cắt; từ chối save bản mới hơn; migration tuần tự; xoay khe; khôi phục khe trước; hai khe hỏng không tự tạo game mới; xuất/nhập.
    - Nội dung: thêm một giống cây chỉ bằng dữ liệu, gieo, thu hoạch và bán được.
  - Tự rà soát: test Bọ Mây ban đầu dùng một hạt giống không có con bọ nào, nên đạt mà không chứng minh gì. Đã sửa: test chạy 10 vụ và bắt buộc tổng số bọ bắt được ≥ 5.
- **Bằng chứng:** log test ở trên. **Chưa có** ảnh chụp, số FPS hay ghi chép trên iPad.
- **Những gì CHƯA làm hoặc làm chưa tới:**
  1. **Phần vẽ (PixiJS) và giao diện chưa có** → chưa có bản chơi được. Lý do: môi trường không cài được thư viện (npm bị chặn). Chủ dự án cần bật quyền cài gói rồi mở phiên mới.
  2. Vỏ ứng dụng trình duyệt chưa làm: lưu khi `visibilitychange`/`pagehide`, gọi `navigator.storage.persist()`, Service Worker để chạy offline, triển khai GitHub Pages.
  3. Công cụ dev chưa làm: hiển thị FPS, tua nhanh thời gian, reset save an toàn.
  4. Chưa có test IndexedDB và Service Worker trên trình duyệt thật (dự kiến Playwright + Chrome headless). Logic save hiện mới được kiểm với bộ lưu trong bộ nhớ.
  5. Chưa đo hiệu năng, chưa chạy 9 bước kiểm thử khói trên Safari iPad (cần thiết bị thật).
  6. Chưa có hình tạm nào trong `assets/_placeholder/`, chưa có `assets/ASSET_SOURCES.md`.
  7. Chưa có bảng so sánh lợi nhuận/giờ của 6 giống cây để chứng minh "không có lựa chọn luôn tốt nhất" (`QUALITY_STANDARDS.md` mục 4).
  8. Typecheck chưa bao gồm thư mục `tests/` (thiếu `@types/node` khi không có npm). Test vẫn chạy được bằng `tsx`.
- **Rủi ro ảnh hưởng chức năng cũ:** không có chức năng cũ (kho mới). Định dạng save là `saveVersion` 1, phiên bản đầu tiên.
- **Đã cập nhật CHANGELOG.md:** có.

### Đề xuất cho CTO (không tự sửa quy tắc)

1. `GAME_ROADMAP.md` Giai đoạn 1 vẫn mô tả "ô đất trên đảo mây: cày, gieo, tưới, bón…", trong khi chỉ thị CTO và quyết định của chủ dự án là mô hình **chậu trên tầng mây**. Đề xuất CTO cập nhật mục này.
2. `PROJECT_RULES.md` mục 2 yêu cầu phê duyệt thư viện > 50 KB gzip. PixiJS v8 lớn hơn mức này. Chủ dự án đã chọn PixiJS ngày 16/11/2026; đề xuất CTO ghi phê duyệt vào mục 4.1.
3. Triển khai GitHub Pages để thử trên iPad: `PROJECT_RULES.md` cấm tự triển khai lên `main`. Đề xuất cho phép triển khai **bản thử** từ nhánh `feat/...` lên Pages để CTO và chủ dự án chạy kiểm thử khói, trước khi nghiệm thu và gộp vào `main`.
