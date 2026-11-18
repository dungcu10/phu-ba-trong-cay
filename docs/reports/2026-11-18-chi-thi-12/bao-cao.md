# Báo cáo Chỉ thị 12 TỔNG — phần Claude (2026-11-18)

Bản thử: https://dungcu10.github.io/phu-ba-trong-cay/ · `npm run check` XANH ở mọi mốc.

## Đã làm (theo mốc)

| Mốc | Nội dung | Save |
|---|---|---|
| `m-12-a3b2-code` | B2 + A3: chỗ tiêu xu (phần code) | — |
| `m-12-a2` | A2: tách 2 kho, Bán nhanh | — |
| `m-12-b7-code` | B7: mảnh chậu, ghép chậu, sao chậu | — |
| `m-12-b4b5` | B4 + B5: trộm vườn (lượt, bị bắt, Kẻ Thù, trả đũa), giúp vườn 10 lượt/ngày, quà thân thiết | 14 |
| `m-12-b3` | B3: thị trấn 60 Phú Bà (8 nổi tiếng + sinh từ seed theo dải cấp), Giải Phú Bà theo tuần | 15 |
| `m-12-b1` | B1: Lộc Phiên, bảng Hẹn giờ, giờ chín trong khay hạt | — |
| `m-12-c` | B7.3 gợi ý "Gần mốc" (vòng vàng dưới chậu + dòng trong bảng Chậu, chạm để phóng to dáng mới), B8.8 hoạt cảnh bị bắt khi trộm, G2 rung nhẹ khi vuốt | — |
| `m-12-a` | G1 thanh bên gọn từ cấp 10, G3 nút "Có X chậu chín", A4 đơn khách quen / cây mới (núm trung tính), A5 104 sự kiện xoay vòng | — |

## Ảnh (cấp 34, đồng hồ dev)

1. `01-thanh-ben-gon.jpg`: thanh trái chỉ còn Nhiệm vụ và Về Làng; nút "Có 22 chậu chín · Tầng 1".
2. `02-dong-ho.jpg`: bảng Hẹn giờ.
3. `03-giai-tuan.jpg`: Giải tuần (hạng Đồng, 30 người, phần thưởng).
4. `04-ke-thu.jpg`: tab Kẻ thù (trống khi chưa ai trộm).
5. `05-ghe-vuon.jpg`: ghé vườn: lượt trộm, lượt giúp, cơ hội bị bắt, bọ trong vườn.
6. `06-lang.jpg`: làng với biển "Bảng Phú Bà".
7. `07-gan-moc-vuon.jpg`: vòng vàng nhấp nháy dưới chậu còn 1–2 cấp nữa đổi dáng.
8. `08-gan-moc-bang.jpg`: dòng "Còn 1 cấp nữa chậu sẽ đổi dáng" kèm hình dáng mới.
9. `09-bi-bat.jpg`: bị bắt quả tang: thú canh vườn chạy tới (dấu "!"), màn hình rung, chữ nổi.

Các bảng "Mở khóa: …" trong ảnh 1 và 6 là hướng dẫn lần đầu của game (ở cấp 34 mở nhiều chức năng cùng lúc).

## Núm để trung tính / tắt — CTO chỉnh qua mô phỏng

- `neighbors.botSteal.chancePerHour` = 0 (BOT trộm khi vắng). Bật 0.12 làm chỉ số kinh tế đỏ.
- `orders.recentWeight`, `regularChance`, `regularBonus` = 0; `daisyFadeFrom` không đặt.
- Giải tuần: thưởng ngọc nhỏ; chưa có chậu thưởng theo mùa (cần hình).
- `event-rotation.json`: mốc thưởng nhỏ, CTO chỉnh.

## Chưa làm

- Đơn đặc sản tầng (cần ghi tầng trồng vào kho → đổi save).
- Chậu sự kiện riêng cho lịch xoay vòng (cần hình, L7).
- B7.3 chi phí nâng chậu (giảm xu ~30%, bọ thành điều kiện chính): là số trong `pots.json` của CTO.
- G2 vuốt nhiều chậu đã có từ trước (thu, gieo hạt vừa chọn, bắt bọ, tưới); thêm rung nhẹ. iPad Safari không hỗ trợ rung, nên trên iPad chỉ có số bay lên.
- "Thay chậu" đã có sẵn: nút "Đổi chậu" trong bảng chậu.

## Cảnh báo không chặn

- Tỷ lệ tiêu xu ở Sạp Săn Hàng 0,36–0,38.
