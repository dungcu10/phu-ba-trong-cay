# CHỈ THỊ 10 — BẢN CẬP NHẬT TỔNG: ĐỒ HỌA MỚI + HỆ THỐNG GAMEPLAY ĐẦY ĐỦ NHƯ KHU VƯỜN TRÊN MÂY

Người ban hành: CTO/Game Director · Ngày 17/11/2026 · Chủ dự án đã duyệt toàn bộ phạm vi.
**Chỉ thị này thay thế chỉ thị 08 và 09.** Nhánh làm việc: `feat/10-ban-tong`, tạo từ `feat/cto-07-cho-may-giao-dien`.
Đính kèm: thư mục `PhuBa_BoHinh_v1/` (bộ hình đã duyệt) và `docs/PET_SYSTEM.md`.

---

## 0. QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (BẮT BUỘC)

1. **Cơ chế chơi chép 100% theo Khu Vườn Trên Mây.** Tên riêng, hình ảnh, câu chữ, bảng số liệu là của mình. Cấm dùng tên, hình hoặc chữ của game gốc (Tutu, Chu Chu, Én Xanh, Vẹt Cầu Vồng, tên chậu, tên máy của họ…).
2. **Mọi hình ảnh do chủ dự án vẽ bằng Gemini**, CTO duyệt. Mày không tự vẽ, không tự sáng tác, không dùng hình tạm làm bản cuối. Thiếu hình thì ghi vào mục "CẦN HÌNH" trong báo cáo.
3. **Bộ hình `PhuBa_BoHinh_v1` là đủ cho bản cập nhật này.** Tính năng nào chưa có hình riêng thì phải dùng lại hình đã có, đúng như hướng dẫn ở mục 2.
4. **Một bản cập nhật duy nhất**, nhưng làm và tự kiểm theo đúng thứ tự các mốc ở mục 6. Nộp một lần, CTO nghiệm thu một lần.
5. Không merge vào `main`. Không xóa save của người chơi. Không đổi giá hạt giống và giá bán nông sản hiện có.

---

## 1. MỤC TIÊU TRẢI NGHIỆM — VÌ SAO NGƯỜI CHƠI QUAY LẠI

Mỗi tính năng phải phục vụ ít nhất một trong 5 lý do sau. Tính năng nào không phục vụ lý do nào thì cắt.

| Lý do quay lại | Nhờ tính năng nào |
|---|---|
| **Luôn có việc để làm trong 2–5 phút** | Thu hoạch, bắt bọ, cho chim ăn, nạp xưởng, giao đơn |
| **Luôn có thứ đang chờ chín** | Cây, xưởng chế biến, chim bắt sâu khi tắt game, lượt đào hồi lại, mồi câu mỗi ngày |
| **Mỗi cấp mở ra thứ mới** | Bảng mở khóa ở mục 5: mỗi cấp từ 2 đến 16 đều có ít nhất một thứ mới |
| **Mục tiêu dài hạn rõ ràng** | Chậu cấp cao, bộ chậu 6 chiếc, tầng mây mới, chim cấp cao, sưu tầm đủ bọ, đúc chậu hiếm |
| **Có người để so và giao lưu** | 40 Phú Bà, Chợ Mây, nhờ hàng xóm giúp, bảng xếp hạng |

Quy tắc cảm giác: mỗi hành động có phản hồi ngay (dưới 100 ms), có số bay, có âm thanh. Phần thưởng lớn có màn ăn mừng ngắn, bỏ qua được. Không phạt người chơi bỏ game vài ngày.

---

## 2. ĐỒ HỌA — TÍCH HỢP BỘ HÌNH `PhuBa_BoHinh_v1`

### 2.1. Danh sách file và cách dùng

| File | Dùng làm |
|---|---|
| `1_tang-may/tang1_dong-may-ngoc.png` | Tầng 1 |
| `1_tang-may/tang2_vuon-tra-suong-som.png` | Tầng 2 |
| `1_tang-may/tang3_ruong-bac-thang-hoang-kim.png` | Tầng 3. Ảnh nhỏ 1024 px: phóng to bằng Lanczos hoặc thuật toán phóng to chất lượng cao, không làm mờ. Tầng này phải hiển thị cùng tỉ lệ với các tầng khác. |
| `1_tang-may/tang4_vuon-trang-lo-lung.png` | Tầng 4 |
| `1_tang-may/vong-may-om-cay_nang-va-trang.png` | Vòng mây ôm chỗ cây leo xuyên qua tầng. Bản nắng dùng cho tầng 1–3, bản trăng cho tầng 4. Mỗi vòng cắt thành **nửa sau** (vẽ sau thân cây) và **nửa trước** (vẽ đè lên thân cây). |
| `2_cay-leo/than-cay.png` | Đoạn thân lặp. Phải sửa đầu trên và đầu dưới cho nối liền nhau (xem 2.3). |
| `2_cay-leo/goc-cay.png` | Gốc cây, dưới tầng thấp nhất. Mây dưới gốc đang xám: được phép **chỉnh màu riêng vùng mây** sang hồng đào và tím giống mây các tầng. Không sửa phần thân. |
| `2_cay-leo/ngon-cay.png` | Ngọn cây, trên tầng cao nhất đã mở. Có thể hơi chỉnh độ bão hòa cho khớp màu thân. |
| `2_cay-leo/la-nu-tua-den-roi.png` | 6 lá, 3 cành nụ, 2 tua cuốn, 2 đèn lồng. Rải dọc thân cây. Đèn lồng còn dùng làm **đồ trang trí đặt trên tầng** (mục 3.9). |
| `3_be-chau/be-chau_3-kieu-x2.png` | Bệ đặt chậu, gồm 3 kiểu, mỗi kiểu 2 biến thể. Đá xám cho tầng 1, sa thạch cho tầng 2 và 3, đá trăng cho tầng 4. Hai biến thể xen kẽ nhau để không lặp. |
| `4_nhan-vat/bo_8-loai.png` | 8 loại sâu bọ (thứ tự ở mục 3.2). |
| `4_nhan-vat/chim_4-loai_dau-va-bay.png` | 4 loài chim. Hàng trên là dáng đậu, hàng dưới là dáng bay (mục 3.3). |
| `4_nhan-vat/xu-xu_4-dang.png` | Xu Xu: đứng vui, vẫy tay, ngủ, ngạc nhiên (mục 3.11). |
| `5_tham-khao_KHONG-DUA-VAO-GAME/` | **Chỉ để tham khảo** cách ghép tầng, cây leo và bệ. Không đưa vào game. |

### 2.2. Xử lý ảnh (làm bằng script, đặt trong `tools/art/`, chạy lại được)

1. **Tách nền trắng.** Cẩn thận: mây trắng nằm trên nền trắng, nếu xóa hết điểm trắng thì sẽ ăn mất mây.
   - Bắt buộc dùng cách lan từ mép ảnh vào trong (flood fill), với ngưỡng thấp.
   - Sau đó làm mềm mép bằng alpha 1–2 px và khử viền trắng (defringe).
   - Kiểm tra từng tầng trên **nền trời tối** và **nền trời hồng**: không được có viền trắng, không được thủng lỗ trong mây.
   - Hình nào không tách sạch được thì ghi vào "CẦN HÌNH" để chủ dự án vẽ lại trên nền xanh lá thuần.
2. **Cắt các tờ nhiều hình** thành hình rời, đặt tên theo id (ví dụ `bug.ladybird`, `bird.sky-sparrow.perch`).
3. **Gom atlas** bằng pipeline hiện có. Mỗi atlas tối đa 2048×2048, có bản @1x và @2x. Mỗi tầng mây là một ảnh riêng, tải khi cần (lazy-load).
4. **Điểm neo:**
   - Tầng mây: đường cỏ phía trước, chỗ bệ đứng.
   - Bệ chậu: tâm mặt trên của bệ, chỗ chậu đặt lên.
   - Chim: chân khi đậu.
   - Bọ: tâm thân bọ.
   - Lá, nụ: cuống, chỗ gắn vào thân.
   - Đèn lồng: móc treo.
5. **Không vẽ lại, không sáng tác.** Chỉ được phép: tách nền, cắt hình, phóng to, chỉnh màu vùng mây ở gốc cây, chỉnh độ bão hòa ngọn cây, và sửa vết nối của thân cây.

### 2.3. Ghép cảnh

**Thứ tự lớp từ xa đến gần:**
1. Bầu trời theo giờ
2. Mây xa
3. Nửa sau vòng mây
4. Thân cây leo
5. Lá, nụ, đèn rải dọc thân
6. Tầng mây
7. Nửa trước vòng mây
8. Bệ chậu
9. Chậu
10. Cây trồng
11. Bọ
12. Chim
13. Hiệu ứng
14. Giao diện

**Cây leo** đứng dọc bên trái màn hình, đè lên mép trái mọi tầng. Mép mây hình cung có sẵn trong ảnh tầng 2 và tầng 4 được phép bị cây che một phần.

**Thân cây lặp liền mạch:**
- Lấy đoạn giữa của `than-cay.png`.
- Xóa phần lá và đèn dính vào thân, rồi vá lại bằng chính vân thân bên cạnh (clone).
- Trộn 10–15% chiều cao ở đầu trên và đầu dưới để hai đầu khớp nhau.
- Kiểm tra: ghép 3 đoạn liền nhau, phóng 200% ở chỗ nối, không thấy vết nối.

**Rải lá, nụ, đèn** bằng seed cố định theo từng tầng: mỗi lần mở game trông giống nhau, nhưng các tầng khác nhau. Mật độ khoảng 1 vật mỗi 60 pt chiều cao. Đèn lồng tối đa 1 cái mỗi tầng.

**Bệ chậu:**
- Code đặt bệ đúng tọa độ ô chậu, dùng `SLOT_GEOM` và layout hiện tại.
- Bóng tiếp xúc dưới bệ hòa vào cỏ.
- Bệ thiếu hoặc thừa so với số ô là lỗi P1.

**Tỉ lệ:**
- Mọi tầng có cùng chiều rộng hiển thị.
- Mặt cỏ phía trước phải chứa đủ **6 ô chậu** (số tối đa sau khi mở rộng tầng), không ô nào chạm mép mây.

**Chuyển động:**
- Tầng nhấp nhô ±4 pt, chu kỳ 5 giây, các tầng lệch pha nhau.
- Lá đung đưa nhẹ, đèn lồng lắc nhẹ.
- Chỉ tầng đang nhìn và hai tầng kề nó mới chạy chuyển động.
- Tầng ở xa mờ dần (giữ hàm `fade` hiện có).

---

## 3. HỆ THỐNG GAMEPLAY (theo cơ chế Khu Vườn Trên Mây)

> Mọi con số dưới đây là **giá trị khởi điểm**. Tất cả nằm trong `content/base/*.json`, code không viết cứng. Mốc 6 phải chạy mô phỏng và chỉnh số cho đạt các ràng buộc ở mục 4.
> Mọi hệ thống: chạy tất định, vẫn tính đúng khi tắt game, **BOT hàng xóm dùng chung code và luật với người chơi**.

### 3.1. Tầng mây

| # | Tầng | Mở ở cấp | Chi phí mở | Đặc tính |
|---|---|---|---|---|
| 1 | Đồng Mây Ngọc | 1 | miễn phí | Không |
| 2 | Vườn Trà Sương Sớm | 5 | 2.000 xu + 3 Sợi Mây Kết + 2 Giọt Sương Trời | Cây Rau Thảo lớn nhanh hơn 10% |
| 3 | Ruộng Bậc Thang Hoàng Kim | 10 | 8.000 xu + 6 Sợi Mây + 4 Giọt Sương | Cây Quả cho thêm 10% sản lượng |
| 4 | Vườn Trăng Lơ Lửng | 16 | 25.000 xu + 10 Sợi Mây + 8 Giọt Sương | Ban đêm (giờ thiết bị) cây lớn nhanh hơn 25%. Đom Đóm Sao xuất hiện nhiều gấp đôi. |

- **Sợi Mây Kết** và **Giọt Sương Trời** là vật phẩm mở tầng, tương đương "keo mây" và "nước thần" của game gốc.
  - Nguồn: rơi ngẫu nhiên khi thu hoạch (2%), phần thưởng đơn hàng, Rương Mây Trôi, đào Biển Mây (3.7), giúp hàng xóm, nhiệm vụ ngày.
  - Mua được trên Chợ Mây từ BOT.
- **Mở rộng tầng:** mỗi tầng bắt đầu với 4 ô chậu. Mở thêm ô 5 và ô 6 bằng xu và Sợi Mây. Bệ mới trồi lên kèm bụi mây bung ra.
- **Màn mở tầng mới:**
  1. Máy quay lướt lên.
  2. Cây leo mọc dài thêm, ngọn cây dời lên trên tầng mới.
  3. Tầng trồi lên từ biển mây, có nảy.
  4. Vòng mây ôm vào thân cây.
  5. Các bệ hiện lần lượt, cách nhau 120 ms.
  6. Xu Xu ở dáng ngạc nhiên, rồi chuyển sang dáng vui.
- Dữ liệu: cập nhật `floors.json` (thêm tầng 4, thêm chi phí vật phẩm, thêm `slotsStart`/`slotsMax`). Cập nhật `docs/GAMEPLAY_DESIGN.md`: tầng 4 đổi từ "Hồ Sen Cầu Vồng" thành "Vườn Trăng Lơ Lửng".

### 3.2. Sâu bọ: từ 1 lên 8 loại, vừa hại cây vừa là nguyên liệu

Thứ tự hình trong `bo_8-loai.png`, đọc từ trái sang phải, trên xuống dưới:

| # | id | Tên | Độ hiếm | Đậu trên |
|---|---|---|---|---|
| 1 | `base:bug.ladybird` (**giữ id cũ**) | Bọ Rùa Mây | Thường | Hoa, Quả |
| 2 | `base:bug.leaf-worm` | Sâu Lá Non | Thường | Rau Thảo |
| 3 | `base:bug.pink-moth` | Bướm Phấn Hồng | Khá | Hoa |
| 4 | `base:bug.jade-beetle` | Cánh Cam Ngọc | Khá | Quả |
| 5 | `base:bug.dew-hopper` | Châu Chấu Sương | Khá | Rau Thảo |
| 6 | `base:bug.gold-scarab` | Bọ Hung Vàng | Hiếm | Mọi cây có thời gian lớn ≥ 30 phút |
| 7 | `base:bug.star-firefly` | Đom Đóm Sao | Hiếm | Mọi hệ, **chỉ ban đêm** |
| 8 | `base:bug.jade-cicada` | Ve Sầu Ngọc | Rất hiếm | Hoa Đồng Tiền Vàng, cây Kỳ Hoa |

**Dữ liệu:**
- Thêm trường `bugs: [{id, weight}]` cho từng cây trong `crops.json`.
- Quy tắc **số lượng** bọ trong `systems/growth.ts` giữ nguyên. Chỉ thêm bước chọn **loại** bọ theo trọng số, dùng bộ sinh ngẫu nhiên tất định hiện có.
- Kiểm tra trong `content.ts`: mỗi cây phải có ít nhất 1 loại bọ Thường, mọi id bọ phải tồn tại.

**Hiển thị:**
- Bọ bò hoặc bay trên cây.
- Chạm vào bọ: bọ bay vào túi, số bay lên.
- Bọ lần đầu bắt được có thẻ "Bọ mới!" và vào **Sổ Sâu Bọ** (sưu tầm, có thưởng khi đủ 8 loại).

### 3.3. Chim bắt sâu (thú nuôi chính)

Thứ tự hình trong `chim_4-loai_dau-va-bay.png`, từ trái sang phải:

| id | Tên | Mở ở cấp | Bắt bọ trên | Có được |
|---|---|---|---|---|
| `bird.sky-sparrow` | Sẻ Mây | 3 | Cây Hoa | Thuê 3 ngày 300 xu, hoặc mua 15 ngọc |
| `bird.leaf-robin` | Chích Chòe Lá | 5 | Rau Thảo | Thuê 3 ngày 600 xu, hoặc mua 25 ngọc |
| `bird.kingfisher` | Bói Cá Ngọc | 7 | Cây Quả | Thuê 3 ngày 900 xu, hoặc mua 35 ngọc |
| `bird.night-owl` | Cú Mèo Đêm | 12 | Mọi hệ, chỉ ban đêm. Bắt được bọ Hiếm. | Chỉ mua, 60 ngọc |

Ngọc ở đây là **ngọc kiếm trong game**. Không có nạp tiền.

**Luật:**
- Mỗi tầng có 1 cành đậu, mở thêm cành thứ 2 ở cấp 14. Gắn chim vào tầng nào thì chim chỉ làm việc ở tầng đó.
- **Thanh no 0–100.** Mỗi giờ giảm 12.5, tức đầy thì no được 8 giờ.
  - Cho ăn **Hạt Kê Mây** (mua ở cửa hàng, 20 xu): +50.
  - Cho ăn nông sản đúng hệ của chim: +35, và thêm điểm thân thiết.
- **Còn no:** cứ mỗi chu kỳ (cấp 1 là 6 phút, cấp tối đa là 3 phút) chim bắt 1 con bọ hợp hệ trên tầng của nó.
  - **Bắt buộc gọi đúng hàm `catchBug` mà người chơi dùng**, không được viết luồng thứ hai.
  - Chim không tạo ra bọ, chỉ bắt bọ đang có.
- **Đói:** chim ngủ trên cành. Không chết, không mất chim, không bị phạt gì thêm.
- **Cấp chim 1–10** tăng theo số bọ đã bắt. Lên cấp thì bắt nhanh hơn và no lâu hơn.
  - Từ cấp 5, chim có 5% cơ hội bắt được bọ hiếm hơn một bậc.
- **Thuê:** hết hạn thì chim bay đi. Có báo trước 1 giờ, bọ đã bắt vẫn giữ.
- **Đi giao hàng** (mục 3.6): chim đang đi giao thì không bắt sâu. Người chơi phải tự chọn dùng chim vào việc nào.

**Hiển thị:**
- Cành đậu ở mép phải tầng.
- Chim đậu, thỉnh thoảng rỉa lông (lắc đầu, nhún bằng tween).
- Khi bắt: chuyển sang hình dáng bay, bay theo đường cong tới chậu, mổ bọ, rồi bay về.
- Chim đói: hiện biểu tượng bát hạt trên cành, không bật hộp thoại.
- **Bảng chim** gồm: thanh no, cấp, số bọ đã bắt hôm nay, hạn thuê, nút cho ăn, nút cho ăn hết (cho tất cả chim cùng lúc).

### 3.4. Chậu: nâng cấp bằng nhiều loại bọ, bộ chậu, chậu hiệu ứng

**Công thức nâng cấp** trong `pots.json`, phần `growth.materials`:
- Cấp 1–9: bọ Thường.
- Từ cấp 10: thêm bọ Khá **đúng hệ** của chậu (theo `focus`/`favoredFamily`).
- Từ cấp 25: thêm bọ Hiếm.
- Các mốc tiến hóa: thêm 1–3 bọ Rất hiếm.
- Giữ nguyên vật liệu cũ (Đất Sét Mây, mảnh chậu).

**Màn nâng cấp:**
- Hiện từng loại bọ: đủ hay thiếu, kèm số lượng.
- Bấm vào loại bọ thiếu thì hiện gợi ý "Trồng cây X để gặp bọ Y" và "Chim Z bắt được bọ này".

**Bộ chậu:**
- Đặt **đủ 6 chậu cùng một bộ trên cùng một tầng** thì kích hoạt hiệu ứng bộ.
- Có thêm hiệu ứng nhỏ hơn khi đặt **6 chậu khác loại nhau** (bộ "Muôn Màu").
- Kiểm tra lại `potsets.json` cho đúng quy tắc này.
- Trên tầng hiện vầng sáng khi bộ đang kích hoạt.

**Hiển thị:** chậu đặt trên bệ (mục 2.3). Giữ nguyên `soil`, `mouth`, `plantFit`, `plantSink` đã sửa.

### 3.5. Xưởng Bọ (chế biến)

Tương đương "bọ máy" của game gốc. Không cần hình nhà xưởng: Xưởng Bọ là **một cửa sổ giao diện**. Mỗi máy do một con bọ trong bộ hình đứng làm, dùng hình bọ có sẵn kèm chuyển động làm việc (lắc, nhún, hạt bay ra).

| Máy | Thợ (hình bọ) | Mở ở cấp | Đầu vào | Thành phẩm |
|---|---|---|---|---|
| Máy Sấy Hoa | Bọ Rùa Mây | 4 | 3 hoa | 1 Hoa Sấy |
| Nồi Mứt | Cánh Cam Ngọc | 7 | 4 quả | 1 Hũ Mứt |
| Máy Ép Nước | Châu Chấu Sương | 10 | 3 Rau Thảo + 1 quả | 1 Chai Nước Ép |
| Máy Mài Ngọc | Bọ Hung Vàng | 16 | 3 khoáng (3.7) | 1 Ngọc Mây hoặc đá quý dùng đúc chậu |

- Hàng chờ 2 khe, mở thêm tới 4 khe bằng xu.
- Máy vẫn chạy khi tắt game. Thành phẩm bay vào kho.
- **Nâng sao máy (1–5 sao)** bằng sâu bọ và xu. Mỗi sao: giảm 5% thời gian chế biến, tăng 5% xu và EXP khi giao đơn có hàng của máy đó.
- Hàng chế biến **bán được trên Chợ Mây** và là nguyên liệu chính của đơn hàng giá trị cao.
- Ràng buộc: giá trị hàng chế biến không quá 1,6 lần tổng giá nông sản đầu vào.

### 3.6. Đơn hàng khinh khí cầu và chim giao hàng

- **Bảng đơn** có 6 ô, mở rộng tới 9 ô theo cấp. Mỗi đơn cần 2–4 loại hàng, gồm nông sản và hàng chế biến.
- Đóng đủ thùng thì bấm **Gửi**, khinh khí cầu bay đi trong 30 phút đến 2 giờ tùy đơn, rồi trả xu, EXP, đôi khi kèm Sợi Mây, Giọt Sương hoặc bọ hiếm.
- **Chọn chim dẫn đường** khi gửi thùng (không bắt buộc):
  - Sẻ Mây: +5% xu
  - Chích Chòe Lá: +10% EXP
  - Bói Cá Ngọc: +10% xu
  - Cú Mèo Đêm: +20% EXP
  - Chim đi cùng khinh khí cầu tới khi về, trong thời gian đó không bắt sâu.
- **Đơn hiếm** (viền vàng): thưởng gấp đôi, có hạn 24 giờ.
- Bỏ đơn được: đơn mới sẽ đến sau một khoảng chờ, giữ nguyên quy tắc hiện có.
- Người chơi có thể **nhờ hàng xóm góp hàng**: mỗi ngày nhờ được 1 lần, BOT hàng xóm có hàng thì sẽ góp.

### 3.7. Biển Mây Bí Ẩn (đào khám phá)

Tương đương "đào mỏ" của game gốc. **Dùng lại hình mây có sẵn và Xu Xu**, không cần hình mỏ.

- Mở ở cấp 8. Nút vào nằm dưới tầng thấp nhất (gốc cây leo).
- Màn chơi là lưới **6×8 cụm mây**: lấy các cụm mây cắt từ ảnh tầng và vòng mây, xoay và co giãn ngẫu nhiên để không lặp.
- Chạm vào một cụm thì Xu Xu thổi tan mây (dáng vẫy tay) và lộ ra ô bên dưới. Mỗi lần chạm tốn 1 **Năng Lượng Gió**:
  - Tối đa 30.
  - Hồi 1 điểm mỗi 6 phút, kể cả khi tắt game.
  - Thêm 10 điểm miễn phí mỗi ngày.
- Ô bên dưới có thể là: trống, **khoáng sản** (Đá Mây, Mảnh Đồng, Mảnh Bạc, Vàng Vụn, Ngọc Thô), Sợi Mây, Giọt Sương, bọ hiếm, **rương** (cần thổi tan 2×2 ô xung quanh mới mở được).
- Mỗi bản đồ tạo bằng seed theo ngày. Dọn hết bản đồ thì có thưởng lớn và mở bản đồ mới.
- Xu Xu dùng dáng ngạc nhiên khi tìm thấy rương, dáng ngủ khi hết Năng Lượng Gió.

### 3.8. Đúc chậu

- Mở ở cấp 12, nằm ở Lò Gốm (đã có).
- Công thức: khoáng sản + Ngọc Mây + xu → một chậu cụ thể **trong bộ chậu đã có hình** (catalog chậu Blender, chậu chữ ký).
- Khoáng càng hiếm thì chậu ra càng hiếm.
- Có tỉ lệ ra chậu "Hoàn Mỹ" (+1 sao chỉ số) là 10%.
- Hiện công thức rõ ràng: thiếu gì, lấy ở đâu.

### 3.9. Câu cá trên mây

- Mở ở cấp 14. Câu từ mép tầng mây xuống biển mây.
- Mỗi ngày được 1 mồi miễn phí. Chế thêm mồi bằng nông sản: 2 Rau Thảo = 1 Mồi Thường, 1 Hũ Mứt = 1 Mồi Thơm.
- **Trò chơi:** thả câu, chờ phao rung, chạm đúng lúc để giữ vạch căng dây trong vùng xanh trong 3–6 giây.
- Cá mây có 5 độ hiếm. Cá đổi được: xu, Giọt Sương, bọ hiếm, và **điểm Sổ Cá** (sưu tầm có thưởng).

### 3.10. Trang trí có hiệu ứng

- Đặt **đèn lồng** và **pha lê** (hình có sẵn trong bộ cây leo và dưới đáy tầng) vào khe trang trí của từng tầng.
- Mỗi tầng có 2 khe trang trí.
- Hiệu ứng:
  - Đèn lồng: +2% EXP khi thu hoạch trên tầng đó.
  - Pha lê: +2% xu khi thu hoạch trên tầng đó.
  - Cùng tầng thì không cộng dồn quá 6%.
- Mua bằng xu hoặc nhận từ Rương Mây Trôi.

### 3.11. Xu Xu: linh vật hướng dẫn

- Dùng 4 dáng có sẵn:
  - Vui: chào, nhận thưởng.
  - Vẫy tay: hướng dẫn, gợi ý.
  - Ngủ: ban đêm, hết năng lượng.
  - Ngạc nhiên: tìm thấy đồ hiếm, mở khóa tính năng.
- Xu Xu xuất hiện ở góc màn hình kèm bong bóng thoại ngắn **mỗi khi mở khóa tính năng mới** (bảng mục 5). Bấm để xem hướng dẫn 2–3 bước, có thể bỏ qua.
- Chạm vào Xu Xu thì nó phản ứng, tối đa 1 lần thưởng nhỏ mỗi giờ.

### 3.12. Những hệ thống đã có: giữ và nối vào hệ mới

- **Chợ Mây và 40 Phú Bà:** thêm vào danh sách mua bán các món: hàng chế biến, Sợi Mây, Giọt Sương, khoáng sản, mồi câu. **Không** mua bán chim, không mua bán bọ Rất hiếm.
- **Hàng xóm giúp đỡ:** BOT ghé giúp bắt bọ (đã có), góp hàng cho đơn (mới).
- **BOT:** có chim, xưởng, mở tầng, đúc chậu theo đúng luật của người chơi. Dùng chung code.
- **Nhiệm vụ** (`quests.json`, `missions.json`): thêm nhiệm vụ ngày, tuần và hành trình cho mọi hệ mới (cho chim ăn, giao đơn có hàng chế biến, đào Biển Mây, câu cá, đủ bộ chậu…).
- **Quà mỗi ngày, Rương Mây Trôi, Lễ Hội:** thêm vật phẩm mới vào bảng phần thưởng.

---

## 4. KINH TẾ VÀ CÂN BẰNG

Tạo `tools/economy-sim.ts`: mô phỏng **30 ngày** cho 3 kiểu người chơi:
- Chơi nhẹ: 3 phiên mỗi ngày, mỗi phiên 3 phút.
- Chơi vừa: 6 phiên mỗi ngày.
- Chơi nặng: 12 phiên mỗi ngày.

Kết quả ghi vào `docs/reviews/economy-10.md`.

**Ràng buộc phải đạt:**
1. Ngày 1 (chơi vừa) lên được khoảng cấp 5–6. Ngày 7 khoảng cấp 12–14. Ngày 30 khoảng cấp 22–26.
2. **Không có vòng lặp tạo xu vô hạn.** Đặc biệt kiểm tra các vòng: xưởng chế biến → Chợ Mây; câu cá ↔ chế mồi; đào → Mài Ngọc → bán.
3. Có chim so với không chim: tổng số bọ tăng không quá 35%; thời gian đưa chậu lên cấp 25 rút ngắn không quá 25%.
4. Không loại bọ nào là nút thắt chặn tiến độ quá 2 ngày. Không loại bọ nào bị thừa vô dụng.
5. Mở tầng 2 khi chơi vừa: không quá 2 ngày kể từ khi đủ cấp 5. Mở tầng 4: không quá 5 ngày kể từ khi đủ cấp 16.
6. Tổng thưởng phần trăm từ chậu, bộ chậu, trang trí, đặc tính tầng và chim giao hàng trên một lần thu hoạch không vượt 60%.
7. Thu nhập xu theo giờ của cây đầu và cây cuối vẫn giữ đúng thứ tự đã cân bằng ở các review trước (R2).

---

## 5. NHỊP MỞ KHÓA — MỖI CẤP MỘT THỨ MỚI

| Cấp | Mở | Xu Xu nói |
|---|---|---|
| 1 | Tầng 1, 4 ô chậu, Bọ Rùa Mây | Chào, hướng dẫn gieo hạt |
| 2 | Đơn khinh khí cầu, Sâu Lá Non | Giao đơn |
| 3 | **Sẻ Mây**, Bướm Phấn Hồng | Thuê chim, cho ăn |
| 4 | **Xưởng Bọ: Máy Sấy Hoa** | Chế biến |
| 5 | **Tầng 2 Vườn Trà**, Chích Chòe Lá, Châu Chấu Sương | Mở tầng |
| 6 | Bộ chậu, mở rộng ô 5 | Đặt 6 chậu cùng bộ |
| 7 | Bói Cá Ngọc, Nồi Mứt, Cánh Cam Ngọc | |
| 8 | **Biển Mây Bí Ẩn** | Đào khám phá |
| 9 | Trang trí đèn lồng và pha lê, Bọ Hung Vàng | |
| 10 | **Tầng 3 Ruộng Bậc Thang**, Máy Ép Nước | |
| 11 | Chim dẫn đường cho khinh khí cầu, đơn hiếm | |
| 12 | **Cú Mèo Đêm**, **Đúc chậu**, Đom Đóm Sao | |
| 13 | Mở rộng ô 6, nhờ hàng xóm góp hàng | |
| 14 | **Câu cá**, cành đậu thứ 2 | |
| 15 | Ve Sầu Ngọc, Sổ Sâu Bọ có thưởng | |
| 16 | **Tầng 4 Vườn Trăng**, Máy Mài Ngọc | |

Dữ liệu nằm trong `features.json`. Tính năng chưa mở thì không hiện nút, hoặc hiện ổ khóa kèm "Mở ở cấp X".

---

## 6. THỨ TỰ LÀM VÀ TỰ KIỂM (nộp một lần, nhưng làm và kiểm theo đúng thứ tự)

| Mốc | Nội dung | Tự kiểm trước khi sang mốc sau |
|---|---|---|
| M1 | Pipeline ảnh, ghép cảnh 4 tầng, cây leo, bệ chậu, vòng mây | Ảnh ghép 2388×1668: 3 tầng chồng nhau, không viền trắng, không vết nối, 60 FPS khi cuộn |
| M2 | Lưu trữ: `SAVE_VERSION` 12, migration 11→12, cập nhật reconcile cho mọi trường mới | Save cũ mở được, không mất xu, chậu, Bọ Rùa |
| M3 | 8 loại bọ, công thức nâng chậu, Sổ Sâu Bọ | Test tất định; Đom Đóm Sao không xuất hiện ban ngày |
| M4 | Chim bắt sâu | Tắt game 8 giờ, mở lại: kết quả khớp với mô phỏng chạy liên tục |
| M5 | Tầng 2–4, mở và mở rộng tầng, vật phẩm mở tầng, đặc tính tầng | |
| M6 | Xưởng Bọ, đơn hàng mới, chim dẫn đường, nhờ góp hàng | |
| M7 | Biển Mây, đúc chậu, câu cá, trang trí | |
| M8 | Xu Xu hướng dẫn, nhịp mở khóa, nhiệm vụ, BOT dùng hệ mới, Chợ Mây | |
| M9 | Mô phỏng kinh tế, chỉnh số cho đạt mục 4 | Báo cáo `economy-10.md` |
| M10 | Kiểm thử tổng, hiệu năng, bản thử gh-pages | Mục 7 |

**Lưu trữ:**
- Giữ nguyên mọi id cũ.
- Trường mới:
  - `birds[]`
  - `workshop`
  - `floors[].slots`
  - `floors[].decor`
  - `seaMap`
  - `energy`
  - `fishing`
  - `collections`
- Mỗi trường mới đều có giá trị mặc định khi đọc save cũ, và được reconcile làm sạch.

---

## 7. TIÊU CHÍ NGHIỆM THU (CTO tự kiểm lại, không dựa vào báo cáo)

1. **Đúng:** typecheck sạch. Toàn bộ test xanh: 143 test cũ không được hỏng, và có test mới cho mọi hệ.
   - Mỗi hệ có test tất định.
   - Có test tắt game rồi mở lại.
   - Có test migration.
   - Có test BOT dùng chung luật.
2. **Kinh tế:** đạt đủ 7 ràng buộc ở mục 4. Có file mô phỏng chạy lại được.
3. **Hiệu năng (iPad Pro M2):**
   - Giữ 60 FPS khi cuộn 4 tầng, mỗi tầng có 6 chậu, 2 chim đang bay và 8 con bọ.
   - Mô phỏng 40 BOT × 7 ngày (có chim và xưởng) chạy dưới 150 ms.
   - Mỗi atlas tối đa 2048×2048. Tầng mây tải lười.
4. **Đồ họa:** đúng mục 2. Ảnh ghép thử không có viền trắng, không có vết nối thân cây, bệ khớp ô chậu, mọi hình đúng điểm neo.
5. **Trải nghiệm:**
   - Mỗi hành động có phản hồi dưới 100 ms.
   - Không có hộp thoại chặn màn hình khi chim đói hay hết năng lượng.
   - Mỗi cấp 1–16 đều có thứ mới (mục 5).
6. **Không hỏng cái cũ:** Chợ Mây, 40 Phú Bà, giao diện fantasy, căn đất trong chậu, cân bằng chậu chữ ký vẫn hoạt động như trước.

---

## 8. BÁO CÁO NỘP KÈM

- Link bản thử gh-pages.
- Bảng **mốc M1–M10**: đã xong hay chưa xong, kèm bằng chứng.
- **Ảnh chụp** (2388×1668):
  - Toàn cảnh 3 tầng với cây leo
  - Tầng 4 ban đêm
  - Màn nâng chậu thiếu bọ Khá
  - Chim đang bay bắt bọ
  - Chim đói ngủ
  - Xưởng Bọ đang chạy
  - Bảng đơn có chọn chim dẫn đường
  - Biển Mây đang đào
  - Câu cá
  - Xu Xu hướng dẫn
- Kết quả `economy-10.md`.
- Mục **CẦN HÌNH**: biểu tượng vật phẩm mới còn dùng hình tạm (xem mục 9).
- Những chỗ đã làm khác chỉ thị: nêu lý do. **Không tự ý đổi phạm vi.**

---

## 9. CẦN HÌNH (chủ dự án vẽ bằng Gemini; trong lúc chờ, dùng biểu tượng tạm và ghi rõ trong ASSET_SOURCES)

Biểu tượng cho vật phẩm mới, mỗi nhóm là một tờ:
- Hàng chế biến: Hoa Sấy, Hũ Mứt, Chai Nước Ép, Ngọc Mây.
- Khoáng sản: Đá Mây, Mảnh Đồng, Mảnh Bạc, Vàng Vụn, Ngọc Thô.
- Vật phẩm mở tầng: Sợi Mây Kết, Giọt Sương Trời. Thức ăn chim: Hạt Kê Mây. Mồi câu: Mồi Thường, Mồi Thơm. Năng Lượng Gió.
- 5 loại cá mây.

CTO sẽ gửi câu lệnh Gemini cho các tờ này. Mọi biểu tượng tạm phải được thay **trước khi merge**.

## 10. CẤM

- Không tự vẽ hay tự sáng tác hình. Không dùng tên, hình, chữ của Khu Vườn Trên Mây.
- Không đổi giá hạt giống và giá bán nông sản hiện có. Không có nạp tiền, không có quảng cáo.
- Không phạt người chơi vì vắng mặt: chim không chết, cây không héo, không mất đồ.
- Không viết luồng code riêng cho BOT. Không viết luồng bắt bọ thứ hai cho chim.
- Không merge vào `main`. Không xóa asset cũ.
