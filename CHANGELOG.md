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

### [2026-11-18] Chỉ thị 10 M6 (phần 1) — Xưởng Bọ (tag `m-10-m6a`)
- Loại: Thêm
- Mô tả: 4 máy (Máy Sấy Hoa cấp 6, Nồi Mứt 7, Máy Ép Nước 10, Máy Mài Ngọc 16), bọ thợ là hình bọ đã duyệt; hàng chờ 2 khe (mua tới 4), chạy nối tiếp, vẫn chạy khi tắt game; thành phẩm tự vào Rương Mây, kho đầy thì chờ trong máy; nâng sao 1–5 bằng bọ thợ + xu (nhanh hơn 5%/sao). Hàng chế biến là loại vật phẩm mới, bán được, giá = 1,5 × nông sản đầu vào (trần 1,6). Công thức theo cây (bổ sung A6.3), sinh bằng `tools/make-workshop.py` từ `crops.json` (chỉ đọc). Cửa sổ độc lập `openWorkshop()`, nút "Xưởng" tạm ở thanh trái (mở ở cấp 6). "Đá Quý Mài" đổi tên thành "Ngọc Mây".
- File/Module: `content/base/workshop.json` (mới), `src/systems/workshop.ts`, `src/ui/workshopPanel.ts`, `src/core/{content,game}.ts`, `tools/make-workshop.py`, `tools/make-quests.py`
- Ảnh hưởng save: Không đổi phiên bản (trường `workshop` đã có từ save 12).
- Kiểm thử: `tests/workshop10.test.ts` (6 bài: trần giá, khóa cấp, hàng chờ nối tiếp, tắt game 8 giờ = liên tục, kho đầy không mất, nâng sao). `npm run check` XANH.
- Ghi chú cho CTO: Máy Sấy Hoa tạm có công thức Cúc Bông Gòn cho tới khi có Hồng Mây (cấp 5); chạy lại `python3 tools/make-workshop.py` sau khi thêm cây. Ở D1 em đã sửa `tools/progression.ts` (bot nuôi chim) trước khi có PHAN_CONG.md; từ nay không đụng file này.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 11 đính chính D1 — BOT có chim (dùng chung luật chim), sửa 2 lỗi nhỏ (tag `m-10-d1`)
- Loại: Thêm / Sửa lỗi (P3)
- Mô tả: lõi chim tách thành `runBirds(owner)` dùng chung cho người chơi và BOT (lịch, đói/ngủ, lên cấp, hết hạn thuê, 5% bọ hiếm hơn, `newBird`, `addFood`); BOT thuê chim hợp họ cây thích, mua Hạt Kê và cho ăn; chim BOT bắt bọ trên vườn dựng theo tỉ lệ sinh bọ của luật đếm. Bot mô phỏng người chơi biết nuôi chim. Nút "Thêm chậu" ở hàng sau đứng giữa mặt cỏ; `demo('signature')` không lỗi khi chưa mở tầng 2.
- File/Module: `src/systems/{birds,botBirds,neighbors}.ts`, `src/persistence/reconcile.ts`, `src/core/state.ts`, `content/base/birds.json`, `tools/progression.ts`, `src/render/scene.ts`, `src/app/demo.ts`
- Ảnh hưởng save: Không đổi phiên bản. BOT trong save cũ được thêm `birds: []`, `bugs: {}` khi đọc.
- Kiểm thử: `tests/botBirds11.test.ts` (40 BOT × 7 ngày có chim; ±20% so với chim người chơi vừa: BOT 172/ngày, người chơi ~180/ngày; tất định liên tục = mở lại; 40 BOT × 7 ngày < 150 ms). `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 10 M5 — Tầng 1–4, vật phẩm mở tầng, đính chính D2–D5 (tag `m-10-m5`)
- Loại: Thêm / Sửa lỗi (P0: treo game khi tính giờ chín ở Vườn Trăng)
- Mô tả: tầng 4 Vườn Trăng Lơ Lửng (đêm lớn nhanh 25%, Đom Đóm Sao ×2); mở tầng 2–4 cần Sợi Mây Kết + Giọt Sương Trời (rơi 2% khi thu hoạch, quà bất ngờ); 6 → 10 ô xếp 2 hàng so le (D5); nút Chim qua features.json (D2); thông báo xếp hàng (D3); bỏ tên tầng trùng, tầng 5 cấp 19 (D4); 33 biểu tượng thật từ 7_bieu-tuong, hết biểu tượng tạm; npm run check.
- File/Module: `content/base/{floors,config,surprises,features,tutorials,materials}.json`, `src/systems/{growth,floors}.ts`, `src/render/scene.ts`, `src/ui/{toast,dom,potPanels,hint}.ts`, `tools/{check.ts,make-floors-10.py}`, `tools/art/build.py`
- Ảnh hưởng save: Không đổi phiên bản. Save có "tầng 4 sinh tự động" thành Vườn Trăng, giữ chậu và cây; tầng đã mở rộng giữ đủ ô (có test).
- Kiểm thử: `npm run check` XANH (typecheck, test, validate-content, build, mô phỏng 30 ngày); chỉ số kinh tế ngoài khoảng là cảnh báo, chỉnh ở M9.
- Trạng thái nghiệm thu: Chờ

### [2026-11-17] Chậu dựng bằng Blender — Đồ họa
- Loại: Thêm
- Mô tả: Xưởng chậu Blender (`tools/potgen`), atlas 50 cấp Chậu Phượng Hoàng và 50 dòng chậu cấp 50; đề xuất định nghĩa 51 chậu (`content/proposals/pots_blender.json`, chưa nạp).
- File/Module: `assets/art/pots_*.webp/.json`, `tools/potgen/`, `content/proposals/`, `docs/reviews/2026-11-17-directive-03-chau-blender.md`
- Ảnh hưởng save: Không
- Kiểm thử: atlas kiểm tra đặt ô (ảnh `docs/reports/2026-11-17-chau-blender/kiem-tra-o-chau.jpg`); chưa nối vào mã game — xem chỉ thị 03
- Trạng thái nghiệm thu: Chờ developer nối vào game

### [2026-11-16] Tái thiết kế v2 theo đối chiếu Khu Vườn Trên Mây — giai đoạn 1–4
- Loại: Thêm / Sửa lỗi / Thay đổi
- Mô tả: kiểm toán + bảng đối chiếu; tài liệu REDESIGN_V2; tầng 6→10 chậu có ô Thêm chậu; sao tầng; bộ chậu + bậc ngoại hình (hào quang, đốm sáng); vòng sáng thu hoạch; khay hạt kéo-thả; Nhiệm Vụ Hôm Nay; thăm vườn hàng xóm BOT và giúp tưới/bắt bọ; sửa game đứng hình khi hoạt ảnh chạy trên vật thể đã huỷ; tên tầng chưa mở không còn bị HUD đè; câu lệnh đồ họa §11.7.
- File/Module: content/base/{floors,pots,potsets,missions,neighbors,config,manifest}.json; src/core/{content,state,game}.ts; src/systems/{floors,missions,visit,modifiers}.ts; src/persistence/{migrations,reconcile}.ts; src/render/{scene,slotView,garden,tween}.ts; src/ui/{gardenPanels,hud,worldPanels,text}.ts; src/app/{controller,demo}.ts; tools/shots.ts; docs/REDESIGN_V2.md; docs/research/; docs/reports/2026-11-16-tai-thiet-ke-v2.md
- Ảnh hưởng save: Có (6 → 7, migration giữ nguyên 10 ô cũ, sao 0, nhiệm vụ/lượt giúp trống)
- Kiểm thử: `npm test` 81/81; `npm run test:browser` 7/7 (Chrome swiftshader); ảnh chụp `tools/shots.ts` trong docs/reports/tai-thiet-ke-v2/. Chưa thử iPad thật.
- Trạng thái nghiệm thu: Chờ

### [2026-11-16] Nhiều tầng mây + chậu có buff — mở rộng giai đoạn 1, phần 1 (quyết định chủ dự án)
- Loại: Thêm
- Mô tả: 3 tầng mây có đặc tính môi trường, vuốt dọc theo cây leo, tầng kế tiếp hiện mờ kèm điều kiện, mở tầng có hoạt ảnh (camera lướt, tầng nảy lên, chậu hiện lần lượt, pháo vàng); 7 loại chậu / 5 độ hiếm với 5 chỉ số và hệ ưa thích; Lò Gốm Bà Mây (mua chậu), kho chậu, đổi chậu từ Sạp Hạt Giống hoặc Bàn Thợ Gốm. Chậu và tầng chưa có ảnh riêng dùng ảnh có sẵn đổi màu (chờ đồ họa đợt 2).
- File/Module: `content/base/{config,floors,pots}.json`, `src/core/{content,game,state}.ts`, `src/systems/{growth,modifiers}.ts`, `src/persistence/{migrations,reconcile,serializer}.ts`, `src/render/{assets,scene,slotView}.ts`, `src/ui/{panel,panels,potPanels,hud,hint,text}.ts`, `src/app/controller.ts`, `src/styles.css`, `tests/`
- Ảnh hưởng save: Có — saveVersion 4 → 5 (`potStock`), có migration và test
- Kiểm thử: `npm test` 60/60; `npm run test:browser` 5/5 (thêm: vuốt lên, mở tầng, mua chậu, đặt chậu qua giao diện). Chưa chạy trên Safari iPad.
- Trạng thái nghiệm thu: Chờ

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
