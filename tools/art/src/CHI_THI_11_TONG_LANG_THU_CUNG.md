# CHỈ THỊ 11 (TỔNG) — LÀNG PHÚ BÀ · BẦU TRỜI 20 TẦNG · THÚ CƯNG · MẠNG TÍNH NĂNG HOÀN CHỈNH

Người ban hành: CTO/Game Director · Ngày 18/11/2026 · Chủ dự án đã duyệt.

**Chỉ thị này thay thế cả `CHI_THI_11_THU_CUNG.md` và `CHI_THI_12_LANG_DO_CAO.md`** (hai bản đó hủy, không làm theo nữa).

- Hình dùng: thư mục `PhuBa_BoHinh_v1/` (gồm `4_nhan-vat/thu-cung_*`, `6_lang-va-bau-troi/*`). Hình đã đủ, không tự vẽ thêm.
- Đọc kèm: `CHI_THI_10_TONG.md` (đang làm).

---

## PHẦN A — QUAN HỆ VỚI CHỈ THỊ 10 VÀ CÁC ĐÍNH CHÍNH LÀM NGAY

### A1. Kết quả CTO kiểm tra chỉ thị 10, nhánh `feat/10-ban-tong`, commit `3bbc326`

- **Đã xong M1–M4**: xử lý ảnh và ghép cảnh, lưu trữ phiên bản 12, 8 loại bọ và công thức nâng chậu, chim bắt sâu.
- CTO tự chạy lại: **158/158 test đạt**.
- Code tốt:
  - Chim dùng chung lệnh `catchBug` với người chơi.
  - Chọn loại bọ tất định theo trọng số.
  - Đom Đóm Sao chỉ ra ban đêm.
  - `birds.json` đọc từ dữ liệu, không viết cứng.
  - Màn hình tầng 1 đẹp, đúng bộ hình.
- **Còn thiếu hoặc lỗi**, sửa trong lúc làm M5–M10:

| # | Mức | Vấn đề | Cách sửa | Tiêu chí đạt |
|---|---|---|---|---|
| D1 | P1 | BOT hàng xóm chưa có chim. `neighbors.ts` không gọi `birds.ts`. Vi phạm luật "BOT dùng chung luật". | BOT thuê/mua chim theo mục tiêu, cho ăn, gắn tầng; dùng chung `birds.ts`. | Test: 40 BOT × 7 ngày có chim bắt bọ; số bọ của BOT trong khoảng ±20% người chơi vừa |
| D2 | P2 | Nút "Chim" ở thanh trái hiện ngay từ cấp 1, trong khi chim mở ở cấp 3. | Mọi nút tính năng đi qua `features.json`. Chưa mở thì ẩn, hoặc hiện ổ khóa kèm "Mở ở cấp X". | Ảnh chụp cấp 1: không có nút Chim mở được |
| D3 | P2 | Hai thông báo chồng lên nhau và đè lên biển "Tầng 2 · Vườn Trà" ở phía trên. | Thông báo xếp thành hàng đợi, tối đa 2 dòng, không đè lên biển tầng (dịch xuống hoặc thu nhỏ). | Ảnh chụp có 3 thông báo liên tiếp: không chồng, không đè |
| D4 | P1 | `config.floorGen.names` có sẵn "Vườn Trăng Lơ Lửng" làm tên tầng sinh tự động, trùng với tầng 4 làm tay. | Bỏ tên đó khỏi danh sách sinh tự động. Danh sách tên tầng 5–20 làm lại theo mục C2. | Không có hai tầng trùng tên |
| D5 | P1 | Chỉ thị 10 ghi "4 → 6 ô chậu", nhưng dữ liệu hiện có là **6 → 10 ô** (`slotCount 6`, `maxSlots 10`) và kinh tế đã cân bằng theo đó. | **Giữ 6 → 10 ô**, bỏ dòng "4 → 6" của chỉ thị 10. Hàng trước 6 ô, hàng sau 4 ô so le, hàng sau nhỏ hơn 8% và hơi mờ. Mọi ô có bệ đá. Bộ chậu tính khi có 6 chậu cùng bộ trên cùng một tầng. | Ảnh chụp tầng đủ 10 chậu: không chậu nào đè lên nhau, không chạm mép mây |
| D6 | — | Merge vào `main` | Chủ dự án cho phép tự merge từng mốc qua PR, với điều kiện ở phần L. | Mỗi merge có tag và có dòng trong CHANGELOG |

### A2. Thứ tự làm

1. Làm xong chỉ thị 10 (M5–M10) cùng 6 đính chính ở A1, rồi nộp CTO.
2. Được phép làm **song song ngay bây giờ**: phần xử lý ảnh của chỉ thị này (mục B, bước N1), vì không đụng vào lõi game.
3. CTO nghiệm thu chỉ thị 10 xong thì làm phần còn lại của chỉ thị này. Nhánh mới `feat/11-tong`, tạo từ nhánh 10 đã được duyệt.

Mọi quy tắc chung của chỉ thị 10 vẫn áp dụng:
- Chép cơ chế, còn tên, hình, chữ là của mình.
- Code tất định, vẫn tính đúng khi tắt game.
- BOT dùng chung code với người chơi.
- Không phạt người chơi khi vắng mặt.
- Không nạp tiền, không quảng cáo.

---

## PHẦN B — MỤC TIÊU TRẢI NGHIỆM

Game gồm 3 trụ, cái này nối vào cái kia:

1. **LÀNG PHÚ BÀ (mặt đất), trung tâm điều hành.** Mỗi tính năng là một ngôi nhà. Nhà nào có việc thì hiện bong bóng báo trên mái. Mở game ra, nhìn làng là biết hôm nay cần làm gì.
2. **LEO LÊN TRỜI (20 tầng mây), tiến độ dài hạn.** Từ làng lên trời xanh, trời vàng, hoàng hôn tím rồi thiên giới đêm sao. Mỗi vùng trời mới là một cột mốc có thưởng.
3. **THÚ CƯNG, người làm vườn có nghề.** Thú cưng tự làm việc thật trong vườn, nâng cấp được, được sai đi làm việc vặt, và kết hợp được với nhau.

**Phép thử chất lượng:**
- Mở game lúc nào cũng có ít nhất 3 việc làm được ngay.
- Tắt game thì lúc nào cũng có ít nhất 3 thứ đang chạy chờ người chơi quay lại.
- Mỗi cấp từ 1 đến 20 đều có thứ mới (mục G).
- Mỗi hệ thống có ít nhất 2 đầu vào từ hệ khác và 2 đầu ra sang hệ khác (mục F).

---

## PHẦN C — HÌNH ẢNH: BẦU TRỜI, LÀNG, 20 TẦNG

### C1. Xử lý ảnh (bước N1, làm song song được; script đặt trong `tools/art/`, chạy lại được)

| File | Cách xử lý |
|---|---|
| `nen0_mat-dat-lang.png` (1024×1536) | Phóng to bằng Lanczos để phủ hết chiều ngang màn hình iPad nằm ngang. Giữ sắc nét phần đất, sông, cầu. Bầu trời phía trên làng sẽ bị `nen1` phủ lên. |
| `nen1…nen4` | Phóng to bằng Lanczos. `nen3` và `nen4` chỉ có 687×1024, phóng to xong làm mờ nhẹ 0,5–1 px nếu thấy vỡ hạt; bầu trời ở xa nên được phép mềm. Mỗi tấm **chồng lên tấm kế tiếp 12% chiều cao**, trộn bằng dải chuyển alpha mượt (smoothstep). Nếu lệch màu thì chỉ chỉnh riêng vùng chồng đó. |
| `nha_to1…`, `nha_to2…` | Tách nền trắng bằng cách lan từ mép vào (flood fill), làm mềm mép, khử viền trắng. Cắt thành 8 nhà rời, phóng to 2 lần. Điểm neo là tâm đáy khối cỏ. Nhà nào còn mờ trên iPad thì ghi vào CẦN HÌNH. |
| `thu-cung_cao-rong-se.png` | Nền hồng đặc: tách nền theo màu nền. Hàng 1 là Cáo, hàng 2 là Rồng, hàng 3 là Sẻ Mầm. Trong mỗi hàng, thứ tự từ trái sang phải: đứng, chạy, ngủ, vui. |
| `thu-cung_meo-may-con.png` | Mèo Mây Con đã có trong game (nhánh `feat/meo-may-con`, `worldArt.ts`). Dùng lại bản đã cắt, đưa vào hệ thú cưng ở mục E. |

### C2. Trục dọc, bầu trời và 20 tầng

```
nen4 Thiên Giới Đêm      tầng 16–20
nen3 Hoàng Hôn Tím       tầng 11–15
nen2 Trời Vàng Kim       tầng 6–10
nen1 Trời Thấp           tầng 1–5
nen0 LÀNG PHÚ BÀ         mặt đất (0 m)
```

**Bầu trời chạy thị sai (parallax):**
- Hệ số tính từ chiều cao thế giới, không viết cứng, sao cho 5 tấm trải đúng từ làng tới tầng 20.
- Có các lớp chuyển động vẽ bằng code từ hình đã có:
  - Mây trôi ở hai bên: cắt từ các cụm mây trong ảnh tầng mây và vòng mây.
  - Đàn chim nhỏ bay qua ở vùng trời thấp.
  - Tia nắng ở vùng trời vàng.
  - Sao nhấp nháy và dải cực quang ở vùng đêm.

**Màu phủ theo vùng trời** (6–12%), phủ lên tầng mây và nhân vật:
- Trời thấp: không phủ.
- Trời vàng: ấm.
- Hoàng hôn: hồng tím.
- Đêm: xanh tím, và đèn lồng phát sáng mạnh hơn.

**20 tầng:**
- Tầng 1–4 làm tay theo chỉ thị 10 (thêm tầng 4 Vườn Trăng).
- Tầng 5–20 dùng hệ **`floorGen` có sẵn**, đổi lại như sau:
  - `sprites` gồm đủ 4 hình tầng mây.
  - Lật ngang hình ở các vòng chẵn.
  - Màu phủ theo vùng trời thay cho `tints` cũ.
  - Kiểu bệ đá theo vùng: đá xám ở trời thấp, sa thạch ở trời vàng, đá trăng ở hoàng hôn và đêm.
  - Tên tầng đặt theo chủ đề vùng trời. Gửi CTO duyệt danh sách 16 tên. Không trùng tên tầng 1–4.
- **Cấp mở tầng:** giữ quy tắc `firstLevel 16`, `levelStep 3`. Tầng 4 mở ở cấp 16, tầng 5 ở cấp 19, tiếp tục như vậy tới tầng 20 ở cấp 64. Chi phí theo `floorGen`, cộng thêm Sợi Mây Kết và Giọt Sương Trời tăng dần.
- Giữ nguyên hệ **sao tầng** (`floorGen.stars`) có sẵn.

**Cây leo:**
- Gốc (`goc-cay.png`) đặt lên khối đá rêu bên trái làng.
- Thân chạy lên tới tầng cao nhất đã mở, ngọn đặt trên tầng đó.
- Mở tầng mới thì thân cây mọc dài thêm, có hoạt ảnh.

### C3. Thước đo độ cao

- Một vạch mảnh ở mép phải màn hình:
  - Có chấm cho từng tầng đã mở, cộng một chấm cho làng.
  - Chấm sáng là tầng đang xem. Chấm của tầng có việc cần làm (cây chín, chim đói) có viền vàng nhấp nháy.
  - Có dòng chữ "Độ cao: 1.250 m". Mỗi tầng tương ứng 250 m.
- Chạm vào chấm thì máy quay bay tới tầng đó trong 0,6 giây. Chạm vào biểu tượng nhà thì về làng.
- Vuốt nhanh lên hoặc xuống thì máy quay trôi theo đà rồi dừng đúng ở một tầng.
- **Lần đầu vào một vùng trời mới:** tên vùng hiện lớn ở giữa màn hình rồi mờ dần trong 2 giây, kèm **Huy Chương Độ Cao** (mục D3).

---

## PHẦN D — LÀNG PHÚ BÀ, NHÀ CHỨC NĂNG, CẤP LÀNG

### D1. Bố trí 9 ô đất và con sông

| Ô | Nhà | Mở ở cấp | Chạm vào để | Chuyển động khi đứng yên |
|---|---|---|---|---|
| 1 | **Đình Lễ Hội** | 1 | Quà mỗi ngày, **điểm danh 7 ngày**, nhiệm vụ ngày và tuần, sự kiện, **Bộ Sưu Tập** (Sổ Sâu Bọ, Sổ Cá, Sổ Thú Cưng, Huy Chương), Bảng Phú Bà | Đèn lồng đỏ lắc, vòng hoa rung |
| 2 | **Trạm Khinh Khí Cầu** | 2 | Bảng đơn, gửi hàng, chọn chim dẫn đường, nhờ hàng xóm góp hàng | Khinh khí cầu nhấp nhô. Gửi đơn thì bay lên trời và ra khỏi màn hình; khi về thì hạ xuống. |
| 3 | **Lò Gốm** | 3 | Mua chậu, nâng chậu, đúc chậu | Lửa bập bùng, khói bay |
| 4 | **Tháp Chim** | 3 | Thuê/mua chim, cho ăn, nâng cấp, gắn chim vào tầng | Chim nhỏ ra vào tổ |
| 5 | **Chợ Mây** | 4 | Sạp của mình và Chợ Mây (mua của 40 Phú Bà) | Đèn lồng đung đưa |
| 6 | **Nhà Thú Cưng** | 4 | Thú cưng, việc vặt, kết hợp thú cưng | Thú cưng đang ở nhà ngủ ở cửa |
| 7 | **Xưởng Bọ** | 6 | Xưởng chế biến | Bánh răng quay, con bọ trên mái nhún nhún |
| 8 | **Cổng Biển Mây** | 8 | Biển Mây Bí Ẩn (đào khám phá) | Mây xoáy trong vòm cổng, pha lê nhấp nháy |
| 9 | Biển gỗ "Dinh Phú Bà — sắp xây" | — | Để dành cho đợt sau | |
| Sông và cầu gỗ | **Bến Câu Cá** | 14 | Câu cá. **Thay cho "câu từ mép tầng mây" của chỉ thị 10.** | Nước lấp lánh, cá nhảy |

**Sửa so với chỉ thị 10** (cập nhật `features.json`):
- Xưởng Bọ mở ở cấp **6**, không còn ở cấp 4.
- Biển Mây vào qua **Cổng Biển Mây** trong làng, không còn vào qua gốc cây leo.

**Bong bóng báo trên mái** (quan trọng nhất để người chơi quay lại):

| Nhà | Hiện bong bóng khi |
|---|---|
| Đình | Có quà ngày hoặc điểm danh; nhiệm vụ đã xong |
| Trạm | Khinh khí cầu đã về; có đơn đủ hàng để gửi |
| Lò | Đủ vật liệu nâng chậu hoặc đúc chậu |
| Tháp Chim | Chim đói; hết hạn thuê |
| Chợ | Hàng trên Sạp đã bán; khách quý đang chờ |
| Nhà Thú Cưng | Thú cưng đi việc vặt đã về; thú cưng đói |
| Xưởng | Máy chạy xong |
| Cổng | Năng Lượng Gió đã đầy |
| Bến | Có mồi câu miễn phí |

- Bong bóng nảy nhẹ mỗi 2 giây. Chạm vào thì nhận luôn hoặc mở thẳng bảng chức năng.
- Không bao giờ bật hộp thoại chặn màn hình.
- Các nút trên thanh công cụ vẫn mở được chức năng. Chạm vào nhà trong làng là thêm một cách vào nữa.

**Nhà chưa mở:** hiện mờ, có ổ khóa và dòng "Mở ở cấp X". Màn mở nhà: bụi mây bung ra, nhà trồi lên có nảy, Xu Xu giới thiệu kèm hướng dẫn 2–3 bước.

**Nhân vật đi lại trong làng:**
- Xu Xu đi dạo trên đường đất.
- Thú cưng không đang trông tầng nào thì chơi trong làng.
- Thỉnh thoảng có 1–2 hình đại diện của BOT hàng xóm ghé Chợ (dùng `avatar.ts`).

### D2. Nâng cấp nhà (mỗi nhà cấp 1–5, mở từ cấp người chơi 5)

Nguyên liệu nâng nhà **cố ý lấy từ những hệ thống khác**.

| Nhà | Nguyên liệu nâng cấp | Mỗi cấp được thêm |
|---|---|---|
| Đình Lễ Hội | Điểm sự kiện + xu | +1 nhiệm vụ ngày; quà ngày lớn hơn |
| Trạm Khinh Khí Cầu | Hàng chế biến + Sợi Mây | +1 ô đơn hàng; +5% tỉ lệ đơn hiếm |
| Lò Gốm | Khoáng sản + xu | Thêm công thức đúc; −5% giá mua chậu |
| Tháp Chim | Nông sản + sâu bọ | +1 cành đậu; −10% giá thuê chim |
| Chợ Mây | Hàng chế biến + xu | +1 ô Sạp; BOT ghé mua nhiều hơn |
| Nhà Thú Cưng | Huy Hiệu thú cưng + xu | +1 việc vặt mỗi ngày; cấp 3 và cấp 5 thêm ô dắt thú cưng |
| Xưởng Bọ | Sâu bọ + xu | +1 khe hàng chờ |
| Cổng Biển Mây | Giọt Sương Trời + cá | Năng Lượng Gió tối đa +5; bản đồ rộng thêm 1 hàng |

- **Thời gian nâng cấp:** cấp 2 mất 5 phút, tăng dần tới 4 giờ ở cấp 5. Vẫn chạy khi tắt game.
- Mỗi lần chỉ nâng được 1 nhà. Ô nâng cấp thứ 2 mở ở Cấp Làng 15.
- Trong lúc nâng cấp, **nhà vẫn dùng được** (không khóa chức năng). Trên nhà có giàn giáo, Xu Xu cầm búa.
- **Ngoại hình theo cấp, không cần hình mới:**
  - Cấp 3: vầng sáng và hạt lấp lánh.
  - Cấp 5: đèn lồng vàng (hình có sẵn) quanh nhà và hào quang.

### D3. Cấp Làng và Huy Chương Độ Cao

**Cấp Làng** bằng tổng cấp của 8 nhà, tối đa 40.

| Cấp Làng | Thưởng |
|---|---|
| 10 | Thời gian chờ nâng nhà −10% |
| 15 | Ô nâng cấp nhà thứ 2 |
| 20 | +1 lượt nhờ hàng xóm góp hàng mỗi ngày |
| 30 | +5% EXP khi giao đơn |
| 40 | Danh hiệu "Làng Phú Quý" trên Bảng Phú Bà |

**Huy Chương Độ Cao:** lần đầu mở tầng 5, 10, 15, 20, người chơi nhận một Huy Chương và phần thưởng lớn gồm Sợi Mây, Giọt Sương, ngọc, và một chậu chữ ký theo chủ đề vùng trời.

Bảng Phú Bà thêm 2 cột: Cấp Làng và Huy Chương Độ Cao.

---

## PHẦN E — THÚ CƯNG ĐỒNG HÀNH (4 CON)

### E1. Nghề và kỹ năng

Mỗi con có 3 kỹ năng: kỹ năng 1 có ngay, kỹ năng 2 mở ở cấp thú cưng 10, kỹ năng 3 mở ở cấp 20. Số trong ngoặc ghi theo dạng (giá trị ở 1 sao → giá trị ở 5 sao).

**Mèo Mây Con — Bà Chủ Sạp** · `pet.cloud-kitten` · nhận ở cấp người chơi 4, **tặng miễn phí** khi mở Chợ · thích ăn hoa và Hũ Mứt.
1. **Gọi Khách:** BOT mua hàng trên Sạp nhanh hơn (10% → 30%). Kỹ năng này chạy cả khi tắt game.
2. **Tự Bày Hàng:** món nào trên Sạp bán hết thì Mèo tự bày lại từ kho, cùng giá, giữ mức tồn kho tối thiểu do người chơi đặt. Tối đa (5 → 15) lần mỗi ngày.
3. **Khách Quý:** mỗi ngày có 1 BOT khách quý mua một món với giá cao hơn (20% → 40%).

**Cáo Lửa Con — Thợ Săn Bọ** · `pet.fire-fox` · cấp 6, mua 2.500 xu · thích ăn quả.
1. **Vồ Bọ:** trên tầng Cáo đang trông, cứ mỗi (10 → 5) phút bắt 1 con bọ thuộc mọi hệ, **dùng chung `catchBug`**. Tính bù khi tắt game tối đa 8 giờ.
2. **Đánh Hơi:** chỉ ra (1 → 3) vườn hàng xóm đang nhiều bọ, sang giúp ở đó được +50% thưởng. Trên Biển Mây, đánh dấu sẵn (1 → 2) ô rương mỗi bản đồ.
3. **Lửa Ấm:** cây trên tầng của Cáo lâu khát hơn (20% → 50%). Ban đêm có (5% → 15%) cơ hội bắt được bọ hiếm hơn một bậc.

**Sẻ Mầm — Thợ Làm Vườn** · `pet.sprout-sparrow` · cấp 9, mua 40 ngọc · thích ăn Rau Thảo và Hạt Kê Mây.
1. **Nhặt Hạt:** khi gieo có (5% → 15%) cơ hội được hoàn hạt giống. Mỗi ngày mang về 1 túi quà nhỏ.
2. **Gieo Lại Như Cũ:** chậu nào trên tầng vừa thu hoạch thì tự gieo lại đúng giống cũ (dùng hạt trong kho, hoặc tự mua nếu đủ xu). Tối đa (20 → 60) chậu mỗi ngày, có công tắc bật/tắt.
3. **Thu Hoạch Hộ:** cứ mỗi (4 → 2) giờ tự thu hoạch các cây đã chín trên tầng của Sẻ, **dùng chung `harvest`**. Kho đầy thì dừng. EXP từ thu hoạch hộ chỉ bằng 50% so với người chơi tự thu.

**Rồng Ngọc Con — Thần Mưa** · `pet.jade-dragon` · cấp 12, mua 80 ngọc hoặc ghép 10 **Mảnh Trứng Rồng** (rơi từ Biển Mây, câu cá, Rương Mây Trôi) · thích ăn Ngọc Mây và Chai Nước Ép.
1. **Mưa Ngọc:** người chơi bấm để dùng, hồi lại sau (8 → 4) giờ. Tưới cả tầng và rút ngắn (5% → 15%) thời gian lớn còn lại.
2. **Long Khí:** cây trên tầng của Rồng có tỉ lệ Biến Dị tăng thêm (10% → 30%).
3. **Rồng Ban Lộc:** mỗi ngày 1 lần, lần thu hoạch tiếp theo trên tầng người chơi chọn được nhân đôi sản lượng.

### E2. Nâng cấp

- **Cấp thú cưng 1–30:** EXP đến từ kỹ năng kích hoạt, được cho ăn, đi việc vặt, làm nhiệm vụ thú cưng. Mỗi cấp, mọi kỹ năng mạnh thêm một chút theo đường cong trong dữ liệu.
- **Sao 1–5:** cần Huy Hiệu đúng loài, sâu bọ (Khá ở sao 2–3, Hiếm ở sao 4, Rất hiếm ở sao 5) và xu.
  - Yêu cầu cấp thú cưng tối thiểu: sao 2 cần cấp 5, sao 3 cần cấp 12, sao 4 cần cấp 20, sao 5 cần cấp 28.
  - Mỗi sao thêm hào quang vẽ bằng code: sao 3 có hạt sáng bay quanh, sao 5 có vầng sáng màu riêng của từng loài.
- **Thân Thiết 0–100:** tăng khi cho ăn (đúng món thích thì gấp 3, tối đa 5 lần có tính điểm mỗi ngày) và khi vuốt ve (tối đa 3 lần có điểm mỗi giờ).
  - Mốc 25, 50, 75, 100 mở quà: Huy Hiệu, khung hồ sơ, câu thoại riêng.
  - **Không bao giờ giảm.** Thú cưng đói thì chỉ ngủ, kỹ năng thụ động tạm nghỉ.

### E3. Việc vặt (bảng nằm ở Nhà Thú Cưng)

- 4 việc mỗi ngày, làm mới lúc 0 giờ. Được đổi miễn phí 1 việc mỗi ngày.
- Thú cưng đi làm việc vặt thì rời vườn, kỹ năng thụ động của nó tạm nghỉ. Người chơi phải tự chọn giữ lại hay sai đi.

| Việc | Thời gian | Thú cưng phù hợp (+50% thưởng) | Thưởng |
|---|---|---|---|
| Đi chợ xa | 2 giờ | Mèo | Xu, hàng chế biến hiếm |
| Săn bọ rừng mây | 3 giờ | Cáo | 3–6 con bọ Khá hoặc Hiếm |
| Tìm hạt giống lạ | 4 giờ | Sẻ Mầm | Hạt giống, Hạt Kê Mây, Sợi Mây |
| Gọi mây tìm sương | 6 giờ | Rồng | Giọt Sương Trời, Ngọc Mây |
| Đưa thư hàng xóm | 1 giờ | Con nào cũng được | Điểm thân thiết với BOT, Huy Hiệu |
| Thám thính Biển Mây | 8 giờ | Cáo, Rồng | Mảnh Trứng Rồng, khoáng sản, Năng Lượng Gió |

Mọi việc đều cho EXP thú cưng và có cơ hội rơi Huy Hiệu. Thú cưng về thì chạy vào làng mang theo túi quà, chạm để nhận.

### E4. Dắt, trông tầng, kết hợp

- **Ô dắt thú cưng:** ban đầu 1 ô. Có thêm ô khi Nhà Thú Cưng lên cấp 3, và thêm ô nữa ở cấp 5.
- Mỗi con được giao **trông một tầng**. Kỹ năng vườn chỉ chạy trên tầng nó trông. Riêng kỹ năng Sạp của Mèo áp dụng cho cả vườn.
- **Kết hợp**, mở ở cấp người chơi 14:

| Cặp | Tên | Thưởng |
|---|---|---|
| Mèo + Cáo | Thương Đoàn | Khách quý trả thêm 10% |
| Sẻ Mầm + Rồng | Mùa Màng | Tầng có cả hai con lớn nhanh thêm 8% |
| Cáo + Rồng | Lửa và Nước | Mưa Ngọc hồi lại nhanh hơn 20% |
| Mèo + Sẻ Mầm | Vườn Nhà | Quà mỗi ngày của Sẻ thành 2 túi |

### E5. Hành vi và giao diện

**Máy trạng thái hành vi** (dùng 4 dáng: đứng, chạy, ngủ, vui):
- **Đi lại** trên dải cỏ phía trước bằng dáng chạy, lật hình theo hướng đi, có lúc dừng lại ở dáng đứng.
- **Làm việc:** chạy tới đúng chỗ (Cáo tới chậu có bọ, Sẻ tới chậu vừa thu, Mèo tới Sạp trong làng). Đến nơi thì dáng vui kèm hiệu ứng.
- **Vuốt ve:** dáng vui, có tim bay lên.
- **Ngủ:** ban đêm, khi đói, hoặc đứng yên quá 2 phút.
- **Không được che chậu đang chín.**
- Cao khoảng 0,6 lần chậu, có bóng mềm dưới chân.

**Bảng thú cưng** gồm:
- Hình lớn, cấp, sao, Thân Thiết.
- 3 kỹ năng: kỹ năng chưa mở thì hiện ổ khóa kèm "Mở ở cấp X".
- Kỹ năng hiện tại và ở cấp hoặc sao kế tiếp.
- Các nút: cho ăn, nâng sao, dắt/cất, giao trông tầng, việc vặt.

**Khác:**
- Thú cưng của BOT hiện khi ghé vườn hàng xóm.
- **Không mua bán thú cưng** trên Chợ Mây.

**Nhiệm vụ thú cưng:**
- Chuỗi nhập môn 5 bước cho mỗi con, dạy đúng kỹ năng của con đó.
- Nhiệm vụ ngày và tuần.
- Thành tựu: "Đủ 4 thú cưng", "Một thú cưng đạt 5 sao", "Thân Thiết 100 với cả 4 con".

---

## PHẦN F — MẠNG LIÊN KẾT (CTO đã kiểm: mọi hệ có đủ 2 đầu vào và 2 đầu ra)

| Hệ thống | Đầu vào (nhận từ) | Đầu ra (đưa cho) |
|---|---|---|
| Trồng cây | Hạt (Lò, Sẻ Mầm, việc vặt), chậu (Lò), tưới (Rồng), gieo lại (Sẻ) | Nông sản → Xưởng, Chợ, đơn, thức ăn chim và thú cưng, mồi câu; sâu bọ |
| Sâu bọ | Cây, chim, Cáo, việc vặt Săn bọ, Biển Mây | Nâng chậu, nâng sao máy, nâng Tháp Chim, Xưởng, sao thú cưng |
| Chim (Tháp Chim) | Hạt Kê, nông sản, xu, ngọc | Sâu bọ; chim dẫn đường cho đơn (+xu/+EXP) |
| Xưởng Bọ | Nông sản, khoáng (Máy Mài Ngọc), bọ để nâng sao | Hàng chế biến → đơn, Chợ, nâng Trạm, nâng Chợ, thức ăn thú cưng; Ngọc Mây → đúc chậu, Rồng |
| Trạm / đơn | Nông sản, hàng chế biến, chim dẫn đường, hàng xóm góp | Xu, EXP, Sợi Mây, Giọt Sương, bọ hiếm |
| Chợ Mây | Nông sản, hàng chế biến, Mèo | Xu; mua được Sợi Mây, Giọt Sương, khoáng, mồi câu từ BOT |
| Biển Mây (Cổng) | Năng Lượng Gió, Cáo đánh dấu rương, nâng Cổng bằng cá | Khoáng → Lò và Xưởng; Sợi Mây, Giọt Sương; Mảnh Trứng Rồng; bọ hiếm |
| Câu cá (Bến) | Mồi chế từ nông sản và Hũ Mứt | Cá → nâng Cổng; Giọt Sương; Mảnh Trứng Rồng; Sổ Cá |
| Lò Gốm (chậu, đúc) | Xu, bọ, khoáng, Ngọc Mây | Chậu tốt hơn → trồng nhanh hơn, nhiều hơn; bộ chậu |
| Mở tầng | Xu, Sợi Mây, Giọt Sương, cấp | Thêm ô trồng; vùng trời mới và Huy Chương; đặc tính tầng |
| Thú cưng | Món thích (hoa, quả, Rau Thảo, Hũ Mứt, Nước Ép, Ngọc Mây), Huy Hiệu, bọ | Bán hàng, bắt bọ, gieo/thu, tưới; việc vặt ra mọi tài nguyên |
| Nhà và Cấp Làng | Nguyên liệu của mọi hệ (D2) | Tăng sức chứa và tốc độ của mọi hệ |
| Đình Lễ Hội | Mọi hoạt động (nhiệm vụ) | Quà, điểm sự kiện, ngọc, Huy Hiệu |

Ghi bảng này cùng sơ đồ vào `docs/FEATURE_WEB.md`. **Mọi vòng tạo xu khép kín phải qua mô phỏng** (mục H).

---

## PHẦN G — NHỊP MỞ KHÓA CHUNG (thay bảng ở mục 5 của chỉ thị 10)

| Cấp | Mở |
|---|---|
| 1 | Làng + Đình (quà ngày, điểm danh), tầng 1, Bọ Rùa |
| 2 | Trạm khinh khí cầu (đơn), Sâu Lá |
| 3 | Lò Gốm, Tháp Chim + Sẻ Mây, Bướm Phấn Hồng |
| 4 | Chợ Mây + **Mèo Mây Con (tặng)** + Nhà Thú Cưng |
| 5 | **Tầng 2**, Chích Chòe Lá, Châu Chấu Sương, **nâng cấp nhà** |
| 6 | **Xưởng Bọ** (Máy Sấy Hoa), **Cáo Lửa Con**, việc vặt |
| 7 | Bói Cá Ngọc, Nồi Mứt, Cánh Cam Ngọc, bộ chậu |
| 8 | **Cổng Biển Mây** |
| 9 | **Sẻ Mầm**, trang trí đèn lồng và pha lê, Bọ Hung Vàng |
| 10 | **Tầng 3**, Máy Ép Nước |
| 11 | Chim dẫn đường, đơn hiếm |
| 12 | Cú Mèo Đêm, **Đúc chậu**, Đom Đóm Sao, **Rồng Ngọc Con** |
| 13 | Nhờ hàng xóm góp hàng |
| 14 | **Bến Câu Cá**, cành đậu thứ 2, kết hợp thú cưng |
| 15 | Ve Sầu Ngọc, thưởng Bộ Sưu Tập |
| 16 | **Tầng 4 Vườn Trăng**, Máy Mài Ngọc |
| 19, 22, 25… | Tầng 5, 6, 7… (mỗi 3 cấp một tầng). Tầng 5 đi kèm Huy Chương Độ Cao đầu tiên. |

Dữ liệu nằm hết trong `features.json`. Mỗi lần mở khóa, Xu Xu xuất hiện giới thiệu.

---

## PHẦN H — KINH TẾ (cập nhật `tools/economy-sim.ts`, 30 ngày, 3 kiểu người chơi)

Kế thừa đủ 7 ràng buộc của chỉ thị 10 (mục 4), thêm:

1. Người chơi vừa: có đủ 4 thú cưng khoảng ngày 12–16. Cấp Làng 10 khoảng ngày 7, Cấp Làng 25 khoảng ngày 30. Mở tầng 5 khoảng ngày 20–25.
2. **Chơi một mình không vào game:** người chơi không vào game trong 24 giờ (chỉ có thú cưng, chim, xưởng chạy) thì thu nhập không quá **35%** so với người chơi vừa.
3. Tổng thưởng phần trăm trên một lần thu hoạch không vượt **60%**, tính gộp từ: chậu, bộ chậu, trang trí, đặc tính tầng, sao tầng, chim dẫn đường, thú cưng, kết hợp, Cấp Làng. Rồng Ban Lộc (nhân đôi, mỗi ngày 1 lần) được ghi riêng.
4. Có Cáo và chim so với không có: tổng bọ tăng không quá **45%**.
5. Không có vòng tạo xu vô hạn. Phải kiểm riêng từng vòng:
   - Mèo Tự Bày Hàng ↔ Sẻ Gieo Lại ↔ Thu Hoạch Hộ
   - Việc vặt ↔ Chợ
   - Câu cá ↔ chế mồi
   - Đào → Mài Ngọc → bán
   - Nâng nhà ↔ giảm giá
6. Ghi kết quả vào `docs/reviews/economy-11.md`, có biểu đồ xu, cấp và cấp làng theo ngày.

---

## PHẦN I — LƯU TRỮ, BOT, HIỆU NĂNG

**Lưu trữ:**
- Tăng `SAVE_VERSION` lên **13**, có migration 12→13.
- Trường mới:
  - `buildings`: mỗi nhà lưu `{level, upgradeEndsAt}`; thêm `buildQueue`.
  - `village`: `{seenZones, medals, checkIn}`.
  - `pets[]`: id, cấp, EXP, sao, Thân Thiết, độ no, tầng trông, trạng thái, giờ về, thời gian hồi kỹ năng.
  - `activePets[]`, `errands`, `collections`.
- Mọi trường mới có giá trị mặc định khi đọc save cũ, và được reconcile làm sạch.
- Mèo Mây Con đang có trong game: chuyển sang `pets[]`. Người chơi đã từng thấy Mèo thì được nhận ngay khi lên cấp 4.

**BOT:**
- Có làng, có nhà, nâng nhà theo mục tiêu.
- Có thú cưng, cho ăn, sai đi việc vặt.
- Có chim (đính chính D1).
- Tất cả dùng chung code với người chơi.

**Hiệu năng (iPad Pro M2):**
- Chỉ tải nền trời của vùng đang xem và hai vùng kề nó. Tầng mây tải kiểu lười.
- Làng chỉ dựng và chạy chuyển động khi máy quay ở gần mặt đất (trong khoảng 1,5 màn hình).
- Giữ 60 FPS khi cuộn liên tục từ làng lên tầng 20, với 3 thú cưng, 2 chim và 8 con bọ trên màn hình.
- Bộ nhớ ảnh không quá 350 MB ở bất kỳ độ cao nào.
- Mô phỏng 40 BOT × 7 ngày (đủ mọi hệ) chạy dưới 250 ms.
- Bong bóng báo cập nhật theo sự kiện, không cập nhật mỗi khung hình.

---

## PHẦN J — CÁC BƯỚC LÀM VÀ NGHIỆM THU

| Bước | Nội dung |
|---|---|
| N1 | Xử lý ảnh (làm song song ngay): bầu trời 5 tấm, nhà, thú cưng |
| N2 | Trục dọc, parallax, 20 tầng với `floorGen` mới, cây leo dài theo tầng, thước đo độ cao, màn vượt vùng trời |
| N3 | Làng: 8 nhà, bong bóng báo, mở nhà, Bến Câu Cá ở sông, Cổng Biển Mây |
| N4 | Nâng cấp nhà, Cấp Làng, Huy Chương Độ Cao, điểm danh, Bộ Sưu Tập |
| N5 | Thú cưng: dữ liệu, 12 kỹ năng, cấp, sao, Thân Thiết, hành vi |
| N6 | Việc vặt, kết hợp, nhiệm vụ thú cưng |
| N7 | BOT dùng mọi hệ mới; migration 13; mô phỏng kinh tế và chỉnh số |
| N8 | Kiểm thử tổng, hiệu năng, bản thử, báo cáo |

**Nghiệm thu** (CTO tự kiểm, không dựa vào báo cáo):

1. Typecheck sạch, toàn bộ test xanh. Test mới phải gồm:
   - Từng kỹ năng thú cưng ở 1 sao và 5 sao.
   - Kết hợp thú cưng.
   - Việc vặt khi tắt game.
   - Nâng nhà khi tắt game.
   - Nguyên liệu nâng nhà lấy đúng từ hệ khác.
   - Cấp Làng và các mốc thưởng.
   - Huy Chương Độ Cao.
   - Migration 12→13.
   - BOT dùng chung luật.
   - Kho đầy thì Thu Hoạch Hộ dừng.
   - Thú cưng đi việc vặt thì kỹ năng thụ động nghỉ.
2. Kinh tế đạt đủ phần H.
3. Hình ảnh:
   - 5 tấm trời nối không lộ vết khi cuộn chậm.
   - Nhà không có viền trắng, đặt đúng giữa ô đất.
   - Gốc cây leo khớp khối đá rêu.
   - Màu phủ theo vùng trời nhẹ, không làm bẩn màu.
   - Thú cưng không che chậu chín.
4. Đạt đủ các yêu cầu hiệu năng ở phần I.
5. Trải nghiệm: đạt 4 phép thử ở phần B.
6. Báo cáo kèm:
   - Link bản thử.
   - Video hoặc ảnh động cuộn từ làng lên tầng 20.
   - Ảnh chụp 2388×1668:
     - Làng có đủ bong bóng báo; làng ban đêm.
     - Nâng nhà.
     - Từng vùng trời có tầng mây.
     - Thước đo độ cao; màn vượt vùng trời.
     - Bảng thú cưng; 4 thú cưng đang làm việc; việc vặt; nâng sao.
     - Mèo dẫn khách quý; Rồng dùng Mưa Ngọc.
   - `FEATURE_WEB.md`, `economy-11.md`.
   - Mục CẦN HÌNH (chỉ khi có hình bị mờ hoặc lỗi).
   - Danh sách 16 tên tầng 5–20 để CTO duyệt.

## PHẦN K — BỘ BIỂU TƯỢNG (ĐÃ CÓ, CTO đã duyệt 18/11/2026)

Thư mục `7_bieu-tuong/` và `4_nhan-vat/xu-xu_tho-xay-va-cau-ca.png`. Dùng cho cả chỉ thị 10 và chỉ thị này. **Thay toàn bộ biểu tượng tạm** bằng bộ này.

| Tờ | Thứ tự hình (trái sang phải, trên xuống dưới) |
|---|---|
| `to1_che-bien-va-vat-pham.png` | Hoa Sấy, Hũ Mứt, Chai Nước Ép, Ngọc Mây, Sợi Mây Kết, Giọt Sương Trời, Hạt Kê Mây, Năng Lượng Gió |
| `to2_khoang-moi-trung-rong.png` | Đá Mây, Mảnh Đồng, Mảnh Bạc, Vàng Vụn, Ngọc Thô, Mồi Thường, Mồi Thơm, Mảnh Trứng Rồng. **Lưu ý:** tờ này có dòng chữ tiếng Anh dưới mỗi hình, phải cắt bỏ hết phần chữ. |
| `to3_ca-va-phao.png` | Cá Mây, Cá Cánh Hoa, Cá Chép Vàng, Cá Trăng, Cá Rồng Cầu Vồng (huyền thoại), Phao câu |
| `to4_huy-hieu-diem-su-kien-ruong.png` | Huy Hiệu Mèo, Huy Hiệu Cáo, Huy Hiệu Sẻ Mầm, Huy Hiệu Rồng, Điểm Sự Kiện, Rương Biển Mây |
| `to5_huy-chuong-do-cao.png` | Huy Chương Trời Thấp, Trời Vàng, Hoàng Hôn, Thiên Giới |
| `to6_bien-go-gian-giao-can-cau.png` | Biển gỗ Dinh Phú Bà (chữ do code viết lên), Giàn giáo khi nâng cấp nhà, Cần câu đặt ở Bến |
| `xu-xu_tho-xay-va-cau-ca.png` | Xu Xu thợ xây (đứng cạnh nhà đang nâng cấp), Xu Xu câu cá (ở Bến Câu Cá) |

**Xử lý:**
- Tách nền trắng bằng cách lan từ mép vào (flood fill), làm mềm mép, khử viền trắng.
- Cắt rời từng hình, gom vào atlas biểu tượng, có bản @1x và @2x.
- Biểu tượng hiển thị ở 48–96 pt phải rõ nét. Hình nào mờ thì ghi vào CẦN HÌNH.

Sau bộ này **không còn hình nào phải chờ**. Mọi biểu tượng tạm phải được thay hết trước khi merge.

## PHẦN L — CẤM

- Không tự vẽ hình. Chỉ được: tách nền, cắt hình, phóng to, chỉnh màu vùng chồng nhau giữa các tấm trời, phủ màu theo vùng trời, vẽ hào quang và hiệu ứng bằng code.
- Không để thú cưng chết, bỏ đi hay bị trừ Thân Thiết.
- Không khóa nhà trong lúc nâng cấp.
- Không mua bán thú cưng.
- Không đổi giá hạt giống và giá bán nông sản.
- Không viết luồng code riêng cho BOT. Thú cưng không có luồng bắt bọ hay thu hoạch thứ hai: dùng chung `catchBug` và `harvest`.
- Merge vào `main`: được **tự merge vào `main` qua PR** (chủ dự án cho phép 18/11/2026), với điều kiện: typecheck sạch, toàn bộ test xanh, build chạy, migration save cũ đã test, bản thử gh-pages chạy được; mỗi lần merge ghi 1 dòng vào CHANGELOG.md và gắn tag `m-<chỉ-thị>-<mốc>` để quay lại được. Cấm merge khi còn test đỏ, hoặc khi save cũ không mở được.
