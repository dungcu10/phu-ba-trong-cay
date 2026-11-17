# PHÂN CÔNG HAI LUỒNG LÀM SONG SONG (CTO, 18/11/2026)

File này **bổ sung cho `KE_HOACH_TIEP_THEO.md`**. Có hai người làm cùng lúc: **Claude thực thi (mày)** và **CTO**. Mỗi bên làm phần việc riêng, tự kiểm, tự merge, không phải chờ bên kia.

## 1. CTO LÀM — Luồng KINH TẾ: chỉ đụng số liệu, mô phỏng và nội dung cây

| Việc | File CTO giữ |
|---|---|
| Bot mô phỏng giống người chơi thật: biết giao đơn, bỏ đơn không làm được | `tools/progression.ts` |
| A1: đường kinh nghiệm, quà bất ngờ, khinh khí cầu, lượng ngọc | `config.json` (chỉ khối `levels`), `surprises.json`, `orders.json` (các trường đang có) |
| B6: tốc độ sinh bọ, độ hiếm của bọ | `bugs.json`, phần `bugs` trong `crops.json` |
| B7 phần số liệu: thôi bán chậu chữ ký và Sử Thi bằng xu | `pots.json` (chỉ cờ và giá bán ở Lò) |
| A6: 14 cây gồm dữ liệu, hình và công thức giá trị | `crops.json`, `tools/art/` (phần cây), atlas cây mới |
| Bật chặn các chỉ số khi đã đạt | `tools/check-metrics.json`, các test kinh tế (`tests/progression*`, `tests/balance*`) |

**CTO không đụng:** `src/**`, lưu trữ và `SAVE_VERSION`, giao diện, và mọi file nội dung khác.

## 2. MÀY LÀM — Luồng TÍNH NĂNG: toàn bộ code và giao diện

Làm theo thứ tự sau:

1. **Giai đoạn 1:** M6, M7, M8 của chỉ thị 10. Kèm D1 (BOT có chim) và 2 lỗi nhỏ: nút "Thêm chậu" nổi lơ lửng, `demo('signature')` báo lỗi.
2. **Phần kinh tế cần sửa code và lưu trữ:**
   - A2: tách 2 kho, có migration.
   - B7 phần code: mảnh chậu, ghép chậu, sao chậu.
   - A6 phần code: Thông Thạo cây, Cây Hot trong ngày.
   - A1 phần code: khinh khí cầu bay đi khi giao đơn, nếu cần thêm logic ngoài việc chỉnh `refillSeconds`.
3. **Giai đoạn 3:** chỉ thị 11 TỔNG.
4. **Giai đoạn 4:** phần còn lại của 12 TỔNG.

**Mày không đụng** các file CTO giữ ở mục 1. Nếu cần trường mới trong những file đó, ví dụ loại đơn mới trong `orders.json`, thì **chỉ thêm trường mới**, không sửa trường cũ. Chỉ **mày** được tăng `SAVE_VERSION`.

## 3. LUẬT GỘP (cả hai bên cùng theo)

1. Mỗi việc làm trên một nhánh riêng. Nhánh của CTO đặt tên `feat/cto-*`, nhánh của mày giữ như cũ.
2. Trước khi merge: **rebase lên `main` mới nhất**, rồi chạy `npm run check`. Xanh thì merge, kèm 1 dòng CHANGELOG và tag.
3. Bên nào merge sau thì bên đó gỡ xung đột. Gặp xung đột ở file của bên kia thì **giữ phần của bên kia**, chỉ thêm phần của mình vào.
4. **Kéo `main` mới về** mỗi khi bắt đầu một mốc mới.
5. Thay đổi kinh tế của CTO có thể làm số trong mô phỏng thay đổi. Nếu sau khi rebase, `npm run check` báo lỗi ở **chỉ số kinh tế** mà mày không đụng tới kinh tế, thì báo CTO trong CHANGELOG và vẫn merge. Riêng **test chức năng** bị đỏ thì không được merge.
6. Không bên nào phải chờ bên kia. Việc của ai người đó làm.
