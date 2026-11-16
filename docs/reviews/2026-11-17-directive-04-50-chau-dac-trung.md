# CHỈ THỊ 04 — Render và đưa bộ 50 chậu đặc trưng vào game

- Người ra chỉ thị: CTO (Claude). Chủ dự án (Dũng) đã duyệt bản phác cả 50 mẫu ngày 17/11/2026.
- Người thực hiện: Claude thực thi.
- Nhánh nguồn: `art/blender-pots` (commit mới nhất). Nhánh game: `feat/full-loop`.
- Ưu tiên: CAO. Chủ dự án muốn thấy kết quả trên game sớm nhất.

## 0. Bối cảnh

Bộ 50 chậu "danh mục" cũ (`pots/catalog/01..50`) bị chủ dự án chê: na ná nhau, không sáng tạo.
Đã làm lại thành 50 chậu **đặc trưng**, mỗi chậu một dáng và một chi tiết nhận diện riêng, chia 5 nhóm x 10:

| Số | Nhóm | Chậu |
|---|---|---|
| 1–10 | Đồ ăn | Bánh Kem Sinh Nhật, Trà Sữa Trân Châu, Kem Ốc Quế, Donut Cầu Vồng, Bánh Bao, Dưa Hấu, Macaron, Bánh Flan, Sushi Cá Hồi, Cupcake |
| 11–20 | Linh vật | Phi Hành Gia Mèo, Cáo Chín Đuôi, Thỏ Ngọc, Rồng Con, Cá Koi, Gấu Trúc, Chim Cánh Cụt, Ếch Lá Sen, Cú Mèo, Heo Đất |
| 21–30 | Thiên nhiên | Nấm Rừng Đỏ, Vỏ Sò Ngọc Trai, Tổ Ong, Hang Pha Lê, Đám Mây Cầu Vồng, Hoa Sen, Bí Ngô, Quả Thông, Bong Bóng Xà Phòng, Gốc Cây Rêu |
| 31–40 | Gốm Á Đông | Gốm Sứ Thanh Hoa, Sơn Mài Son Vàng, Đèn Lồng Hội An, Trống Đồng, Rổ Tre Nón Lá, Ấm Tử Sa, Hũ Men Nâu, Bình Men Ngọc, Bát Tràng Men Lam, Bình Hồ Lô Đỏ |
| 41–50 | Thần thoại | Phượng Hoàng Lửa, Kỳ Lân, Thiên Nga Ngọc, Rồng Ngọc, Long Cung, Cung Trăng, Đèn Thần, Ngai Vàng Thiên Giới, Thiên Thần, Hồ Điệp Tiên |

Nguồn sự thật: `tools/potgen/lines/signature_all.json` (sinh từ `tools/potgen/tools/build_signature_all.py`).
**Không sửa tay file JSON**; muốn đổi thiết kế thì sửa script sinh rồi chạy lại, và phải báo CTO.

## 1. Việc 1 — Render 50 chậu bằng Blender (trên máy Windows của chủ dự án)

1. `git fetch && git checkout art/blender-pots && git pull`.
2. Tìm Blender 5.2: thường ở `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Kiểm tra bằng `blender --version`.
3. Chạy render nền (không mở giao diện), từ thư mục gốc repo:

   ```
   "<đường dẫn>\blender.exe" -b --factory-startup -P tools/potgen/blender/render_catalog.py -- --line tools/potgen/lines/signature_all.json --levels 1-50 --out tools/potgen/out
   ```

   - Script tự dùng nền kem `studio_cream.json`, GPU CUDA (OptiX đã biết bị lỗi biên dịch trên máy này, đừng bật).
   - Kết quả: `tools/potgen/out/signature_all/` gồm `master/pot_NN.png` (1024px, nền trong suốt), `game/`, `preview/signature_all.png` (tờ xem trước 50 chậu), `manifest.json`, `status.json`.
   - Một chậu lỗi không làm dừng cả loạt; xem `status.json` mục `errors`.
4. **Thư mục `tools/potgen/out/` KHÔNG được commit** (ảnh master nặng). Thêm vào `.gitignore` nếu chưa có.

### Tiêu chí nghiệm thu việc 1

- `status.json`: `"state": "done"`, `errors` rỗng, đủ 50 chậu.
- Mở `preview/signature_all.png`. Từng chậu phải:
  - không bị cắt khung;
  - không có mảnh rời lơ lửng sai chỗ (tai, sừng, vòi ấm phải dính vào thân);
  - không có mặt đen hoặc thủng do pháp tuyến ngược;
  - chi tiết nhận diện thấy rõ ở kích thước nhỏ.
- **DỪNG lại, gửi tờ xem trước cho chủ dự án và CTO trước khi làm việc 2.** Ghi rõ chậu nào lỗi và lỗi gì. Nếu phải sửa hình học, sửa trong `tools/potgen/blender/potlib.py` hoặc `build_signature_all.py`, chạy lại **chỉ các chậu lỗi** (`--levels 7,23`) và ghi vào báo cáo.

## 2. Việc 2 — Đóng gói atlas cho game

1. Cần Python có Pillow (dùng môi trường ảo, không cài vào hệ thống).
2. Chạy:

   ```
   python tools/potgen/tools/pack_pots.py tools/potgen - - assets/art tools/potgen/out/signature_all/master
   ```

   Lệnh này sinh `assets/art/pots_signature.png/.json`. Khung tên `pots/sig/NN/50`, có `anchor` = điểm chạm đất và `soil` = khoảng cách lên mặt đất (px @2x), giống chuẩn chỉ thị 03.
3. Chuyển sang WebP (chất lượng 90, giữ alpha), sửa `meta.image` trong JSON thành `.webp`, xóa file `.png`, như đã làm với `pots_catalog`.
4. Yêu cầu dung lượng:
   - Mỗi trang atlas ≤ 4096×4096.
   - Tổng WebP của bộ mới ≤ 3 MB. Nếu vượt, giảm `BODY_PX` hoặc chia trang, báo số liệu.

## 3. Việc 3 — Gắn vào game (nhánh `feat/full-loop`)

Hiện `content/base/pots.json` đang có 50 mục `base:pot.01-…` đến `base:pot.50-…` dùng `pots/catalog/NN`.

1. **Không đổi và không xóa id cũ.** Có thể đã có save đang giữ các chậu này.
   - Đánh dấu 50 mục cũ là đã ngừng bán (ẩn khỏi cửa hàng nhưng vẫn tải được). Nếu schema chưa có cờ, thêm `"retired": true` vào schema, validator và code cửa hàng.
   - Chậu cũ người chơi đang sở hữu vẫn hiển thị và chạy đúng.
2. Thêm 50 mục mới:
   - id dạng `base:pot.sig-NN-<slug-khong-dau>`; tên lấy từ `signature_all.json`; `sprite: "pots/sig/NN"`; `group` theo bảng trên.
   - **Kinh tế:** chậu mới số N thừa hưởng nguyên các trường cân bằng của chậu cũ số N (`rarity`, `price`, `unlockLevel`, `favoredFamily`, `levelRule`, `set`).
   - Không tự đặt số mới. Cân bằng lại là việc riêng, cần chủ dự án duyệt.
3. Nạp atlas `pots_signature` cùng các atlas chậu hiện có, đúng cơ chế `Art.pot`: chọn khung có cấp cao nhất ≤ cấp hiện tại, nếu không có thì lấy khung thấp nhất. Bộ này chỉ có ảnh mốc 50 nên mọi cấp đều dùng ảnh đó. Ảnh tiến hóa theo cấp là giai đoạn sau, không làm bây giờ.
4. Cây đặt đúng mặt đất theo `soil` của khung (công thức giống chỉ thị 03). Kiểm tra trên các chậu có đế đứng (Bình Men Ngọc #38, Ngai Vàng #48) và các chậu thấp (Bát Tràng #39, Đèn Thần #47).
5. Cửa hàng hiển thị theo 5 nhóm (tab hoặc tiêu đề nhóm).
6. Không đụng tới gameplay, BOT, lưu offline, hay số liệu cây trồng.

### Tiêu chí nghiệm thu việc 3

- `npm run typecheck`, `npm test`, `npm run build` đều sạch. Dán log rút gọn vào báo cáo.
- Thêm test:
  - đủ 50 mục `sig` với sprite hợp lệ, và mỗi sprite có khung trong atlas;
  - mục cũ retired không xuất hiện trong cửa hàng;
  - save cũ đang chứa chậu `base:pot.NN-…` tải được và không crash.
- **Ảnh chụp thật** (khung 1194×834, mô phỏng iPad Pro 11 ngang):
  - 1 tầng mây có 10 chậu mới khác nhóm có cây;
  - cửa hàng mở ở từng nhóm.
- **Hiệu năng:**
  - FPS khi một tầng có 10 chậu và cây đang lớn;
  - bộ nhớ texture tăng thêm bao nhiêu MB sau khi nạp atlas mới.
- Kiểm tra trên Safari iOS (hoặc WebKit nếu không có iPad): ảnh WebP hiển thị đúng, không lỗi console.

## 4. Việc 4 — Bản thử

- Triển khai bản thử lên GitHub Pages theo PROJECT_RULES mục 4.4: nhãn "BẢN THỬ" + mã commit. Gửi link cho chủ dự án.
- **Không merge vào `main`** khi chưa được chủ dự án duyệt.

## 5. Báo cáo bắt buộc

Báo cáo gửi chủ dự án và CTO gồm:

- commit hash từng việc;
- `status.json`;
- tờ xem trước 50 chậu;
- danh sách chậu lỗi và cách sửa;
- kích thước atlas;
- log test;
- 2 ảnh chụp trong game;
- số FPS và bộ nhớ;
- link bản thử.

**Không báo "xong" nếu thiếu bằng chứng. CTO sẽ tự kiểm tra lại từng mục.**

## 6. Không làm trong chỉ thị này

- Không cân bằng lại giá hay chỉ số.
- Không làm ảnh tiến hóa nhiều cấp, hoạt ảnh tách lớp hay bản shiny. Các việc này để chỉ thị sau.
- Các lỗi R1–R6 của review 01 nếu còn tồn đọng: xử lý trên nhánh hoặc PR riêng, không trộn vào thay đổi này.
