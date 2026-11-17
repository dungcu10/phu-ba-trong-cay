# BỔ SUNG CHỈ THỊ 12 TỔNG — MỤC A6 MỚI: HỆ THỐNG CÂY TRỒNG

Ngày 18/11/2026. File này **thay toàn bộ mục A6** trong `CHI_THI_12_TONG_CAN_BANG_HAP_DAN.md` đã gửi trước đó, tức là bỏ kế hoạch 18 cây cũ. Các phần khác của mọi chỉ thị **giữ nguyên**.

Hình cây nằm trong thư mục `8_cay-trong/`, gồm 8 file. Chép thư mục này vào `PhuBa_BoHinh_v1/`.

## A6. HỆ THỐNG CÂY TRỒNG: 14 CÂY, 4 HỆ, 4 NHỊP (thay hoàn toàn bản kế hoạch 18 cây trước đây)

**Hình đã có đủ:** 8 cây mới nằm trong `8_cay-trong/`. Mỗi file là một hàng 6 hình, từ trái sang phải: giai đoạn 1 → giai đoạn 5, rồi biểu tượng nông sản.

**Xử lý hình:**
- Tách nền trắng, cắt rời từng hình, phóng to 2 lần.
- Đổi màu đống đất ở giai đoạn 1 từ đen sang nâu, cho giống các cây cũ.
- Đặt điểm neo ở gốc cây, để cây đứng đúng trong miệng chậu (dùng lại cơ chế `soil`, `mouth`, `plantFit` đã có).
- Cây mới có nét viền mảnh hơn cây cũ một chút. Chấp nhận, không vẽ lại.

### A6.1. Bảng cây

Mỗi hệ có đủ 4 nhịp: **Nhanh** (dưới 15 phút), **Vừa** (15 phút đến 1 giờ), **Dài** (2–6 giờ), **Qua đêm** (8–12 giờ). Riêng hệ Kỳ Hoa sẽ đủ 4 nhịp sau gói cập nhật đầu tiên.

| Cấp mở | Cây | Hệ | Thời gian | Nhịp | Mới / cũ |
|---|---|---|---|---|---|
| 1 | Cúc Bông Gòn | Hoa | 1 phút | Nhanh (dùng cho hướng dẫn) | cũ |
| 2 | Cà Chua Bi Ngọt | Quả | 5 phút | Nhanh | cũ |
| 3 | Bạc Hà Mây | Rau Thảo | 15 phút | Vừa | cũ |
| 4 | Cà Rốt Mây | Rau Thảo | 30 phút | Vừa | cũ |
| 5 | **Hồng Mây** | Hoa | 10 phút | Nhanh | mới |
| 6 | Dâu Tây Mây | Quả | 45 phút | Vừa | cũ |
| 7 | **Táo Đỏ Mây** | Quả | 20 phút | Vừa | mới |
| 8 | **Cải Mây** | Rau Thảo | 8 phút | Nhanh | mới |
| 9 | Hoa Đồng Tiền Vàng | Hoa | 2 giờ | Dài | cũ |
| 11 | **Hướng Dương Nắng** | Hoa | 3 giờ | Dài | mới |
| 12 | **Hoa Trăng Non** | Kỳ Hoa | 4 giờ (ban đêm lớn nhanh gấp đôi) | Dài | mới |
| 14 | **Bí Ngô Vàng** | Rau Thảo | 8 giờ | Qua đêm | mới |
| 16 | **Cỏ Sao Băng** | Kỳ Hoa | 6 giờ | Dài | mới |
| 20 | **Đào Tiên** | Quả | 12 giờ | Qua đêm | mới |

- Cấp 10, 13, 15, 17–19: không có cây mới, vì những cấp này đã có tầng, nhà và chim mới (bảng mở khóa của chỉ thị 11 TỔNG).
- **Dành sẵn chỗ cho các gói cập nhật sau:** cấp 22, 24, 26, 28, 30… mỗi gói thêm 3–4 cây. Ưu tiên: Hoa qua đêm, Kỳ Hoa nhanh và vừa, rồi tới cây Kỳ Hoa qua đêm.
- **Không đổi** thời gian, giá hạt và giá bán của 6 cây cũ.

### A6.2. Công thức giá trị: một quy tắc duy nhất cho mọi cây, kể cả cây sau này

Đặt hàm trong dữ liệu (`crops.json` có thêm khối `valueCurve`). Số liệu của cây mới **tính bằng công thức này**, không đặt tay:

- **Giá trị một lần thu** = `k × (số giây)^0,75 × hệ số hệ`.
  - Cây càng dài thì **mỗi lần chạm được nhiều hơn**, nhưng **mỗi giờ được ít hơn**.
  - Kết quả: người chơi siêng thì trồng cây ngắn để kiếm nhiều hơn mỗi giờ, người bận thì trồng cây dài cho tiện. Cả hai cách đều đáng.
- **Hệ số hệ:** Hoa 1,0 · Quả 1,05 · Rau Thảo 0,95 · Kỳ Hoa 1,25. Kỳ Hoa đắt hơn nhưng cần tầng phù hợp và có hiệu ứng đặc biệt.
- **Giá hạt** khoảng 45–55% giá trị một lần thu. **Kinh nghiệm** theo cùng đường cong, có hệ số riêng.
- **Cây qua đêm** được thêm 15% giá trị một lần thu, vì người chơi phải chờ lâu.
- Chọn `k` sao cho 6 cây cũ khớp công thức với sai lệch không quá ±15%. Cây cũ nào lệch thì để nguyên, ghi vào báo cáo.

### A6.3. Mỗi cây có ít nhất 3 công dụng (nối vào các hệ đã có)

| Công dụng | Hoa | Quả | Rau Thảo | Kỳ Hoa |
|---|---|---|---|---|
| **Xưởng** (chỉ thị 10) | Máy Sấy Hoa: Hồng, Đồng Tiền, Hướng Dương | Nồi Mứt: Dâu, Táo, Đào Tiên | Máy Ép Nước: Cải, Cà Rốt (cộng 1 quả) | Máy Mài Ngọc: khoáng cộng Trăng Non hoặc Sao Băng → Ngọc Mây |
| **Bọ Khá đặc trưng** | Bướm Phấn Hồng | Cánh Cam Ngọc | Châu Chấu Sương | Đom Đóm Sao (đêm), Ve Sầu Ngọc (rất hiếm, chỉ cây ≥ 4 giờ) |
| **Thức ăn chim** | Sẻ Mây | Bói Cá Ngọc | Chích Chòe Lá | Cú Mèo Đêm |
| **Thức ăn thú cưng** (chỉ thị 11) | Mèo | Cáo | Sẻ Mầm | Rồng (qua Ngọc Mây) |
| **Đặc tính tầng** | — | Ruộng Bậc Thang: +sản lượng | Vườn Trà: +tốc độ | Vườn Trăng: ban đêm lớn nhanh, thêm biến dị |
| **Mồi câu** | — | Hũ Mứt → Mồi Thơm | Rau Thảo → Mồi Thường | — |

- Mọi cây đều có trong đơn khinh khí cầu và Chợ.
- Bọ Hung Vàng chỉ xuất hiện ở cây ≥ 2 giờ, đúng như mục B6.

### A6.4. Thông Thạo cây (mở rộng Sổ Tay đã có, để cây cũ không bị bỏ)

**Hiện trạng:** Sổ Tay đã có mốc thu hoạch 1 / 10 / 50 / 200 / 1.000, thưởng ngọc.

**Thêm:** mỗi mốc mở 1 sao Thông Thạo cho riêng cây đó.

| Sao | Thu hoạch | Thưởng thêm |
|---|---|---|
| ★1 | 10 | Cây đó cho thêm 3% sản lượng |
| ★2 | 50 | Thêm 5% kinh nghiệm |
| ★3 | 200 | Thêm 5% tỉ lệ biến dị |
| ★4 | 1.000 | Thêm 5% sản lượng (tổng 8%) |
| ★5 | 3.000 (mốc mới) | Huy hiệu vàng trên Sổ Cây, và cây đó có ánh vàng khi chín |

- Thưởng Thông Thạo tính chung vào **trần 60%** của tổng thưởng.
- Mục đích: cây cũ vẫn đáng trồng, và có thêm một trục sưu tập dài hạn.

### A6.5. Cây Hot trong ngày (mở rộng `market.dailyPriceVariation` đã có)

- Mỗi ngày chọn 1 cây đã mở làm **Cây Hot**, theo seed ngày.
  - Giá bán ở Chợ +30%.
  - Đơn khinh khí cầu có cây Hot được thưởng thêm 20% xu.
- Bảng chọn hạt có nhãn "Hot hôm nay".
- Mục đích: mỗi ngày người chơi có lý do đổi cây đang trồng, và vườn trông đa dạng hơn.

### A6.6. Nghiệm thu A6
- 14 cây đều có đủ 5 giai đoạn, biểu tượng, bọ, công thức xưởng, công dụng làm thức ăn. Có test kiểm tra dữ liệu: **mỗi cây có ít nhất 3 công dụng**.
- Mô phỏng trong `npm run check`:
  - Không cây nào chiếm quá 35% số lần gieo của người chơi vừa từ ngày 7 tới ngày 30.
  - Mỗi hệ chiếm 15–40% số lần gieo.
- Giá trị mỗi giờ giảm dần theo thời gian lớn của cây. Giá trị mỗi lần thu tăng dần. Có test cho cả hai.
- Cây Hot và Thông Thạo chạy tất định, BOT dùng chung luật.

