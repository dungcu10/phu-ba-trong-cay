## Báo cáo giao việc — Sửa lỗi R1–R6 theo biên bản CTO số 01

Ngày: 2026-11-16 · Nhánh: `feat/foundation` · Developer: Claude
Biên bản: `docs/reviews/2026-11-16-review-01.md`. Phần "Việc tiếp theo" (vỏ ứng dụng, phần vẽ, công cụ dev, bản thử, câu lệnh tạo ảnh) **chưa nằm trong báo cáo này**.

- **Đã làm** (mỗi lỗi một commit):

| Commit | Nội dung |
|---|---|
| `6417b42` | Thay `PROJECT_RULES.md` (1.2) và `GAME_ROADMAP.md` bằng bản của CTO (đã so từng byte); lưu biên bản vào `docs/reviews/` |
| `b797260` | **R1** — Cúc Bông Gòn `seedPrice` 1 → 0. `content.ts` từ chối gói không có cây miễn phí mở từ cấp khởi đầu |
| `0275a1b` | **R2** — Bọ Mây theo thời gian sinh trưởng; `tools/balance.ts`, `tools/balance-report.ts`; chỉnh giá; test (a)(b)(c) |
| `8a4e308` | **R3** — test: có bọ → tưới → bọ còn, bắt được |
| `7983fd7` | **R4** — `clockOffsetMs`; thời gian game không lùi nhưng vẫn trôi |
| `33a3504` | **R5** — `src/persistence/reconcile.ts`: đối chiếu save với nội dung; chặn `harvests > 1` có `stages < 4` |
| `6492f6d` | **R6** — `.gitignore`, Art Style Guide mục 4 và 9, `tools/validate-content.ts` |
| `a8b864c` | Lưu `docs/DESIGN_SYSTEM.md`, `content/ui/design-tokens.json`; Art Style Guide mục 8 theo phong cách cổ tích (yêu cầu của chủ dự án) |

- **Cách hiểu đã chọn (ghi rõ để CTO duyệt):**
  1. **R2 — bọ đậu đến khi bắt hoặc thu hoạch**, không phải "đến hết giai đoạn" như gợi ý trong biên bản. Lý do: khi bọ chỉ ở trong một giai đoạn, người ghé thưa (2 giờ) gần như không bao giờ thấy bọ, và tiêu chí (c) không đạt được với bất kỳ số liệu nào. Khi bọ ở đến lúc thu hoạch, bọ/giờ ≈ thời gian sinh trưởng ÷ `growSecondsPerBug` cho mọi kiểu chơi hợp với cây. Thu hoạch mà chưa bắt thì bọ bay đi, cây không bị hại (đúng `GAMEPLAY_DESIGN.md` mục 6, đã cập nhật câu chữ).
  2. **"Kiểu chơi phù hợp với cây" (tiêu chí c)**: kiểu chơi mà cây đó đạt tỉ lệ xu/giờ cao nhất so với cây tốt nhất của kiểu đó (`fittingStyle` trong `tools/balance.ts`).
  3. **Tiêu chí (b)**: so với cây có `unlockLevel = 1` (Cúc Bông Gòn).
  4. **saveVersion**: biên bản ghi "R4 cần saveVersion 2". Vì R2 và R5 cũng đổi định dạng save, phiên bản đi từ 1 → 4 (2: `caughtBugs`, 3: `clockOffsetMs`, 4: `seedCost`), mỗi bước một migration và có test.
  5. **R5 — `seedCost`**: để "hoàn tiền hạt" khi cây bị gỡ khỏi nội dung thì cần biết đã trả bao nhiêu, nên lưu `seedCost` trong mỗi lần gieo. Save cũ được điền giá hạt hiện tại khi đọc.
  6. **R5 — kiểm tra cấu trúc**: `assertState` nay chỉ kiểm tra cấu trúc. Số liệu do `reconcile()` xử lý, để save trong máy có một con số hỏng vẫn được sửa thay vì bị coi là không đọc được.
- **Bảng cân bằng** (`docs/reports/2026-11-16-bang-can-bang.md`, 1 chậu cấp 1, 24 giờ, trung bình 5 hạt giống):

| Kiểu chơi | Cây nhiều xu nhất | Xu/giờ |
|---|---|---|
| Ghé mỗi 1 phút | Cà Chua Bi Ngọt | 269,8 |
| Ghé mỗi 15 phút | Dâu Tây Mây | 143,7 |
| Ghé mỗi 2 giờ | Hoa Đồng Tiền Vàng | 105,8 |

  Bọ/giờ của mỗi cây trong kiểu chơi phù hợp: 1,5–2,0 (chênh 1,3 lần; trước đây 79,1 so với 0,4).
- **File đã thay đổi:** `content/base/crops.json`, `content/base/bugs.json`, `src/core/{content,clock,game,state}.ts`, `src/systems/growth.ts`, `src/persistence/{migrations,serializer,saveManager,reconcile}.ts`, `tools/{balance,balance-report,validate-content}.ts`, `tests/{softlock,balance,reconcile}.test.ts` (mới), `tests/{economy,growth,offline,save}.test.ts`, `.gitignore`, `PROJECT_RULES.md`, `GAME_ROADMAP.md`, `CHANGELOG.md`, `docs/{ART_STYLE_GUIDE,GAMEPLAY_DESIGN,DESIGN_SYSTEM}.md`, `docs/reviews/`, `docs/reports/`, `content/ui/design-tokens.json`.
- **Cách kiểm thử đã chạy (lệnh + kết quả thực tế):**
  - `tsx --test tests/*.test.ts` → `tests 53 · pass 53 · fail 0`.
  - `tsc --noEmit -p .` → không lỗi. `npm run validate-content` → "Gói nội dung hợp lệ (v1): 1 tầng, 1 loại chậu, 6 giống cây, 1 loại bọ." (thử làm hỏng `bugs.json` → in lỗi.)
  - Kiểm chứng test thật sự bắt được lỗi cũ: R1 (giá hạt 1, bỏ kiểm tra) → 3/3 test trượt; R2(a) (giá cũ) → trượt, chỉ ra Hoa Đồng Tiền Vàng tốt nhất ở 2 kiểu chơi; R4 (hành vi đứng im cũ) → trượt.
  - Tự rà soát: bản đầu của test 10.000 lệnh vẫn **đạt với dữ liệu cũ** (không chạm tới trạng thái kẹt). Đã sửa: bộ sinh lệnh thiên về tiêu xu, trạng thái đầu gồm 0 xu và 40 xu + 2 bọ, kiểm tra cả trạng thái ban đầu.
- **Bằng chứng:** log test ở trên; bảng cân bằng trong `docs/reports/`.
- **Những gì CHƯA làm hoặc làm chưa tới:**
  1. Toàn bộ mục "Việc tiếp theo" của biên bản — làm ở bước sau.
  2. R3: không chạy lại được test mới trên mã cũ vì kiểu dữ liệu bọ đã đổi ở R2; bằng chứng là kịch bản tái hiện của CTO không còn xảy ra được về cơ chế (thời điểm bọ đến gắn với tiến độ, chỉ tăng).
  3. Typecheck vẫn chưa bao gồm `tests/` và `tools/` (cần `@types/node` trong `package.json`; sẽ thêm cùng bước cài gói).
  4. Điều khoản Leonardo AI: không đọc được trang giá chính thức (lỗi tải trang); thông tin lấy từ nhiều nguồn thứ cấp thống nhất với nhau. Chủ dự án nên tự kiểm lại trang giá trước đợt tạo ảnh đầu.
- **Rủi ro ảnh hưởng chức năng cũ:** cân bằng thay đổi (giá 3 cây, cơ chế bọ). Save bản 1–3 được migration lên bản 4 (đã test). Chưa có người chơi thật nên không ảnh hưởng ai.
- **Ghi chú bảo mật (`PROJECT_RULES.md` 7):** tác giả commit là `Claude <noreply@anthropic.com>` — không phải email cá nhân. Mục 7 yêu cầu dạng `...@users.noreply.github.com`; đề xuất CTO xác nhận dùng địa chỉ hiện tại hay đổi sang địa chỉ ẩn danh GitHub của chủ dự án.
- **Đã cập nhật CHANGELOG.md:** có.
