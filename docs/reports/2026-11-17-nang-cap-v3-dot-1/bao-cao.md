# Nâng cấp v3 — Đợt 1: Tiến trình vô tận

Ngày 17/11/2026. Nhánh `feat/nang-cap-v3`, commit `63a75c2` và `0ee6062`. Kế hoạch tổng nằm ở Project (`ke-hoach-nang-cap-v3.md`).

Quyết định của chủ dự án: **không có cấp tối đa, không có tầng mây tối đa; tầng càng cao thì yêu cầu càng cao.**

## Đã làm

| Hạng mục | Nội dung | Dữ liệu |
|---|---|---|
| Cấp không giới hạn | Bỏ trần cấp 30. XP cần để lên cấp L tính bằng `10 × L^1,6 × 1,06^(L−1)`, nên cấp sau luôn khó hơn cấp trước. BOT cũng không còn trần cấp. | `config.levels` |
| Thưởng lên cấp | Mỗi cấp được 10 + 10×cấp xu. Cứ 5 cấp thêm 2 ngọc, cứ 10 cấp thêm 3 ngọc và 3 Đất Sét Mây. Bảng chúc mừng ghi rõ quà. | `config.levels.levelUp` |
| Tầng mây vô tận | Sau 3 tầng thiết kế sẵn, tầng 4 trở đi được sinh theo công thức. Tên (8 tên, hết vòng thì thêm "II", "III"…), màu, ảnh và đặc tính họ cây xoay vòng. Đặc tính tăng 1% mỗi tầng, tối đa 30%. Cấp yêu cầu: 16, 20, 25, 30, 36…; giá mở: 20.000 × 2^k. Giá thêm chậu và yêu cầu sao tăng theo. Mỗi tầng có id `base:floor.gen-N`, lưu/tải không mất. | `config.floorGen`, `src/core/floorgen.ts` |
| Chỗ tiêu xu | Nâng Rương Mây: +20 ô mỗi bậc, không giới hạn bậc. Giá bắt đầu 300 xu và nhân 1,45 mỗi bậc. | `config.storageUpgrade` |
| Chỗ tiêu ngọc | **Mưa Mây** (trong bảng tầng): làm chín ngay mọi cây đang lớn trên tầng. Giá tính theo thời gian còn lại: 30 phút = 1 ngọc, tối thiểu 1 ngọc mỗi chậu. | `config.cloudRain` |
| Ngọc không còn tràn | Quà bất ngờ giảm: trần cơ hội từ 0,5 xuống 0,25; quà ngọc nhẹ hơn. Ở vườn lớn, ngọc kiếm được từ khoảng 100 xuống còn 25–40 mỗi ngày. | `surprises.json` |
| Bố cục | Thẻ tầng đang khóa ghi "Tầng N · tên" và hạ thấp xuống, không còn sát dòng gợi ý. Đồng hồ sự kiện hiện "26 ngày" thay cho "641:15". Mỗi lúc hiện tối đa 2 thông báo. | |
| Save | Save đời 9 (thêm `upgrades.storage`), có migration 8→9. Thêm save mẫu thật đời 8 từ bản `e17dd05` vào bộ kiểm thử. Save đời 4, 7, 8 đều nâng lên được mà giữ nguyên tiến trình. | |
| Sửa lỗi | `demo('garden')` không còn cố mua chậu sự kiện/nhiệm vụ. | |

## Nhịp tiến trình (mô phỏng qua bộ xử lý lệnh thật, `tools/progression.ts`)

Người chơi giả lập ghé vườn từ 8h đến 22h và tiêu xu theo thứ tự: tầng → chậu → sao → rương → nâng chậu. Mô phỏng chưa tính việc mua chậu ở Lò Gốm và dùng Mưa Mây.

| Ngày | Ghé 2 giờ/lần: cấp / tầng | Ghé 15 phút/lần: cấp / tầng |
|---|---|---|
| 1 | 6 / 1 | 15 / 2 |
| 3 | 19 / 3 | 26 / 5 |
| 7 | 32 / 6 | 36 / 7 |
| 14 | 42 / 8 | 45 / 9 |
| 21 | 48 / 9 | 50 / 9 |
| 30 | 53 / 10 | 55 / 10 |

Trước đợt này: người chơi đạt cấp 30 (trần) sau 2–5 ngày, rồi dư 1,17 triệu xu mà không có gì để mua. Sau đợt này: người chơi vẫn lên cấp và mở tầng mới mỗi tuần, chỉ chậm dần, và xu được tiêu vào tầng mới (giá tăng gấp đôi mỗi tầng). Nhịp này được giữ bằng test `tests/progression.test.ts`.

## Kiểm thử

- `npm run typecheck`: exit 0.
- `npm test`: 108/108 đạt, gồm 7 test mới cho tiến trình và 1 test nâng save đời 8.
- `npm run build`: exit 0.
- Chơi thử trong trình duyệt khổ 1194×834:
  - save mới: gieo, thu hoạch bằng cách vuốt;
  - vườn 5 tầng với tầng 6 đang khóa;
  - bảng tầng có Mưa Mây;
  - Rương Mây có nút nâng cấp.
  - Không có lỗi console.

## Ảnh (bản `0ee6062`)

- `nguoi-choi-moi.png`: màn hình đầu của người chơi mới. Thẻ "Tầng 2" không còn sát dòng gợi ý.
- `tang-vo-tan.png`: tầng 5 "Thung Lũng Sương Bạc" (sinh tự động) và tầng 6 đang khóa.
- `bang-tang-mua-may.png`: bảng tầng với đặc tính, sao và Mưa Mây.
- `ruong-may-nang-cap.png`: Rương Mây với nút nâng cấp.

## Chưa làm trong đợt này

- Ảnh riêng cho tầng sinh tự động. Hiện các tầng này dùng lại ảnh 3 tầng cũ, đổi tên và màu. Ảnh riêng sẽ làm bằng Blender ở Đợt 6.
- Cân lại giá trị chậu đặc trưng và mở cấp 11–50 cho chậu cổ điển: để Đợt 6.
