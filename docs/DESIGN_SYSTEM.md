# DESIGN_SYSTEM.md — PHÚ BÀ TRỒNG CÂY

> Hệ thống thiết kế cho toàn bộ game. Lưu tại `docs/DESIGN_SYSTEM.md`. Giá trị số nằm trong `content/ui/design-tokens.json`; code đọc từ file đó, **không viết cứng màu, cỡ chữ, thời lượng trong code**.
> Khi tài liệu này mâu thuẫn với `docs/ART_STYLE_GUIDE.md` mục 8 (giao diện), tài liệu này thắng. Art Style Guide vẫn là chuẩn cho tranh minh họa (góc nhìn, ánh sáng, tỉ lệ).

Phiên bản: 1.0 · 2026-11-16 · Người ban hành: CTO/Art Director · Trạng thái: **chờ chủ dự án duyệt**

---

## 1. Định hướng: "Truyện cổ tích trên mây của một Phú Bà"

Chủ dự án yêu cầu (2026-11-16): giao diện mang phong cách **cổ tích**, không giống ứng dụng quản lý. Mọi màn hình phải trông như một trang sách tranh, một quầy hàng gỗ, một cuộn giấy da — không phải bảng, lưới và thẻ phẳng.

| Làm | Không làm |
|---|---|
| Khung gỗ bo tròn, giấy da ấm, ruy băng, dây leo, đinh tán vàng | Thẻ trắng phẳng, đường kẻ xám, bảng dữ liệu |
| Mỗi cửa sổ là một *vật thể* có nhân vật: quầy hàng, rương, bàn thợ gốm | Hộp thoại chữ nhật có tiêu đề và nút X |
| Biểu tượng là tranh minh họa nhỏ | Biểu tượng nét mảnh một màu |
| Số liệu gắn với hình (đồng xu, giọt nước, ngôi sao) | Số trần trong ô |
| Chuyển động đàn hồi, có sức nặng | Hiện/ẩn tức thì, trượt tuyến tính |

Phép thử nhanh: che hết chữ đi, nhìn màn hình vẫn biết đây là game cổ tích về vườn trên mây.

## 2. Kiến trúc giao diện

- **Thế giới** (trời, mây, tầng, chậu, cây, bọ, Linh Thú, hiệu ứng): vẽ bằng PixiJS.
- **Giao diện** (thanh thông tin, nút, cửa sổ, cửa hàng, kho, nâng cấp, thông báo): lớp HTML/CSS phủ trên canvas. Chữ tiếng Việt sắc nét ở mọi độ phân giải, tận dụng được phương án do Google Stitch sinh ra.
- Giao diện chỉ **đọc state và gửi lệnh** qua `dispatch()`. Không chứa luật chơi, không tự tính giá, không tự sửa state.
- Lớp HTML chỉ cập nhật khi có sự kiện, không cập nhật mỗi khung hình. Chuyển động dùng `transform` và `opacity`.
- Số bay, hạt, tia sáng diễn ra trong thế giới thì vẽ bằng PixiJS, kể cả khi do nút HTML kích hoạt.

## 3. Màu sắc

### 3.1. Màu thương hiệu (tranh và trang trí)

| Tên | Mã | Dùng cho |
|---|---|---|
| Vàng Kim | `#F2B830` | Xu, viền sang, nút phụ, điểm nhấn |
| Xanh Ngọc | `#2FBF9F` | Ngọc Mây, trang trí, vầng sáng |
| Hồng Đào | `#FF9E8A` | Hoa, má, mây chiều |
| Xanh Trời | `#8CCBFF` | Trời, nước |
| Kem Sữa | `#FFF6E3` | Mây, nền giấy |
| Lá Non | `#8BD15A` | Lá, thanh tiến trình |
| Nâu Đất | `#5B3A29` | Chữ, gỗ đậm |
| Tím Bóng | `#6B5B9A` | Bóng, đêm |

### 3.2. Màu chức năng của giao diện (đã đo tương phản)

| Vai trò | Nền | Chữ | Tương phản |
|---|---|---|---|
| Chữ thân trên giấy da | `#FFF6E3` | `#5B3A29` | 9,4 |
| Chữ phụ trên giấy da | `#FFF6E3` | `#7A5A45` | 5,8 |
| Giấy da đậm (ô, hàng) | `#F7E7C6` | `#5B3A29` | 8,3 |
| Nút chính (ngọc đậm) | `#147A66` | `#FFFFFF` | 5,2 |
| Nút phụ (vàng kim) | `#F2B830` | `#4A2E1F` | 6,9 |
| Nút nguy hiểm | `#C93B45` | `#FFFFFF` | 5,0 |
| Bảng gỗ đậm | `#5B3A29` | `#FFF6E3` | 9,4 |
| Số vàng trên giấy | `#FFF6E3` | `#8A5F12` | 5,2 |

Cấm: chữ trắng trên Xanh Ngọc `#2FBF9F` (2,3), chữ trắng trên Đỏ `#F2676B` (3,0), chữ Vàng Kim `#F2B830` trên giấy da. Mọi cặp chữ–nền mới phải ≥ 4,5.

### 3.3. Màu độ hiếm

| Độ hiếm | Mã | Dấu hiệu thứ hai (không chỉ dựa vào màu) |
|---|---|---|
| Thường | `#A9744F` | Không viền |
| Tốt | `#5FB04A` | 1 chấm lá |
| Hiếm | `#2FBF9F` | 2 chấm ngọc |
| Sử Thi | `#8E5BD0` | 3 chấm + viền đôi |
| Huyền Thoại | `#F2B830` | Vương miện nhỏ + tia sáng động |

## 4. Chữ

Font nhúng kèm game (không tải từ ngoài), giấy phép SIL OFL, hỗ trợ đủ dấu tiếng Việt.

| Vai trò | Font | Cỡ (pt) | Đậm | Ghi chú |
|---|---|---|---|---|
| Tên game, tiêu đề lớn | Baloo 2 | 40 | 800 | Viền nâu 3 pt, bóng mềm |
| Tiêu đề cửa sổ | Baloo 2 | 28 | 700 | Đặt trên ruy băng |
| Số tiền, cấp, số bay | Baloo 2 | 22–32 | 800 | Chữ số cùng bề rộng |
| Tên vật phẩm, nút | Baloo 2 | 20 | 700 | |
| Nội dung | Nunito | 17 | 600 | Giãn dòng 1,4 |
| Chú thích | Nunito | 16 | 600 | Cỡ nhỏ nhất được phép |

Không dùng chữ in hoa toàn bộ cho câu dài hơn 3 từ. Số lớn rút gọn: 1.250 → 1.250; 12.500 → 12,5N; 1.200.000 → 1,2Tr.

## 5. Khoảng cách, bo góc, độ nổi

- Lưới 8 pt: 4, 8, 12, 16, 24, 32, 48.
- Vùng chạm tối thiểu **56 × 56 pt** cho nút chính, 44 × 44 pt cho mọi thứ khác. Khoảng cách giữa hai vùng chạm ≥ 8 pt.
- Bo góc: nút 20, ô vật phẩm 16, cửa sổ 32, ruy băng 12.
- Mọi khung có 3 lớp: viền gỗ đậm 4 pt → viền sáng trong 2 pt → mặt giấy. Bóng đổ mềm màu Tím Bóng 25%, lệch xuống 6 pt.
- Giao diện thường trực chiếm < 15% màn hình. Tránh vùng an toàn và mép dưới 20 pt.

## 6. Thành phần

### 6.1. Nút
Hình viên kẹo bằng gỗ sơn, có mặt trên sáng và chân đế đậm 6 pt.

| Trạng thái | Biểu hiện |
|---|---|
| Thường | Chân đế 6 pt |
| Nhấn | Lún xuống 4 pt trong 80 ms, tối đi 8% |
| Thả | Nảy lên, vượt 2 pt rồi về, 180 ms |
| Vô hiệu | Xám ấm, giảm bão hòa; chạm vào thì lắc nhẹ và hiện lý do |
| Đủ điều kiện nâng cấp | Viền vàng thở chậm chu kỳ 1,6 giây |

Nút vô hiệu luôn cho biết **vì sao** ("Thiếu 3 Bọ Rùa Mây"), không im lặng.

### 6.2. Biểu tượng
Tranh minh họa nhỏ cùng phong cách với vật phẩm, góc 3/4 từ trên, nắng trên–trái. Khung gốc 256 × 256, hiển thị 32/48/64/96 pt. Phải nhận ra ở 32 pt. Không dùng emoji, không dùng bộ icon nét mảnh.

### 6.3. Thanh thông tin (HUD)
- Trên–trái: huy hiệu cấp hình bông hoa, thanh XP là dây leo mọc dần.
- Giữa–trên: túi xu bằng vải thêu; số nhảy từng bậc khi thay đổi.
- Trên–phải: mặt trời/mặt trăng chỉ giờ, bánh răng cài đặt.
- Dưới–phải: 3 nút chính xếp vòng cung theo ngón cái — Hạt giống, Kho, Cửa hàng.

### 6.4. Bảng thông tin (chạm vào chậu)
Bong bóng mây nổi lên từ chậu, đuôi chỉ vào chậu, không che cây. Chứa: tên cây, thời gian còn lại dạng đồng hồ cát, 2–3 nút hành động (Tưới, Bắt bọ, Thu hoạch). Chạm ra ngoài thì tan thành mây.

### 6.5. Cửa hàng — "Sạp Hạt Giống Bà Mây"
Một sạp gỗ có mái vải sọc, đèn lồng treo, nhân vật chủ sạp gật đầu chào. Hàng bày trên kệ gỗ 2–3 tầng, mỗi món là một gói hạt giống minh họa đặt trên kệ, thẻ giá treo dây. Món chưa mở khóa phủ vải, ghi "Mở ở cấp 6". Mua: gói hạt nảy lên rồi bay vào túi.

### 6.6. Kho đồ — "Rương Mây"
Rương gỗ mở nắp, bên trong chia ngăn lót nhung. Thanh sức chứa là dãy giỏ mây đầy dần. Chọn nông sản thì hiện cân đĩa: kéo thanh trượt chọn số lượng, giá hiển thị bằng chồng xu. Bán: xu rơi leng keng vào túi.

### 6.7. Cửa sổ nâng cấp — "Bàn Thợ Gốm"
Bàn xoay gốm, chậu đặt giữa. Trái: chậu hiện tại; phải: chậu sau nâng cấp ở trạng thái mờ ảo, **cho thấy trước ngoại hình mới**. Dưới: nguyên liệu cần (xu, Bọ Mây) dạng ô có đủ/thiếu. Nâng cấp: chậu xoay, bụi vàng tụ lại, lóe sáng, chậu mới hiện ra kèm chỉ số tăng nhảy số. Luôn thành công, không có thanh tỉ lệ.

### 6.8. Thông báo và phần thưởng
- Nhẹ (đã lưu, kho gần đầy): lá thư bay vào góc trên, tự tan sau 2,5 giây.
- Lên cấp: ruy băng lớn bung ngang màn hình, pháo hoa vàng, danh sách mở khóa mới.
- Lỗi: bong bóng mây xám nhỏ gần chỗ chạm. Không dùng hộp thoại chặn màn hình.

## 7. Chậu — nhận diện riêng, càng nâng càng đẹp

Mỗi loại chậu có **bóng dáng riêng** nhận ra khi tô đen hoàn toàn (đất nung bầu tròn, sứ cao cổ, đồng ba chân, ngọc hình sen…). Cấp chậu thể hiện bằng 4 bậc ngoại hình, mỗi bậc **thêm vật thể**, không chỉ đổi màu:

| Bậc | Cấp | Ngoại hình | Hiệu ứng động |
|---|---|---|---|
| 1 Mộc | 1–2 | Dáng gốc, bề mặt trơn | Không |
| 2 Chạm khắc | 3–4 | Thêm hoa văn khắc nổi, viền miệng men màu | Ánh men lướt qua mỗi 6 giây |
| 3 Nạm | 5–7 | Thêm quai/chân đế kim loại, đá nạm theo màu độ hiếm | Đá nạm lấp lánh ngẫu nhiên |
| 4 Bảo vật | 8+ | Thêm dây leo vàng quấn, vầng sáng, bệ mây riêng | Hạt sáng bay lên chậm, vầng sáng thở |

Với lát cắt giai đoạn 1 (Chậu Đất Nung, 5 cấp): cấp 1–2 bậc 1, cấp 3–4 bậc 2, cấp 5 bậc 3.

## 8. Tầng mây — mở rộng và nhiều lớp chuyển động

Thứ tự lớp từ xa đến gần, mỗi lớp trôi với tốc độ khác nhau:

| Lớp | Nội dung | Tốc độ so với máy quay |
|---|---|---|
| 0 | Bầu trời chuyển màu theo giờ, mặt trời/trăng/sao | 0 |
| 1 | Mây xa, đảo xa mờ | 0,1 |
| 2 | Mây giữa, đàn chim | 0,3 |
| 3 | **Tầng mây chơi** (đảo, chậu, cây, Linh Thú) | 1 |
| 4 | Mây gần lướt qua trước mặt, bán trong suốt | 1,4 |
| 5 | Hạt: cánh hoa, tia nắng, đom đóm ban đêm | 1,6 |

- Mây tự trôi ngang chậm, mỗi đám một tốc độ; đảo nhấp nhô ±4 pt chu kỳ 5 giây.
- **Mở tầng mới:** máy quay lướt lên 0,8 giây → mây lớp 4 dạt hai bên → đảo trồi lên từ biển mây có nảy → cầu thang dây leo mọc dần → pháo hoa vàng → bệ chậu hiện lần lượt cách nhau 120 ms.
- **Mở rộng tầng:** đảo rung nhẹ → phình rộng 0,5 giây → bệ chậu mới trồi lên, bụi mây bung ra.

## 9. Cây trồng — khác nhau về dáng, màu và chuyển động

- Mỗi giống có bóng dáng riêng ở giai đoạn chín, phân biệt được khi tô đen. Hai giống cùng hệ không dùng chung màu chủ đạo.
- 5 giai đoạn khác nhau về **hình dạng**, không phóng to cùng một hình.
- Mỗi hệ có kiểu đung đưa riêng:

| Hệ | Chuyển động chờ | Khi chín |
|---|---|---|
| Hoa | Lắc lư mềm, cánh hé mở | Nở bung, cánh rung, lấp lánh |
| Quả | Cành trĩu nhún theo sức nặng | Quả căng bóng, đung đưa chậm |
| Rau Thảo | Lá rung nhanh như có gió | Lá xòe rộng, tỏa hơi thơm |
| Kỳ Hoa | Thở phát sáng theo nhịp | Xoay nhẹ, tỏa hạt sáng |

- Các cây lệch pha nhau, không đung đưa đồng loạt.
- Trạng thái: khát (lá rũ, giọt nước nhấp nháy phía trên), có bọ (bọ bò và vỗ cánh), chín (nảy nhẹ mỗi 2 giây để gọi người chơi).
- Thu hoạch: cây co lại rồi bật, nông sản bay theo đường cong vào nút Kho, nút Kho nảy.

## 10. Vật nuôi và Linh Thú — có biểu cảm và hoạt động riêng

Áp dụng cho Linh Thú Tầng (giai đoạn 3) và linh vật Xu Xu. **Không làm trong giai đoạn 1**, nhưng tranh và khung xương phải thiết kế sẵn theo chuẩn này.

- Mỗi con có tối thiểu 6 biểu cảm: bình thường, vui, đói, buồn ngủ, ngạc nhiên, tự hào.
- Mỗi con có tối thiểu 4 hoạt động riêng, không dùng chung giữa các loài. Ví dụ: Ong Thợ Mây bay vòng quanh hoa, rũ phấn, ngủ gật trên cánh hoa, mang hũ mật về tổ.
- Phản ứng với người chơi: chạm vào thì quay nhìn và phản ứng; cho ăn thì nhảy mừng; bỏ đói lâu thì nằm ủ rũ (không bị phạt, chỉ là biểu cảm).
- Phản ứng với thế giới: nhìn theo Bọ Mây bay qua, ngủ khi trời tối, trú khi mưa.
- Tách bộ phận (đầu, thân, tai, đuôi, mắt, miệng) để chuyển động bằng khung xương; mắt chớp ngẫu nhiên 3–6 giây.

## 11. Chuyển động giao diện

| Tên | Thời lượng | Đường cong | Dùng cho |
|---|---|---|---|
| Chạm | 80 ms | ease-out | Nút lún |
| Nảy | 180 ms | đàn hồi, vượt 8% | Nút thả, vật phẩm nhận |
| Mở cửa sổ | 280 ms | đàn hồi, vượt 4% | Cửa sổ phóng từ nút gọi nó |
| Đóng cửa sổ | 160 ms | ease-in | Thu về nút gọi nó |
| Bay vào kho/túi | 450 ms | đường cong parabol | Nông sản, xu |
| Nhảy số | 400 ms | ease-out | Xu, XP |
| Ăn mừng | 1.200 ms | chuỗi | Lên cấp, mở tầng |

- Phản hồi chạm bắt đầu trong ≤ 100 ms.
- Không chuyển động nào chặn thao tác quá 300 ms, trừ ăn mừng (bỏ qua được bằng một chạm).
- Thu hoạch hàng loạt: gộp số bay, tối đa 12 vật phẩm bay cùng lúc.
- Tôn trọng cài đặt "Giảm chuyển động" của iPad: thay nảy và bay bằng mờ dần.

## 12. Âm thanh giao diện
Mỗi thành phần ở mục 6 có một âm ngắn riêng (gỗ gõ, giấy sột soạt, xu leng keng, gốm ngân). Dưới 300 ms, không chói. Chỉ phát sau chạm đầu tiên.

## 13. Quy trình sản xuất

1. **Khám phá** — Google Stitch tạo 2–3 phương án cho mỗi màn hình theo mô tả ở mục 6.
2. **Lọc** — CTO loại phương án không đạt mục 3–5 và phép thử ở mục 1.
3. **Duyệt** — chủ dự án chọn 1 phương án từ ảnh so sánh.
4. **Dựng** — developer dựng lại bằng thành phần của hệ thống này, nối với `dispatch()`. Không dán nguyên code Stitch.
5. **Tranh** — tạo bằng Leonardo AI (gói miễn phí) theo câu lệnh phong cách chung trong Art Style Guide mục 9; kiểm 9 tiêu chí mục 12 của tài liệu đó; ghi vào `assets/ASSET_SOURCES.md`.
6. **Nghiệm thu** — theo mục 14, trên iPad thật.

Giấy phép: ảnh Leonardo gói miễn phí là công khai và thuộc sở hữu Leonardo, người dùng được cấp quyền sử dụng. Đủ cho bản chơi cá nhân. Trước khi phát hành thương mại phải rà lại điều khoản và tạo lại ảnh bằng gói có quyền sở hữu. Font Baloo 2 và Nunito: SIL OFL, được nhúng và phân phối.

## 14. Tiêu chí nghiệm thu giao diện

- [ ] Không có màu, cỡ chữ, thời lượng viết cứng ngoài `design-tokens.json`
- [ ] Mọi cặp chữ–nền ≥ 4,5; cỡ chữ nhỏ nhất 16 pt; dấu tiếng Việt đúng
- [ ] Vùng chạm ≥ 44 pt (nút chính ≥ 56 pt), cách nhau ≥ 8 pt
- [ ] Mọi nút có đủ 4 trạng thái; nút vô hiệu nêu lý do
- [ ] Mọi nút gọi lệnh thật; không có nút trơ
- [ ] Qua phép thử cổ tích ở mục 1
- [ ] Cửa sổ mở/đóng đúng thời lượng mục 11; FPS ≥ 60 khi mở cửa sổ trên nền thế giới đang chạy
- [ ] Ngang và dọc đều không vỡ; tránh vùng an toàn
- [ ] Bật "Giảm chuyển động" vẫn dùng được
- [ ] Không còn hình tạm (hoặc ghi rõ "chờ đồ họa")
- [ ] 35+ bài kiểm thử lõi vẫn đạt; không thay đổi nào trong `src/core`, `src/systems`, `src/persistence` do việc làm giao diện
