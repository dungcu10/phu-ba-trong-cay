# Chỉ thị 04 + Review 03 — báo cáo cuối

Ngày 17/11/2026. Người làm: Claude (phiên code). Gửi CTO kiểm tra.

## 1. Mã commit theo từng việc

| Việc | Nhánh | Commit | Nội dung |
|---|---|---|---|
| 1. Render (lần 2, đủ 50) | art/blender-pots | `5d6f7af` | 50 chậu, sửa #35, #11, status.json, tờ xem trước |
| Review 03: render lại 12 chậu | art/blender-pots | `951bb6c` | `--levels 3,9,12,17,18,19,24,28,35,43,45,47` trên thiết kế `b7f16ea` |
| 2. Đóng gói | art/blender-pots | `951bb6c` | `assets/art/pots_signature.webp/.json`, ASSET_SOURCES |
| 3. Gắn vào game | feat/full-loop | `873fcdf` (gộp art/blender-pots), `ed94309`, `e17dd05` | chậu mới, retired, Lò Gốm 5 nhóm, kiểm thử |
| 4. Bản thử | gh-pages | `7f64ce2` ("Bản thử từ e17dd05") | không merge vào main |

Ảnh chụp trong game được build từ `e17dd05`, nhãn trên màn hình là **BẢN THỬ · e17dd05**, khớp commit.

## 2. Render

- `status.json`: lần chạy đủ 50 chậu (done 50, errors [], CPU, 1397 giây).
- `status_lan3_12chau.json`: lần render lại 12 chậu theo Review 03 (12/12, không lỗi, 259 giây).
- Máy: bpy 5.3.0 (Blender dạng mô-đun Python), Cycles **CPU** 2 nhân, cảnh `studio_cream`, 96 mẫu, 1024 px, OIDN. Đã ghi vào `assets/ASSET_SOURCES.md`.
- Tờ xem trước 50 chậu bản cuối: `signature_all_preview_final.jpg`.

### Chậu còn lỗi hình sau khi render lại (đã ghi, không dừng chờ)

| Chậu | Lỗi | Nguyên nhân / đề xuất |
|---|---|---|
| #35 Rổ Tre Nón Lá | Cái nón lá trông như quả cầu vàng, không ra hình nón | Do tư thế tôi đặt ở lần 1 (`rot [62,0,-20]`) làm đáy nón quay thẳng vào camera. Đề xuất: nghiêng ít hơn, ví dụ `rot [-18,0,-20]`, để nhìn thấy chóp nón. Cần sửa trong `build_signature_all.py` (không sửa tay JSON) — chờ CTO duyệt. |
| #9 Sushi Cá Hồi | Miếng cá hồi vẫn là tấm phẳng như nắp | Thiết kế mới của CTO chưa đủ độ cong/độ dày; đề xuất thêm vân sọc trắng và uốn cong mép. |
| #4, #7, #21, #22, #50 | Vẫn ở mức "yếu" như Review 03 nhận xét | Không thay đổi trong lần này (không nằm trong danh sách render lại). |

Các chậu còn lại trong 12 chậu render lại đạt yêu cầu khi soi bằng mắt.

## 3. Atlas

| File | Kích thước trang | Dung lượng |
|---|---|---|
| `assets/art/pots_signature.webp` | 4061 × 817 (1 trang, ≤ 4096) | **558.590 byte (546 KB)**, WebP chất lượng 90, giữ alpha |
| `assets/art/pots_signature.json` | 50 khung `pots/sig/NN/50`, mỗi khung có `anchor` và `soil` | 17.546 byte |

PNG trước khi đổi: 2.309.845 byte (đã xóa). Tổng WebP mới 546 KB, dưới hạn 3 MB nên không cần giảm BODY_PX hay chia trang.

## 4. Gắn vào game (feat/full-loop)

- 50 chậu cũ `base:pot.NN-…`: giữ nguyên id, thêm `"retired": true`. Không bán (cả UI lẫn lệnh `buyPot` đều trả `not_for_sale`), ẩn khỏi Lò Gốm. Chậu cũ đã có vẫn tải được, vẫn trồng và thu hoạch, vẫn hiện hình cũ.
- 50 chậu mới `base:pot.sig-NN-<slug>`: tên và nhóm lấy từ `signature_all.json`, `sprite: "pots/sig/NN"`. Các trường `rarity`, `price`, `unlockLevel`, `favoredFamily`, `levelRule`, `set`, `group` chép nguyên từ chậu cũ số N, không đặt số mới. Phần này sinh bằng `tools/make-signature-pots.mts`, chạy lại cho kết quả như cũ.
- Atlas `pots_signature` được nạp cùng cơ chế `Art.pot`: lấy cấp cao nhất ≤ cấp hiện tại, nếu không có thì lấy cấp thấp nhất (atlas này chỉ có cấp 50). Cây đứng theo `soil`. Đã soi trên ảnh: #38 Bình Men Ngọc và #48 Ngai Vàng (có chân đế), #39 Bát Tràng và #47 Đèn Thần (dáng thấp) — cây đều đứng đúng mặt đất, không lơ lửng, không chìm.
- Lò Gốm có 6 tab: **Cơ bản (6)** cho các chậu cũ không thuộc nhóm nào, rồi **Đồ ăn / Linh vật / Thiên nhiên / Gốm Á Đông / Thần thoại** (mỗi tab 10 chậu).
- Không đụng gameplay, BOT, lưu offline hay số liệu cây.

### Điểm làm khác chỉ thị / cần CTO biết

1. Nhóm cửa hàng được lưu ở trường mới `theme`, không dùng `group`, vì trong code `group` đã có nghĩa là nguồn của chậu (shop/daily/event…). Validator kiểm tra cả `theme` và `retired`.
2. Ngoài cửa hàng, chậu retired còn được ẩn ở ba chỗ khác cho nhất quán: danh sách Bộ Sưu Tập (trừ khi người chơi đã có chậu đó), câu thông báo "Lò Gốm có…" khi lên cấp, và vườn hàng xóm (`visit.ts`, chỉ là phần hiển thị). Logic BOT không đổi.
3. Atlas `pots_catalog` (29,5 MB texture) vẫn được nạp, vì chậu retired mà người chơi đang có vẫn cần hình. Đề xuất cho sau: chỉ nạp atlas này khi save có chậu retired.
4. Nút "Đo hiệu năng" và `demo('signature')` giờ dựng 2 tầng × 10 chậu đặc trưng cấp 50 có cây đang lớn (trước đây dùng chậu catalog).

### Kiểm thử — log nằm trong `log/`

- `npm run typecheck` → exit 0
- `npm test` → 100/100 đạt (thêm `tests/signature-pots.test.ts`, 5 kiểm thử):
  - atlas là WebP, đủ 50 khung có anchor/soil, trang ≤ 4096;
  - 50 chậu mới có id/tên/nhóm đúng bảng, sprite có khung trong atlas;
  - chỉ số kinh tế và các cấp trùng khớp với chậu cũ số N;
  - chậu retired không có trong cửa hàng và không mua được;
  - save có `base:pot.NN-…` cấp 50 lưu rồi tải lại không lỗi, chậu vẫn trồng và thu hoạch được.
- `npm run build` → exit 0. `pots_signature-*.webp` 558,59 kB nằm trong danh sách precache của Service Worker.
- `npm run validate-content` → hợp lệ, 108 loại chậu.

## 5. Ảnh trong game (1194×834, build `e17dd05`)

- `game-tang-10-chau.png`: tầng Đồng Mây Ngọc với 10 chậu mới, 2 chậu mỗi nhóm: #1, #9, #11, #16, #22, #26, #38, #39, #47, #48. Tất cả đều có cây.
- `game-lo-gom-tab0.png` … `tab5.png`: Lò Gốm mở lần lượt ở tab Cơ bản, Đồ ăn, Linh vật, Thiên nhiên, Gốm Á Đông, Thần thoại.
- Không có lỗi console (Chrome headless).

## 6. Hiệu năng (nút Đo hiệu năng)

Đo trong Chrome headless dùng **SwiftShader**, tức GPU giả lập bằng CPU (`do-hieu-nang-chrome.png`):

```
renderer webgl · 1194×834 @1x · FPS trung bình 7,1 · thấp nhất 4,9 · 1% thấp 4,9
texture (MB): sprites 16 · scene 16 · pots_phoenix 17 · pots_catalog 29,5 · pots_signature 12,7 · sky 3,9 → tổng 95,1
```

- **Bộ nhớ texture tăng thêm do atlas mới: +12,7 MB** (4061×817×4 byte). Con số này đúng trên mọi máy.
- Con số FPS ở trên **không đại diện cho iPad**, vì SwiftShader vẽ bằng CPU. Chủ dự án cần mở bản thử với `?dev=1` trên iPad Pro M2 rồi bấm **Đo hiệu năng** để có số thật (kết quả hiện ngay trên màn hình).

## 7. Safari / WebKit

Không kiểm tra được ở đây: lệnh `npx playwright install webkit` bị chặn tải. WebP có alpha được Safari hỗ trợ từ iOS 14. Hai atlas WebP của chỉ thị 03 dùng cùng định dạng và đã chạy trên bản thử trước. Khi mở bản thử trên iPad, chủ dự án cần xác nhận chậu đặc trưng hiện đúng hình.

## 8. Bản thử

https://dungcu10.github.io/phu-ba-trong-cay/ — Service Worker cache `pbtc-0.0.1-e17dd05`. Thêm `?dev=1` để có nút Đo hiệu năng. Nếu iPad đang mở bản cũ: đóng hết tab của game rồi mở lại để bản mới chạy.
