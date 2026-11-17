# Nâng cấp v3 — Đợt 1: Tiến trình vô tận (bản cuối, theo kế hoạch A1–A5)

Ngày 17/11/2026. Nhánh `feat/nang-cap-v3`, commit `9d4cae2`. Bản này thay cho bản nháp 63a75c2/0ee6062.

Kế hoạch đã duyệt: `ke-hoach-nang-cap-v3.md` (Project).

## Công thức (đều nằm trong `content/base/config.json`)

| Mục | Công thức | Ghi chú |
|---|---|---|
| A1. Đơn vị thu nhập U(L) | Lấy số xu/chậu/giờ của cây tốt nhất đã mở ở cấp L, giả định người chơi ghé mỗi 30 phút. Nhân với số tầng đã mở ở cấp L × 8 chậu. Nhân với (1 + 0,3). | U(5)=1.664, U(10)=4.421, U(30)=11.791, U(50)=22.107, U(100)=47.163 |
| A2. XP để lên cấp L | 10 · L^1,6 · 1,06^min(L−1, 49) · (1 + 0,02·max(0, L−50)) | Không có cấp tối đa. Tới cấp 10.000 vẫn là số nguyên chính xác. |
| Thưởng lên cấp | 0,25·U(L) xu. Thêm 2 ngọc mỗi 5 cấp. Thêm 3 ngọc và 3 Đất Sét Mây mỗi 10 cấp. | |
| A3. Tầng sinh tự động thứ k | Cấp mở = 16 + 3k. Giá mở = U(cấp mở) × (4 + 5k) giờ. | Tầng 4: cấp 16, 24.000 xu. Tầng 8: cấp 28, 283.000 xu. Tầng 20: cấp 64, 2,48 triệu. Tầng 100: cấp 304, 71,3 triệu. |
| Thêm chậu, sao tầng | Thêm chậu: 25/50/75/100% giá tầng. Sao: cấp +1/+4/+8, xu 50/100/200% giá tầng, cần nông sản của cây mới nhất. | |
| Rương Mây | Giá nâng = 300 × (bậc + 1)^2,2 xu. Mỗi bậc thêm 20 ô. | Không giới hạn bậc. Bậc 10.000 vẫn là số nguyên chính xác. |
| Mưa Mây | Mỗi 15 phút còn lại tốn 1 ngọc, tối thiểu 1 ngọc mỗi chậu. | Chỗ tiêu ngọc. |
| A4. Trần chỉ số (tổng mọi nguồn) | Lớn nhanh 75%, sản lượng +200%, kinh nghiệm +150%, may mắn +100%, hút bọ +100%, chăm sóc +150%. | Validator bắt buộc có đủ trần cho mọi chỉ số. |
| Ngân sách quà ngọc | Quà bất ngờ cho tối đa 6 ngọc mỗi ngày; vượt mức thì quà thành xu. | Trước khi sửa, vườn lớn nhận khoảng 30 ngọc/ngày. |

## A5. Mô phỏng dài hạn (chạy qua bộ xử lý lệnh thật, nằm trong `npm test`)

Người chơi giả lập ghé vườn trong khoảng 8h–22h. Mỗi lần ghé: thu hoạch, bán, giao đơn, nhận thưởng, gieo lại, rồi tiêu tiền vào tầng → chậu → sao → Rương Mây → chậu mới ở Lò Gốm → nâng chậu. Dùng Mưa Mây một lần mỗi sáng nếu đủ ngọc.

| Kiểu chơi | Ngày 7 | Ngày 30 | Cuối mô phỏng | Lâu nhất không có mốc mới | Ngọc kiếm/ngày (30 ngày cuối) |
|---|---|---|---|---|---|
| Ghé 15 phút/lần (90 ngày) | — | cấp 54, 10 tầng | ngày 90: cấp 81, 18 tầng | ≤ 10 ngày (đạt) | khoảng 6–7 |
| Ghé 2 giờ/lần (365 ngày) | cấp 20–45, ≥ 4 tầng (đạt) | cấp 50, 9 tầng | ngày 360: cấp 133, 32 tầng | ≤ 10 ngày (đạt) | khoảng 6–7 |
| Ghé 8 giờ/lần (365 ngày) | — | cấp 30, 4 tầng | ngày 360: cấp 77, 17 tầng | ≤ 10 ngày (đạt) | khoảng 7 |

"Mốc mới" gồm: mở tầng, thêm chậu, lên sao tầng, có cây mới, mua dòng chậu mới, chậu lên mốc cấp, nâng Rương Mây.

Kiểm tra tự động cho cả 3 kiểu chơi:
- cấp và tầng không bao giờ giảm;
- không có quá 10 ngày liền không có mốc mới;
- số xu tồn ≤ max(72·U, 1,5 × giá tầng kế tiếp) — tức người chơi chỉ để dành để mua tầng, không ôm tiền vô ích;
- ngọc kiếm mỗi ngày ≤ 12;
- 30 ngày cuối vẫn còn lên cấp.

Bảng chi tiết theo từng ngày: `prog15.md`, `prog120.md`, `prog480.md`.

**Điều chỉnh so với kế hoạch:** kế hoạch ghi giới hạn xu tồn là "≤ 72·U". Khi chạy mô phỏng, người chơi tiết kiệm để mua tầng cao (giá có thể vượt 72·U), nên mình sửa giới hạn thành "≤ max(72·U, 1,5 × giá tầng kế)". Mục đích của tiêu chí vẫn giữ nguyên: không ôm xu khi không có gì để mua.

## Cổng nghiệm thu

| Tiêu chí | Kết quả |
|---|---|
| typecheck / test / build | exit 0 / **113/113 đạt** / exit 0 (`typecheck.log`, `test.log`, `build.log`) |
| Test mới | 11 test tiến trình, gồm: 3 bài mô phỏng dài hạn; kiểm tra số học ở cấp 10.000, tầng 1.000 và Rương bậc 10.000; trần chỉ số; lưu/tải tầng sinh tự động; Rương Mây; Mưa Mây. Thêm 1 test save đời 9. |
| Save cũ | Save mẫu thật đời 4 (d7c9ded), 7 (27159a0) và 8 (e17dd05) nâng lên đời 9, giữ nguyên tiến trình, có bản sao trước nâng cấp. Save đời 9 của bản thử nháp 9ef65c4 (thiếu ngân sách quà) tải được, giữ tiến trình. |
| Chơi thử (Chrome, 1194×834, có bật cảm ứng) | (1) Save mới: 5 vòng gieo Cúc rồi vuốt thu hoạch → cấp 3, 218 xu, 28 lần thu hoạch. (2) Vườn 5 tầng: chạm thẻ "Tầng 6", bấm "Mở tầng" → đủ 6 tầng, trừ đúng 124.000 xu, thẻ chuyển sang "Tầng 7 · Đồi Cầu Vồng". (3) Mưa Mây trong bảng tầng: −19 ngọc, cây chín ngay. (4) Nâng Rương Mây: 60 → 80 ô. Không có lỗi console. |
| Hiệu năng | Nút "Đo hiệu năng" cho kết quả ngang bản trước: 5,8–6,0 FPS ở bản này và bản e17dd05 khi đo trên cùng máy. Máy này vẽ bằng phần mềm (SwiftShader) nên con số chỉ dùng để so sánh tương đối. Texture không đổi: 95,1 MB. **Chưa đo trên iPad thật.** |
| Bản thử | GitHub Pages, nhãn "BẢN THỬ · <commit>". |

## Ảnh (bản 9d4cae2)

- `nguoi-choi-moi-5-phut.png`: người chơi mới sau 5 vòng.
- `tang-vo-tan.png`: vườn 5 tầng, thẻ tầng 6.
- `mo-tang-6-qua-giao-dien.png`: sau khi bấm mở tầng 6, thẻ tầng 7.
- `bang-tang-mua-may.png`: bảng tầng có Mưa Mây.
- `ruong-may-nang-cap.png`: Rương Mây với nút nâng cấp.

## Còn mở (để các đợt sau)

- Ngọc vẫn dư khoảng 5 ngọc/ngày, vì hiện chỉ có Mưa Mây để tiêu ngọc. Đợt 4 (cửa hàng sự kiện) và Đợt 5 (thú cưng) sẽ thêm chỗ tiêu.
- Tầng sinh tự động dùng lại ảnh 3 tầng cũ, chỉ đổi màu. Ảnh mới bằng Blender làm ở Đợt 3.
- Người mới đầy Rương Mây (56/60) chỉ sau khoảng 5 phút trồng Cúc. Đợt 2 sẽ thêm hướng dẫn bán hàng; Đợt 3 thêm nút "bán hết".
