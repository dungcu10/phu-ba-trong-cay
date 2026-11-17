# CHỈ THỊ 07 — Sạp hai chiều (mua được của người khác) + nhiều Phú Bà hơn

Quyết định của chủ dự án, 17/11/2026: "Sạp có thể bán và mua được của người khác. Phú Bà nhiều hơn, hiện tại thấy ít quá."

**Hiện trạng** (`feat/nang-cap-v3` @ 75c2d00):
- Sạp chỉ một chiều: người chơi bày hàng, hàng xóm BOT ghé mua (`src/systems/neighbors.ts`).
- Chỉ có 10 BOT trong `content/base/neighbors.json`.

## 1. Sạp hai chiều: Chợ Mây
- **Mỗi BOT có sạp riêng**, lưu trong save.
  - Mỗi phiên (theo `sessionMinutes`), BOT có thể bày tối đa 4 món tùy tính cách:
    - `trader` bày nhiều, giá sát;
    - `collector` bày đồ đột biến hiếm, giá cao;
    - `diligence` thấp thì bày ít.
  - Hàng gồm: nông sản (kể cả loại người chơi chưa mở khóa), bọ, nguyên liệu nâng chậu (`cloud-clay`, ấn công trạng).
  - **Không bao giờ bán**: chậu, ngọc, vật phẩm chỉ có từ sự kiện.
- **Màn Chợ Mây** (mở từ nút Sạp), 2 tab:
  - **"Sạp của tôi"**: như bây giờ.
  - **"Đi chợ"**: lưới sạp các Phú Bà. Mỗi sạp hiện ảnh đại diện, tên, cấp và các món đang bày. Có lọc theo loại hàng và nút "Tìm món cho đơn hàng": tự lọc ra món còn thiếu cho đơn khinh khí cầu đang mở.
- **Mua:** trừ xu người chơi, cộng xu cho BOT, chuyển món vào Rương Mây, tăng tình thân. Rương đầy thì không cho mua và báo rõ.
- **Chống phá kinh tế:**
  - giá bày ≥ 1,25 × giá bán cho cửa hàng, nên **không có lãi khi mua rồi bán lại**;
  - mỗi món giới hạn số lượng;
  - mỗi ngày mua tối đa 20 lượt từ chợ;
  - nông sản chưa mở khóa đắt hơn ×1,6.
- Mọi việc vẫn chạy offline, xác định theo thời gian (giả lập 8 giờ một lần hay từng phút phải ra cùng kết quả, như phiên BOT hiện có).

## 2. Nhiều Phú Bà hơn
- **Tăng từ 10 lên 40 BOT.**
  - Tên tiếng Việt đa dạng, không trùng; mỗi người một biệt danh kiểu "Phú Bà Hồ Tây", "Bà Chủ Vườn Lan".
  - Tính cách (traits) và cây yêu thích trải đều; ảnh đại diện ghép từ bộ phận (tóc, áo, phụ kiện) để không trùng mặt.
  - Cấp trải từ thấp hơn người chơi 5 cấp đến cao hơn 15 cấp; vài "đại gia" đầu bảng cấp cao hẳn để có mục tiêu đuổi theo.
- **Bảng Phú Bà:**
  - xếp hạng theo tài sản (xu + giá trị chậu + vườn);
  - có 3 tab: **Toàn vùng** (40 người), **Quanh tôi** (±5 hạng) và **Bạn thân** (tình thân cao);
  - hạng thay đổi theo phiên, có mũi tên lên/xuống;
  - bấm một Phú Bà để thăm vườn hoặc ghé sạp của họ.
- **Hiệu năng:**
  - 40 BOT × phiên phải tính xong < 50 ms khi mở game sau 7 ngày offline (đo bằng test);
  - bảng xếp hạng cuộn mượt 60 FPS (danh sách ảo nếu cần).

## 3. Kiểm tra bắt buộc
- Test:
  - không có vòng mua–bán ra lãi;
  - giới hạn mua mỗi ngày;
  - rương đầy;
  - giả lập 8 giờ một lần và từng phút cho cùng kết quả;
  - save cũ (10 BOT) nâng lên 40 BOT không mất tình thân và lịch sử;
  - thời gian tính 7 ngày offline.
- Ảnh 1194×834: Chợ Mây ở 2 tab, Bảng Phú Bà ở 3 tab, một lần mua thành công.
- Typecheck, test, build xanh. Bản thử có nhãn BẢN THỬ + mã commit.

## Lưu ý giao diện
Giao diện mới (chỉ thị 06, hướng **Fantasy cao cấp** đang được chủ dự án duyệt trên bảng thiết kế) sẽ áp sau. Ở chỉ thị này: làm đúng logic và bố cục, dùng component hiện có. Không tự đổi phong cách.
