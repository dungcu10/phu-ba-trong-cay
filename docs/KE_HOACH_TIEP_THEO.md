# KẾ HOẠCH TIẾP THEO — THAY THỨ TỰ LÀM VIỆC (CTO, 18/11/2026)

Kế hoạch này **thay mục 1 "Thứ tự công việc" của `GAME_SYSTEMS.md`**. Mọi luật khác trong `GAME_SYSTEMS.md` giữ nguyên.

## Kết quả CTO kiểm tra (`feat/10-ban-tong` @ `f25d3c3`)

- **Chỉ thị 10: xong M1–M5.**
- **Đính chính:** D2–D5 xong.
- **Biểu tượng:** đã thay bằng hình thật.
- **`npm run check`:** chạy tốt. CTO tự chạy lại phần mô phỏng, ra kết quả xanh. Toàn bộ chỉ số kinh tế đang ở mức cảnh báo, đúng như kế hoạch.
- **Còn thiếu:** D1 (BOT chưa có chim).
- **Lỗi nhỏ mới phát hiện:**
  - Nút "Thêm chậu" của hàng sau nổi lơ lửng trên nền trời, phía trên mặt cỏ.
  - `demo('signature')` báo lỗi vì đọc `slots` của tầng không tồn tại. Lỗi này chỉ ảnh hưởng công cụ dev.

**Lý do đổi thứ tự:** nền kinh tế đang lệch nặng.
- Ngày 7 người chơi đã lên cấp 30, mục tiêu là 13–15.
- Mỗi ngày sinh ra 800–1.800 con bọ Thường, mục tiêu là 40–70.
- Ngày 30 người chơi sở hữu đủ 50/50 chậu chữ ký, mục tiêu là 10–15.
- Bot mô phỏng giao được 0 đơn.

Nếu xây làng và thú cưng (chỉ thị 11) trên nền này thì mô phỏng của chỉ thị 11 vô nghĩa, và về sau phải chỉnh số liệu hai lần. Vì vậy **sửa kinh tế gốc trước**.

---

## GIAI ĐOẠN 1 — Làm nốt chỉ thị 10: M6, M7, M8

**Chỉ đọc:** chỉ thị 10 mục 3.5–3.11, và chỉ thị 11 TỔNG phần A (D1).

- M6: Xưởng, đơn hàng mới, chim dẫn đường, nhờ góp hàng.
- M7: Biển Mây, đúc chậu, câu cá, trang trí.
- M8: Xu Xu, nhịp mở khóa, BOT dùng các hệ mới. **D1 (BOT có chim) làm ở mốc này.**

**Để khỏi làm lại khi sang chỉ thị 11:**
- Xưởng, Biển Mây, câu cá, đúc chậu đều làm thành **cửa sổ độc lập**, mở được từ một hàm như `openWorkshop()`.
- Lối vào tạm thời là nút trên thanh công cụ. Sang chỉ thị 11, nhà trong làng sẽ gọi đúng hàm đó.
- **Không** đặt lối vào ở gốc cây leo hay mép tầng mây.

Sửa luôn 2 lỗi nhỏ ở trên.

## GIAI ĐOẠN 2 — Kinh tế gốc (gộp M9 của chỉ thị 10 với phần lõi của chỉ thị 12 TỔNG)

**Chỉ đọc các mục:** 12 TỔNG A1, A2, A3, B6, B7, và file `BO_SUNG_A6_CAY_TRONG.md`.

Làm theo thứ tự sau:

1. **Sửa bot mô phỏng trước** (`tools/progression.ts`). Bot phải biết giao đơn khi giao lời hơn bán, biết dùng xưởng, biết mua chậu có giới hạn. Bot chưa giống người thật thì mọi chỉ số sau đó đều sai.
2. **A1:** đường kinh nghiệm, quà bất ngờ còn 10–15 lần mỗi ngày, khinh khí cầu bay đi 20–60 phút (bỏ chu kỳ 45 giây).
3. **A2:** tách 2 kho, có migration.
4. **B6:** tốc độ sinh bọ và độ hiếm của bọ.
5. **B7:** Lò Gốm thôi bán chậu chữ ký và chậu Sử Thi trở lên bằng xu. Thêm mảnh chậu và sao chậu.
6. **A6:** 14 cây theo `BO_SUNG_A6_CAY_TRONG.md`. Hình nằm trong `8_cay-trong/`.
7. **A3:** cân lại các chỗ tiêu xu đang có.

**Xong giai đoạn 2:** trong `tools/check-metrics.json`, bật `block: true` cho các chỉ số: cấp ngày 1, 7, 30; `Xu/U`; bọ Thường; bọ Rất hiếm; chậu chữ ký; thời gian kho đầy; đơn mỗi ngày.

Chỉ số "Mốc tiến bộ mỗi ngày" vẫn để cảnh báo, sang giai đoạn 3 mới bật, vì nhà và thú cưng sẽ thêm mốc.

## GIAI ĐOẠN 3 — Chỉ thị 11 TỔNG (làng, 20 tầng, thú cưng)

**Chỉ đọc:** chỉ thị 11 TỔNG phần B đến L. Phần A đã làm xong ở giai đoạn 1.

- Mô phỏng phải giữ nguyên các chỉ số đã bật chặn ở giai đoạn 2.
- Nếu thú cưng hay nhà làm lệch chỉ số nào thì **chỉnh số của thú cưng hoặc nhà**, không nới khoảng đạt.
- Xong giai đoạn 3 thì bật chặn chỉ số "Mốc tiến bộ mỗi ngày".

## GIAI ĐOẠN 4 — Phần còn lại của chỉ thị 12 TỔNG

**Chỉ đọc các mục:** 12 TỔNG B1–B5, A4, A5, A7, C.

Làm theo thứ tự:
1. B2 Chợ đặt lại
2. B4 Trộm vườn và B5 Bắt sâu ở vườn người khác
3. B3 Phú Bà động và Giải tuần
4. B1 Lộc Phiên và Hẹn giờ
5. A4 Đơn hàng
6. A5 Sự kiện xoay vòng
7. Phần C và A7 (sửa thao tác: chạm chậu trống mở khay hạt, "Nhận" một chạm, chữ đè nhau…)

Xong giai đoạn 4 là **ứng viên bản 1.0**: chạy đủ 3 nhịp mô phỏng, nộp báo cáo theo `GAME_SYSTEMS.md` mục 7, chờ CTO nghiệm thu.

---

## Cách làm để tiết kiệm token và thời gian

- Mỗi giai đoạn **chỉ đọc đúng các mục được ghi ở trên**. Không đọc lại toàn bộ các chỉ thị.
- Mỗi mốc: chạy `npm run check` → commit → tự merge (theo `GAME_SYSTEMS.md` mục 8).
- **Báo cáo chỉ nộp ở cuối giai đoạn 2 và cuối giai đoạn 4**, mỗi lần một file theo mục 7. Giữa chừng chỉ cần dòng commit và CHANGELOG.
- Gặp chỗ chưa rõ thì tự quyết theo `GAME_SYSTEMS.md` mục 2, rồi ghi một dòng vào báo cáo.
