## Báo cáo giao việc — Việc tiếp theo của biên bản 01: vỏ ứng dụng, phần vẽ, giao diện, công cụ dev, bản thử

Ngày: 2026-11-16 · Nhánh: `feat/app-shell` (tách từ `feat/foundation`) · Developer: Claude
Chưa yêu cầu nghiệm thu: thiếu bằng chứng chạy trên Safari iPad (`ACCEPTANCE_CHECKLIST.md` mục A).

- **Đã làm:**

| Commit | Nội dung |
|---|---|
| `e9dd07b` | Dữ liệu: 10 chậu mỗi tầng (chủ dự án quyết định); ghi góc chính diện + cây leo cổ thụ vào `GAMEPLAY_DESIGN.md` |
| `04ed8ac` | Ảnh đợt 1 (tờ duyệt 01, Leonardo/Lucid Origin) vào `assets/art-src/`; hậu kỳ bằng `tools/process_art.py`: tách nền, cắt 5 giai đoạn, đóng gói atlas. Developer không tạo ảnh |
| `ebf6e93` | Vỏ ứng dụng, phần vẽ PixiJS, giao diện cổ tích theo `DESIGN_SYSTEM.md`, công cụ dev, test trình duyệt |
| `490f03e`, `dbcef02` | Workflow bản thử: build từ `feat/app-shell` → nhánh `gh-pages` |

  - Vỏ ứng dụng: lưu sau mỗi lệnh (gom 1,5 giây), khi `visibilitychange`/`pagehide`, định kỳ 30 giây; `navigator.storage.persist()`; Service Worker sinh lúc build với danh sách file chính xác (cache-first); chặn chụm-phóng, chạm đúp, kéo nảy, chọn chữ; save hỏng thì hiện màn hình lỗi, **không** tạo game mới đè lên; mất WebGPU thì lưu rồi tải lại.
  - Phần vẽ (góc chính diện): bầu trời, thân cây leo bên trái, tầng mây 10 chậu nhấp nhô ±4 pt; cây 5 giai đoạn, đung đưa theo hệ (rau thảo rung nhanh, quả nhún chậm); cây chín nảy mỗi 2 giây; Bọ Mây vỗ cánh, có số đếm khi nhiều con; thanh lớn + đồng hồ dưới chậu; số bay và hạt dùng pool (tối đa 60 hạt).
  - Thao tác: chạm chậu trống → Sạp Hạt Giống; chạm cây → thu hoạch / bắt bọ / tưới / Bàn Thợ Gốm; **kéo tay qua hàng chậu** (bắt đầu từ đâu cũng được) → bắt hết bọ rồi thu hoạch hoặc tưới, chậu trống thì gieo lại giống vừa chọn; nút "Hạt giống" gieo cả tầng một lần.
  - Giao diện: huy hiệu hoa + dây leo XP, túi xu nảy khi tăng, gợi ý việc tiếp theo, 2 nút vòng cung. Nút "Cửa hàng" ở `DESIGN_SYSTEM` 6.3 **chưa đặt** vì lát cắt chưa có cửa hàng (quy tắc không để nút trơ). Sạp Hạt Giống Bà Mây (kệ gỗ, mái sọc, gói hạt khóa phủ vải), Bàn Thợ Gốm (chậu hiện tại → chậu sau nâng cấp phát sáng, nguyên liệu đủ/thiếu, nút vô hiệu nói rõ thiếu gì và lắc khi chạm), Rương Mây (giỏ sức chứa, ngăn nhung, cân với thanh trượt số lượng), Cài Đặt (âm thanh, xuất/nhập sao lưu có xác nhận). Mọi màu, cỡ chữ, thời lượng đọc từ `content/ui/design-tokens.json`. Có `prefers-reduced-motion`.
  - Công cụ dev (`?dev=1`): FPS trung bình + khung chậm nhất, tua +1 phút / +10 phút / +1 giờ / +8 giờ, reset save (xuất sao lưu trước, xác nhận hai lần).
  - Bản thử hiện "BẢN THỬ · <mã commit>" ở góc dưới trái.
- **Cách hiểu đã chọn:**
  1. Dải cây có 6 hình (thay vì 5): chọn 5 hình theo thứ tự hạt → mầm → non → ra hoa/đậu trái → chín (chỉ số ghi trong `tools/process_art.py`). Cà Rốt bỏ hình cuối (củ tròn có hoa văn, lệch phong cách). Cà Chua: hai hình cuối dính nhau, cắt tay tại x = 962.
  2. Thân cây leo dùng bản a; Bạc Hà dùng bản a (bản b giữ trong `art-src`, chờ CTO chọn).
  3. Bọ: hình 2 (cánh khép) và 3 (cánh mở) làm 2 khung vỗ cánh; hình 1 (chính diện) làm biểu tượng vật phẩm.
  4. Ảnh tầng mây được kéo giãn 1,72 × 1,25 để chứa 10 chậu.
  5. Đánh dấu khát/chín và hạt nước/tia vàng vẽ bằng code (`PROJECT_RULES` 3.3 cho phép hiệu ứng vẽ bằng code); biểu tượng xu/XP là hình CSS tạm — **chức năng xong, chờ đồ họa đợt 5–6**.
- **File đã thay đổi:** `index.html`, `vite.config.ts`, `public/`, `src/main.ts`, `src/styles.css`, `src/app/*`, `src/render/*`, `src/ui/*`, `tests/browser/smoke.test.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `.github/workflows/trial-pages.yml`, `tools/process_art.py`, `assets/`, `content/base/floors.json`, `tests/content.test.ts`, `docs/GAMEPLAY_DESIGN.md`.
- **Cách kiểm thử đã chạy (lệnh + kết quả thực tế):**
  - `npm run typecheck` (gồm `src`, `tests`, `tools`) → không lỗi. `npm test` → 53/53 đạt.
  - `npm run test:browser` (Playwright + Chrome có sẵn trên máy chủ, vẽ phần mềm) → **4/4 đạt**:
    1. Gieo cả tầng → tua 1 phút → kéo tay qua 10 chậu → 10 lần thu hoạch, 20 bông, lên cấp 2 → bán → xu tăng; **không lỗi console**.
    2. Tải lại trang giữ nguyên tiến trình (IndexedDB).
    3. Đóng tab ngay sau thao tác → mở lại không mất tiến trình.
    4. Tắt mạng sau lần tải đầu → tải lại vẫn vào được và chơi được (Service Worker).
  - CI trên GitHub: workflow chạy typecheck + test + build và tạo được nhánh `gh-pages` (`28ea6be`).
  - Test trình duyệt đã bắt được 2 lỗi thật, đã sửa: kéo tay bắt đầu ngoài chậu không được tính; hiệu ứng lên cấp/tưới/nâng chậu còn gọi hình tạm cũ.
- **Bằng chứng:** ảnh chụp trong `docs/reports/2026-11-16-ban-thu/` (ngang, dọc, Sạp Hạt Giống, Rương Mây, cây khát). FPS trong ảnh (11–13) là Chrome máy chủ vẽ bằng phần mềm, **không** phải số đo iPad.
- **Những gì CHƯA làm hoặc làm chưa tới:**
  1. **Chưa chạy trên Safari iPad**: 9 bước kiểm thử khói, số FPS thật, WebGPU trên iPadOS — cần chủ dự án mở bản thử.
  2. Trang Pages chưa bật (chờ chủ dự án bật một lần, xem dưới); developer không kiểm được trang thật từ máy làm việc.
  3. Biểu tượng xu, XP, nút cài đặt, khung gỗ là CSS/code tạm; chờ ảnh đợt 5–6.
  4. Âm thanh: tiếng tổng hợp đơn giản, chưa có nhạc nền.
  5. Mới có 1 tầng; chưa cuộn dọc giữa các tầng (giai đoạn sau).
  6. Biểu tượng vật phẩm cắt từ atlas bằng CSS đôi khi lộ 1–2 px hình bên cạnh (P3).
  7. Một phần mã viết lúc 18:20–18:34 (sau commit `04ed8ac`, chưa commit) đã bị developer chép đè nhầm khi khôi phục bản cất tạm; đã viết lại toàn bộ phần bị mất (phần vẽ, HUD, cửa sổ, controller) và kiểm lại bằng test trình duyệt.
- **Rủi ro ảnh hưởng chức năng cũ:** không đổi lõi mô phỏng (`src/core`, `src/systems`, `src/persistence`) trong phần này; 53 test lõi vẫn đạt. Số chậu 4 → 10 làm người chơi mới nhận được gấp 2,5 lần sản lượng/XP mỗi lượt gieo — cần CTO xem lại cân bằng (bảng cân bằng tính theo 1 chậu nên vẫn đúng).
- **Đã cập nhật CHANGELOG.md:** có.

### Chủ dự án cần làm một lần để có bản thử trên iPad
Vào kho trên GitHub → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **gh-pages**, thư mục **/ (root)** → Save. Sau 1–2 phút, mở **https://dungcu10.github.io/phu-ba-trong-cay/** trên Safari iPad → Chia sẻ → Thêm vào Màn hình chính. Thêm `?dev=1` vào cuối địa chỉ để có FPS và nút tua nhanh.
