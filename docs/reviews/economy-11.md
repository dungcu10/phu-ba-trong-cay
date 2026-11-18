# Kinh tế chỉ thị 11 TỔNG — làng, thú cưng (30 ngày, 3 kiểu người chơi)

> Tạo bằng `npx tsx tools/economy-11.ts` từ bộ mô phỏng của CTO (`tools/progression.ts`), 2026-11-18.
> Bot mô phỏng: xây nhà, điểm danh, nuôi thú cưng, việc vặt, chim, xưởng, đúc chậu, Biển Mây, câu cá (theo luật CTO viết).

## Kết quả theo ràng buộc phần H

| # | Ràng buộc | Đo được (người chơi vừa) | Kết quả |
|---|---|---|---|
| 1a | Đủ 4 thú cưng khoảng ngày 12–16 | ngày 15 | đạt |
| 1b | Cấp Làng 10 khoảng ngày 7 | ngày 3 | ngoài khoảng |
| 1c | Cấp Làng 25 khoảng ngày 30 | ngày 16 (ngày 30: Cấp Làng 28) | ngoài khoảng |
| 1d | Mở tầng 5 khoảng ngày 20–25 | ngày 13 | ngoài khoảng |
| 2 | Vắng 24 giờ (chỉ thú cưng, chim, xưởng chạy): thu nhập ≤ 35% người chơi vừa | 9.146 xu (gồm giá bán đồ nhận được) / 367.193 xu một ngày chơi = 2% | đạt |
| 3 | Tổng thưởng phần trăm trên một lần thu hoạch ≤ 60% | lớn nhất trên vườn ngày 30: sản lượng +17%, tốc độ +23% | đạt |
| 4 | Có Cáo và chim: tổng bọ tăng ≤ 45% | 616 / 2.898 con do chim + thú cưng bắt → +27% so với không có | đạt |
| 5 | Không có vòng tạo xu vô hạn | xem mục dưới; việc vặt mang về 43.610 xu = 0.6% thu nhập 30 ngày | đạt |

## Vòng tạo xu (mục H.5)

- **Mèo Tự Bày Hàng ↔ Sẻ Gieo Lại ↔ Thu Hoạch Hộ:** Bày Hàng chỉ bày lại hàng có trong kho, giá người chơi đặt (trong khoảng giá cho phép), tối đa 5→15 lần/ngày; Gieo Lại trả tiền hạt như người chơi (tối đa 20→60 chậu/ngày); Thu Hoạch Hộ chỉ thu cây đã chín, theo thời gian lớn. Không vòng nào sinh xu nếu không có cây lớn thật.
- **Việc vặt ↔ Chợ:** số việc mỗi ngày cố định (4 + Nhà Thú Cưng), mỗi bé một việc một lúc; xu theo cấp người chơi.
- **Câu cá ↔ chế mồi:** CTO đã chặn (mồi 6 Bạc Hà Mây, xu cá ÷3, số lần câu mỗi ngày).
- **Đào → Mài Ngọc → bán:** Năng Lượng Gió hồi theo giờ, có trần; xưởng chạy theo hàng đợi.
- **Nâng nhà ↔ giảm giá:** giảm giá chậu của Lò không vượt tiền nâng Lò (mỗi cấp chỉ giảm vài phần trăm, tiền nâng tăng theo U).

## Biểu đồ

![Xu đang giữ (log)](economy-11/xu.svg)

![Cấp người chơi](economy-11/cap.svg)

![Cấp Làng](economy-11/cap-lang.svg)

## Bảng theo ngày

### Chơi nhẹ (6 giờ/lần)

| Ngày | Cấp | Xu | Thu nhập ngày | Cấp Làng | Thú cưng | Tầng | Bọ do chim + thú cưng | Việc vặt |
|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 439 | 631 | 4 | 0 | 1 | 0 | 0 |
| 3 | 5 | 7.213 | 12.209 | 6 | 1 | 1 | 0 | 0 |
| 5 | 6 | 9.741 | 12.258 | 8 | 2 | 1 | 0 | 2 |
| 7 | 7 | 1.201 | 5.452 | 10 | 2 | 1 | 0 | 2 |
| 10 | 9 | 19.562 | 67.033 | 15 | 2 | 2 | 0 | 3 |
| 14 | 12 | 25.223 | 58.688 | 18 | 2 | 3 | 1 | 2 |
| 18 | 15 | 42.865 | 77.833 | 24 | 3 | 3 | 16 | 1 |
| 21 | 17 | 55.544 | 146.294 | 24 | 4 | 4 | 21 | 6 |
| 25 | 19 | 28.555 | 94.134 | 25 | 4 | 5 | 24 | 6 |
| 30 | 21 | 148.770 | 217.494 | 26 | 4 | 5 | 28 | 5 |

### Chơi vừa (2 giờ/lần)

| Ngày | Cấp | Xu | Thu nhập ngày | Cấp Làng | Thú cưng | Tầng | Bọ do chim + thú cưng | Việc vặt |
|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 7.247 | 13.168 | 6 | 1 | 1 | 0 | 0 |
| 3 | 8 | 6.318 | 31.872 | 12 | 2 | 1 | 0 | 4 |
| 5 | 11 | 27.857 | 254.019 | 17 | 3 | 3 | 2 | 5 |
| 7 | 14 | 66.376 | 134.479 | 19 | 3 | 3 | 1 | 4 |
| 10 | 17 | 58.769 | 113.241 | 20 | 3 | 4 | 2 | 4 |
| 14 | 20 | 67.099 | 225.707 | 24 | 3 | 5 | 31 | 5 |
| 18 | 22 | 30.400 | 346.491 | 26 | 4 | 6 | 37 | 5 |
| 21 | 23 | 177.809 | 439.888 | 27 | 4 | 6 | 22 | 4 |
| 25 | 25 | 32.937 | 398.493 | 28 | 4 | 7 | 39 | 3 |
| 30 | 26 | 265.292 | 389.108 | 28 | 4 | 7 | 35 | 2 |

### Chơi chăm (30 phút/lần)

| Ngày | Cấp | Xu | Thu nhập ngày | Cấp Làng | Thú cưng | Tầng | Bọ do chim + thú cưng | Việc vặt |
|---|---|---|---|---|---|---|---|---|
| 1 | 9 | 15.979 | 147.237 | 13 | 3 | 2 | 2 | 3 |
| 3 | 15 | 90.230 | 180.701 | 23 | 4 | 3 | 25 | 8 |
| 5 | 18 | 102.219 | 222.513 | 25 | 4 | 4 | 21 | 2 |
| 7 | 20 | 81.220 | 289.544 | 25 | 4 | 5 | 41 | 2 |
| 10 | 22 | 62.054 | 452.580 | 26 | 4 | 6 | 35 | 4 |
| 14 | 24 | 300.199 | 483.527 | 26 | 4 | 6 | 51 | 2 |
| 18 | 26 | 354.286 | 473.606 | 26 | 4 | 7 | 28 | 3 |
| 21 | 27 | 462.539 | 500.622 | 26 | 4 | 7 | 31 | 4 |
| 25 | 28 | 290.914 | 511.055 | 26 | 4 | 8 | 22 | 3 |
| 30 | 30 | 425.658 | 534.439 | 27 | 4 | 8 | 32 | 2 |

## Ghi chú

- Ràng buộc 3: trần cộng dồn của game là `config.bonusCaps` (POT_SYSTEM 5: tốc độ 0.75, sản lượng 2). Nếu dòng 3 ghi "vượt", trần 60% của chỉ thị 11 thấp hơn trần chậu hiện có — CTO quyết định hạ `bonusCaps` hay tính 60% riêng cho phần thưởng mới (làng, thú cưng, kết hợp).
- Ràng buộc 2 tính cả giá bán của đồ nhận được khi vắng (giới hạn trên).
