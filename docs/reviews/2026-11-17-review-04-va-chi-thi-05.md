# REVIEW 04 — Nghiệm thu chỉ thị 04 · 17/11/2026

Kiểm tra: báo cáo `docs/reports/2026-11-17-chi-thi-04/bao-cao-cuoi.md` @ 9fbecc5, tờ xem trước bản cuối, ảnh trong game build e17dd05, bản thử gh-pages 7f64ce2.

**Điểm: 8,5/10 — ĐẠT.**

## Làm tốt
- Đủ bằng chứng: commit từng việc, status, atlas, log typecheck/test/build (100/100), ảnh có nhãn khớp commit.
- Atlas 546 KB, 1 trang 4061×817, thêm 12,7 MB texture: tốt.
- Không đổi id chậu cũ; chậu cũ đánh dấu `retired`, save cũ vẫn chạy và đã có test.
- Đặt trường `theme` thay cho `group` (vì `group` đã có nghĩa khác). **CTO chấp nhận.**
- Báo cáo trung thực các chậu còn lỗi và giới hạn đo FPS.

## Lỗi hình còn lại — CTO đã sửa thiết kế
| # | Chậu | Sửa |
|---|---|---|
| 35 | Rổ Tre Nón Lá | Nón đứng sau rổ, nghiêng `[-18, 0, -20]` để thấy chóp (theo đề xuất của Claude thực thi) |
| 9 | Sushi | Lát cá hồi dày hơn, nghiêng hơn |
| 47 | Đèn Thần | Thân vẫn dẹt → hồ sơ cao hơn, có cổ |

Ghi nhận: #3, #18, #19, #28, #45 sau khi sửa đã đạt. #12 Cáo khá hơn nhưng đuôi vẫn thành khối quạt (để đợt sau).

---

# CHỈ THỊ 05 — Cân bằng chậu + hoàn thiện nhỏ

Nhánh: `feat/full-loop`. Ưu tiên theo thứ tự.

## 1. Cân bằng 50 chậu đặc trưng (QUAN TRỌNG NHẤT)
Hiện chậu Huyền thoại cấp 50 yếu hơn chậu Thường cấp 50, trái POT_SYSTEM mục 4.

Yêu cầu:
- Điểm sức mạnh (công thức trong `docs/POT_BALANCE.md`) ở cấp 10, 25 và 50 phải **tăng dần theo độ hiếm**: thường < tốt < hiếm < sử thi < huyền thoại.
  - Trong cùng độ hiếm, các chậu chênh nhau không quá ±8%.
  - Mỗi bậc hiếm mạnh hơn bậc dưới ít nhất 10% ở cấp 50.
- Mỗi nhóm một hướng chủ đạo, để chọn chậu là một quyết định chứ không chỉ chọn chậu mạnh nhất:
  - Đồ ăn: Sản lượng.
  - Linh vật: Kinh nghiệm + May mắn.
  - Thiên nhiên: Lớn nhanh.
  - Gốm Á Đông: Chăm sóc + Hút bọ.
  - Thần thoại: cân bằng các chỉ số và có kỹ năng cấp 50 mạnh nhất.
- Giá, cấp mở và nguyên liệu nâng cấp theo đường cong của `tools/pot-balance.ts`. Chậu đắt nhất không vượt thu nhập khoảng 3 ngày chơi ở cấp mở khóa của chậu đó (dùng `tools/balance.ts` để tính).
- **Không đổi chậu Đất Nung, Đỉnh Đồng, Sen Ngọc** và các chậu retired.
- Sinh lại `docs/POT_BALANCE.md`. Thêm test vào `tests/balance.test.ts` khóa các ràng buộc trên.
- Báo cáo gồm bảng 50 chậu (độ hiếm, nhóm, điểm sức mạnh ở cấp 10/25/50, giá, cấp mở) và thu nhập/ngày theo cấp người chơi. **Số mới chỉ lên bản thử; chủ dự án duyệt mới merge.**

## 2. Render lại 3 chậu và đóng gói lại
- `git pull art/blender-pots` (CTO đã sửa #9, #35, #47).
- Render `--levels 9,35,47`, đóng gói lại `pots_signature`, ảnh xem trước 3 chậu.

## 3. Bộ nhớ texture
- Chỉ nạp `pots_catalog` (29,5 MB) và `pots_phoenix` khi save đang có chậu dùng hai atlas đó.
- Ghi tổng texture trước và sau bằng nút Đo hiệu năng.

## Không làm
Ảnh tiến hóa nhiều cấp, hoạt ảnh và BOT để chỉ thị sau.
