# Nâng cấp v3 — Đợt 2: Nhiệm vụ nhiều tầng, mở tính năng dần, hướng dẫn khi mở

Ngày 17/11/2026. Nhánh `feat/nang-cap-v3`, các commit `b12844a`, `54edfed`, `f355f79`. Ảnh chụp từ bản `f355f79`.

## Đã làm

| Hạng mục | Nội dung |
|---|---|
| Bộ máy nhiệm vụ | Định nghĩa trong `src/core/questdefs.ts`, chạy trong `src/systems/quests.ts`; nội dung đọc từ `content/base/quests.json`. Hai kiểu nhiệm vụ: **22 trigger** đếm từ sự kiện game (gieo, tưới, bắt bọ, thu hoạch, sản lượng, Biến Dị, bán, kiếm xu, giao đơn, nâng chậu, mua chậu, mở tầng, thêm chậu, lên sao, giúp hàng xóm, bày sạp, sạp bán được, nhận nhiệm vụ ngày, nhận Sổ Tay, Mưa Mây, nâng rương, lên cấp) và **9 chỉ số** đọc thẳng từ save (cấp, số tầng, số sao, số dòng chậu, số loại cây, cấp chậu cao nhất, bậc rương, tổng lần thu hoạch, tình thân cao nhất). Bộ lọc theo cây, họ cây, loại Biến Dị, độ hiếm chậu, tầng, khung giờ. Hỗ trợ chuỗi nhiệm vụ (`requires`), bậc không giới hạn, nhiệm vụ bí mật (ẩn tới khi đạt). |
| Nội dung | **64 nhiệm vụ**, sinh bằng `tools/make-quests.py` (không sửa tay JSON): **Tân thủ** chuỗi 17 bước đi tới mở tầng 2; **Tuần** rút 5 trong 14, đổi lúc 0 giờ thứ Hai; **Tháng** rút 4 trong 8, đổi ngày 1 hằng tháng; **Hành trình** 8 nhiệm vụ nhiều bậc (tầng, cấp, sao, cấp chậu, rương, tầng cao, cây cụ thể); **Thành tựu** 11 nhiệm vụ bậc không giới hạn; **Bí mật** 6 nhiệm vụ. Thưởng tính bằng giờ thu nhập × U(cấp), theo kế hoạch mục A1. |
| Tuần/tháng | Mốc đổi theo giờ Việt Nam. Danh sách đã bốc giữ nguyên cả kỳ; sang kỳ mới thì tiến trình về 0. Người chơi cấp thấp bốc được ít nhiệm vụ hơn số cần (vì nhiều nhiệm vụ yêu cầu cấp tối thiểu) sẽ được bù thêm khi lên cấp, nhiệm vụ đã có không bị đổi. |
| Mở tính năng dần | Định nghĩa trong `content/base/features.json`: Đơn hàng và Sổ Tay mở ở cấp 2; Lò Gốm, Phú Bà và Lễ Hội ở cấp 3; Sạp ở cấp 4. Nút của tính năng chưa mở bị ẩn. |
| Hướng dẫn khi mở | Định nghĩa trong `content/base/tutorials.json`. Lần đầu một tính năng mở, game hiện cửa sổ "Mở khóa: …" với nút "Xem ngay" (mở luôn tính năng) và "Để sau". Mỗi hướng dẫn chỉ hiện một lần; trạng thái đã xem được lưu bằng lệnh `seeTutorial`. |
| Giao diện | **Trung tâm Nhiệm vụ** gồm tab Hôm nay (nhiệm vụ ngày và chậu nhiệm vụ cũ), Tân thủ, Tuần, Tháng, Hành trình, Thành tựu, Bí mật; mỗi tab có số thưởng đang chờ nhận. **Ô theo dõi nhiệm vụ** ở góc dưới trái: hiện bước đang làm, thanh tiến trình, nút Nhận khi xong; chạm vào thì mở đúng tab. Có thông báo khi xong nhiệm vụ, khi nhận thưởng và khi lộ diện nhiệm vụ bí mật. |
| Kiểm tra nội dung | Validator từ chối: trigger hoặc chỉ số không có trong danh sách; cây, vật phẩm hoặc chậu không tồn tại; vòng lặp `requires`; phần thưởng rỗng; tính năng hoặc hướng dẫn trỏ tới thứ không có. |
| Save | Lên **save đời 10**, thêm `quests` và `tutorials`. Save cũ ở cấp 6 trở lên tự bỏ qua chuỗi Tân thủ. Tính năng mà save cũ đã có thì không hiện hướng dẫn lại. |

## Điều chỉnh khi làm

- Bỏ bước Tân thủ "Nhận 1 nhiệm vụ hằng ngày". Lý do: nếu người chơi đã nhận hết nhiệm vụ ngày trước khi tới bước này, chuỗi sẽ kẹt tới hôm sau. Thay bằng bước "Thu hoạch 10 lần Cà Chua Bi Ngọt".
- Chèn thêm bước "Đạt cấp 3" và "Đạt cấp 4" ngay trước bước giúp hàng xóm và bước bày sạp, để không bao giờ có bước yêu cầu một tính năng chưa mở.
- Thưởng thành tựu: trước đây mỗi bậc nhân thêm ×1,4, làm người chơi giả lập ôm tới 5 triệu xu. Nay chỉ nhân ×1,05, vì phần xu đã tự tăng theo U(cấp).
- Thành tựu "Tri kỷ" đổi từ mục tiêu tăng đều sang tăng gấp đôi mỗi bậc. Lý do: tình thân tăng rất nhanh, nhiệm vụ này từng cho tới 1.884 ngọc/năm. Ngọc từ nhiệm vụ cũng giảm một nửa.

## Cổng nghiệm thu

| Tiêu chí | Kết quả |
|---|---|
| typecheck / test / build | exit 0 / **132/132 đạt** / exit 0 (`typecheck.log`, `test.log`, `build.log`) |
| Test mới (`tests/quests.test.ts`, 12 test) | Nội dung đủ 6 tuyến; validator bắt đủ 5 loại lỗi; **mọi trigger** đều được đếm từ đúng sự kiện; bộ lọc cây/họ cây/tầng/giờ; chuỗi Tân thủ chỉ mở bước đầu và mỗi bước nhận đúng một lần; tuần đổi đúng 0 giờ thứ Hai 23/11, tháng đổi đúng ngày 1/12, danh sách giữ nguyên giữa kỳ; bù nhiệm vụ cho người chơi cấp thấp; thành tựu nhiều bậc; nhiệm vụ bí mật ẩn; tính năng và hướng dẫn giữ đúng qua lưu/tải; save cũ cấp 3 và cấp 12; **người mới chỉ làm theo ô nhiệm vụ đi hết 17 bước Tân thủ**: mất 51 phút giờ game, tới cấp 6, có 2 tầng, và không bước nào cần tính năng chưa mở. |
| Mô phỏng dài hạn (kế hoạch A5) | Người chơi giả lập giờ nhận cả thưởng nhiệm vụ. Cả 3 kiểu chơi vẫn đạt mọi ngưỡng: không quá 10 ngày liền không có gì mới, không ôm xu hay ngọc quá mức, vẫn lên cấp tới cuối. Bảng theo ngày: `prog120.md`. |
| Save cũ | Save đời 4, 7, 8, 9 đều nâng lên đời 10, giữ nguyên tiến trình và có bản sao trước khi nâng (test `upgrade-backup`). Save cấp ≥ 6: chuỗi Tân thủ đã xong, không có hướng dẫn chờ hiện. |
| Chơi thử trên trình duyệt (khổ 1194×834, có cảm ứng) | Người mới: chỉ thấy nút Nhiệm vụ, Hạt giống, Rương; Lò Gốm, Đơn hàng, Sạp, Phú Bà, Sổ Tay và Lễ Hội đều ẩn. Ô nhiệm vụ "Tân thủ 1/17 · Gieo hạt Cúc Bông Gòn" → gieo → nút Nhận hiện → bấm nhận được +20 xu, +2 XP. Lên cấp 2: hai nút Đơn hàng và Sổ Tay hiện ra, cửa sổ "Mở khóa: Đơn khinh khí cầu" xuất hiện; bấm Xem ngay thì mở bảng đơn. Tải lại trang: hướng dẫn đã xem không hiện lại. Không có lỗi console. |
| Hiệu năng | "Đo hiệu năng" (Chrome vẽ bằng phần mềm): 5,9 FPS, ngang bản trước. Texture 65,6 MB, không đổi. **Chưa đo trên iPad.** |

## Ảnh (bản f355f79)

- `nguoi-moi-o-nhiem-vu.png`: màn hình người chơi mới, các nút chưa mở đã ẩn, ô theo dõi nhiệm vụ ở góc dưới trái.
- `huong-dan-mo-don-hang.png`: cửa sổ giới thiệu Đơn khinh khí cầu khi lên cấp 2.
- `xem-ngay-don-hang.png`: sau khi bấm Xem ngay.
- `tai-lai-khong-hien-lai.png`: sau khi tải lại trang, hướng dẫn không hiện lại.
- `nhiem-vu-today.png`, `nhiem-vu-newbie.png`, `nhiem-vu-weekly.png`, `nhiem-vu-monthly.png`, `nhiem-vu-journey.png`, `nhiem-vu-achievement.png`: từng tab của Trung tâm Nhiệm vụ.

## Còn mở

- Ô theo dõi nhiệm vụ nằm đè lên thanh DEV (thanh này chỉ có ở bản `?dev=1`). Bố cục chính thức của ô sẽ đặt lại ở Đợt 3, khi làm giao diện v3.
- Người mới khá dư xu: khoảng 12.000 xu khi xong chuỗi Tân thủ ở cấp 6. Sẽ xem lại khi có chỗ tiêu xu mới ở Đợt 3–4.
- Hướng dẫn hiện chỉ là cửa sổ giới thiệu, chưa có mũi tên chỉ thẳng vào nút. Phần đó làm cùng HUD mới ở Đợt 3.
