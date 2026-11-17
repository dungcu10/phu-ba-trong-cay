# CHỈ THỊ 12 TỔNG — CÂN BẰNG VÀ TỐI ƯU ĐỘ HẤP DẪN

Người ban hành: CTO/Game Director · Ngày 18/11/2026. Chủ dự án đã duyệt hướng.

**Bản này gộp chỉ thị 12 cũ và chỉ thị 13 cũ thành một.** Hai file cũ hủy, không làm theo nữa.

**Thứ tự làm:** làm **ngay sau khi xong chỉ thị 10 và 11 TỔNG đang làm**. Đây là đợt cân bằng cho toàn bộ game, gồm cả làng, thú cưng và nhà.

**Phần nào được làm sớm hơn:** những mục chỉ là chỉnh số thì nên gộp luôn vào phần kinh tế của chỉ thị 10 hoặc 11 nếu đang làm tới đó. Gồm:
- Đường kinh nghiệm.
- Quà bất ngờ.
- Thời gian khinh khí cầu.
- Tách 2 kho.
- Tốc độ sinh và độ hiếm của bọ.
- Lò Gốm thôi bán chậu chữ ký bằng xu.

**Ghi đè:** bản này thắng khi khác với chỉ thị 10 và 11 TỔNG ở các điểm sau:
- Kỹ năng Khách Quý của Mèo.
- Số Phú Bà: từ 40 lên khoảng 60, sinh ngẫu nhiên.
- Nguồn có chậu chữ ký.
- Hành động khi ghé vườn người khác: thành trộm, và bắt sâu thì bọ về túi mình.

**Nguyên tắc của chủ dự án:** thiên về tối ưu, không sửa quá nhiều.
- Chỉ chỉnh số và mở rộng hệ đã có: Chợ Mây, Phú Bà, ghé vườn, Lò Gốm, nâng chậu.
- Không viết lại hệ thống nào.

---

# PHẦN A — TIẾN ĐỘ, KHO, XU, ĐƠN, SỰ KIỆN, CÂY MỚI

## A0. KẾT QUẢ CTO ĐO ĐƯỢC

| Nhịp chơi | Ngày 1 | Ngày 3 | Ngày 9 | Ngày 30 | Mốc tiến bộ mỗi ngày sau ngày 9 |
|---|---|---|---|---|---|
| 4 giờ vào 1 lần | cấp 4 | cấp 14 | cấp 29 | cấp 44 | 1–2 |
| 2 giờ vào 1 lần | cấp 8 | cấp 24 | cấp 37 | cấp 54 | 1 |
| 1 giờ vào 1 lần | cấp 14 | cấp 26 | cấp 37 | cấp 53 | 1–3 |

Mục tiêu của chỉ thị 10 là: ngày 1 cấp 5–6, ngày 7 cấp 12–14, ngày 30 cấp 22–26. Hiện tại người chơi nhanh gấp khoảng 2 lần mục tiêu.

**Hệ quả:**
- Toàn bộ thứ mới (bảng mở khóa cấp 1–16) hết trong **2–3 ngày**.
- Từ khoảng ngày 9, mỗi ngày chỉ còn khoảng 1 thứ mới. Người chơi không còn gì để chờ, và đây là lúc game bắt đầu nhàm.
- Xu dồn lại tới 200.000–570.000 vào cuối tháng, gấp 10–24 lần thu nhập một ngày, mà không có gì để tiêu.

---

## A1. P1 — TIẾN ĐỘ QUÁ NHANH

**Nguyên nhân (CTO đo lại):**
- Trong mô phỏng 30 ngày, người chơi **chỉ giao 4 đơn**. Kinh nghiệm gần như toàn bộ đến từ **thu hoạch**: 17.579 lần thu hoạch, cộng thưởng nhiệm vụ.
- Đường kinh nghiệm quá thoải: `xpBase 10`, `xpExponent 1.6`.
- Quà bất ngờ rơi khoảng **100 lần mỗi ngày** (5.290 lần trong 30 ngày).
- Đơn hàng mới tới sau mỗi **45 giây** (`refillSeconds`), coi như vô hạn. Cái này chưa đẩy kinh nghiệm trong mô phỏng, nhưng sẽ đẩy khi người chơi thật chịu giao đơn.
- **Mô phỏng chưa giống người thật:** bot bán nông sản trước rồi mới giao đơn. Phải sửa `progression.ts` để bot ưu tiên giao đơn khi lời hơn bán, thì mọi số đo mới đúng.

**Cách sửa:**
1. Làm dốc đường kinh nghiệm. Gợi ý: `xpExponent` khoảng 2.0–2.2, hoặc tăng `xpBase`. Chỉnh bằng mô phỏng, không đoán số.
2. **Đơn hàng theo kiểu khinh khí cầu thật:** giao xong đơn ở ô nào thì khinh khí cầu của ô đó bay đi 20–60 phút, tăng theo cấp, rồi mới về với đơn mới (đúng như mục 3.6 của chỉ thị 10). Bỏ hẳn cơ chế 45 giây. Bỏ đơn thì chờ 10 phút.
3. Giảm quà bất ngờ còn khoảng 10–15 lần mỗi ngày (`giftChancePer10Min`). Giảm kinh nghiệm mỗi lần thu hoạch của cây ngắn.
4. Giảm `xpPerCoin` của đơn nếu cần, để kinh nghiệm từ đơn chiếm khoảng 35–45% tổng kinh nghiệm, không lấn át thu hoạch.

**Mục tiêu sau khi sửa** (người chơi 2 giờ vào 1 lần, 8:00–22:00):

| Ngày | 1 | 3 | 7 | 14 | 30 | 60 |
|---|---|---|---|---|---|---|
| Cấp | 5–6 | 9–10 | 13–15 | 18–20 | 25–28 | 34–38 |

Thêm 2 ràng buộc:
- Cho tới ngày 30, **mỗi ngày phải có ít nhất 2 mốc tiến bộ** (thứ mới mở, tầng hoặc ô chậu mới, chậu đạt mốc cấp, nhà lên cấp, thú cưng lên sao).
- Ghi kết quả 3 nhịp chơi (4 giờ, 2 giờ, 1 giờ) vào `docs/reviews/economy-10.md`.

---

## A2. P1 — KHO ĐẦY LIÊN TỤC

**Hiện trạng:**
- Kho có 60 chỗ, nhưng ảnh chụp cho thấy **112/60**, với 339 con Bọ Rùa nằm trong kho.
- Sâu bọ đang chiếm chỗ kho nông sản.
- Chỉ thị 10 và 11 còn thêm khoảng 30 loại vật phẩm mới, nên kho sẽ kẹt liên tục. Đây là cảm giác khó chịu nhất cho người chơi.

**Cách sửa** (theo cách Khu Vườn Trên Mây chia kho):

| Kho | Chứa gì | Giới hạn |
|---|---|---|
| **Kho Nông Sản** (Rương Mây hiện có) | Nông sản và hàng chế biến | Có giới hạn, nâng cấp bằng xu như hiện nay |
| **Túi Nguyên Liệu** (mới) | Sâu bọ, khoáng sản, cá, Sợi Mây, Giọt Sương, Hạt Kê, mồi câu, Huy Hiệu, Mảnh Trứng Rồng, vật liệu chậu | **Không giới hạn** |

- Thêm migration: chuyển các món trong kho cũ sang đúng túi. Không mất món nào.
- Giao diện: Rương Mây có 2 tab, mỗi tab có thanh sức chứa riêng.
- Thông báo "Kho đầy" chỉ nói về Kho Nông Sản, kèm nút **Bán nhanh** (bán các món đang thừa so với đơn hàng đang mở).

---

## A3. P1 — XU THỪA, KHÔNG CÓ GÌ ĐỂ TIÊU

**Mục tiêu:** trong suốt 30 ngày, lượng xu đang giữ luôn nằm trong khoảng **1–5 lần thu nhập một ngày** (chỉ số `Xu/U` trong `progression.ts`).

**Chỗ tiêu xu theo cấp:**
- Nâng nhà và Cấp Làng (chỉ thị 11).
- Đúc chậu, trang trí.
- Mở tầng cao.
- Nâng sao máy.
- Giá các mục trên tăng dần theo cấp người chơi.

Thêm một **mục tiêu tiêu xu dài hạn: Dinh Phú Bà** ở ô 9 của làng (làm ở đợt sau khi có hình). Xây qua 5 giai đoạn, mỗi giai đoạn cần nhiều xu cộng nguyên liệu từ mọi hệ. Đây là món tiêu xu lớn nhất game và là niềm tự hào hiện trên Bảng Phú Bà.

---

## A4. P2 — ĐƠN HÀNG NHẠT

**Hiện trạng:**
- Mỗi dòng của đơn chọn ngẫu nhiên đều trong mọi cây đã mở, nên ở cấp cao vẫn liên tục ra đơn Cúc Bông Gòn rẻ tiền.
- Số lượng chỉ tăng theo cấp.

**Cách sửa:**
- **Ưu tiên cây mới mở:** trọng số theo cây, cây mở gần đây nặng hơn, Cúc giảm dần sau cấp 10.
- **Đơn đặc sản tầng:** cần nông sản trồng trên tầng có đặc tính phù hợp.
- **Đơn có hàng chế biến:** từ khi mở Xưởng, khoảng 40% đơn có ít nhất 1 món hàng chế biến.
- **Đơn hiếm:** viền vàng, có hạn 24 giờ, thưởng thêm Sợi Mây hoặc Giọt Sương.
- **Đơn khách quen:** BOT thân thiết với người chơi thì đặt đơn, có câu thoại ngắn.

---

## A5. P2 — THIẾU NHỊP NGÀY, TUẦN, MÙA

**Hiện trạng:** `events.json` chỉ có 1 sự kiện kéo dài 1 tháng.

**Cách sửa:**
- **Lịch sự kiện xoay vòng 7–10 ngày.** Mỗi sự kiện đẩy một hệ thống:

| Sự kiện | Hệ được đẩy |
|---|---|
| Mùa Săn Bọ | Sâu bọ, chim |
| Hội Câu Cá | Câu cá |
| Chợ Phiên Mây | Chợ, chế biến |
| Lễ Hội Trăng | Ban đêm, Vườn Trăng |
| Tết Phú Bà | Lễ Tết Việt, có chậu sự kiện |

- Mỗi sự kiện có thanh điểm, mốc thưởng và 1 chậu hoặc vật phẩm sự kiện. Lịch sinh từ seed theo ngày thật nên chạy được khi offline.
- **Nhiệm vụ tuần** có phần thưởng lớn: Sợi Mây, Giọt Sương, ngọc. Làm mới vào thứ Hai.

---

## A6. P1 — QUÁ ÍT CÂY TRỒNG (cần hình, chủ dự án vẽ)

**Hiện trạng:**
- Chỉ có **6 cây**. Cây cuối (Hoa Đồng Tiền Vàng) mở ở cấp 9. Cây lâu nhất chỉ 2 giờ.
- Trong khi đó có **108 loại chậu**: chậu nhiều mà cây ít, mất cân đối.
- Hệ **Kỳ Hoa** được nhắc trong bọ (Ve Sầu Ngọc), Đom Đóm và trong thiết kế, nhưng **chưa có cây Kỳ Hoa nào**.
- Không có **cây trồng qua đêm**: tắt game 8 giờ thì vườn đứng yên 6 tiếng.

**Hướng xử lý:** thêm **18 cây, nâng tổng lên 24**, trải từ cấp 2 tới cấp 40, theo 4 hệ:

| Nhóm | Cây đề xuất (tên mình đặt) | Cấp mở | Thời gian lớn |
|---|---|---|---|
| Hoa | Hồng Mây, Hướng Dương Nắng, Sen Hồng, Lan Hồ Điệp Mây | 5, 11, 17, 26 | 10 phút – 8 giờ |
| Quả | Táo Đỏ Mây, Nho Tím Sương, Đào Tiên, Dưa Hấu Mây | 7, 13, 20, 30 | 20 phút – 12 giờ |
| Rau Thảo | Cải Mây, Bí Ngô Vàng, Trà Shan Tuyết, Ớt Lửa | 8, 14, 22, 33 | 15 phút – 8 giờ |
| **Kỳ Hoa** (mới) | Hoa Trăng Non, Cỏ Sao Băng, Hoa Pha Lê, Đào Bất Tử, Hoa Cầu Vồng, Nấm Ngọc Đêm | 12, 16, 19, 24, 35, 40 | 4 giờ – 12 giờ, một số chỉ lớn hoặc lớn nhanh vào ban đêm |

- Mỗi cây cần đủ: 5 giai đoạn khác hình dáng, biểu tượng nông sản, danh sách bọ đậu, giá trị, kinh nghiệm, và cây đó xuất hiện trong đơn và trong Xưởng (công thức mới cho Kỳ Hoa ở Máy Mài Ngọc và máy chế biến mới).
- **Cây qua đêm (8–12 giờ)** cho nhiều xu và kinh nghiệm hơn trên mỗi lần chạm, nhưng ít hơn trên mỗi giờ. Đây là lựa chọn trước khi đi ngủ.
- **Việc của mày bây giờ:** làm dữ liệu, lõi và test cho 18 cây với hình tạm. Mỗi cây chỉ được đưa ra bản chính khi chủ dự án đã gửi hình. Chủ dự án sẽ vẽ bằng Gemini theo câu lệnh của CTO.

---

## A7. P2 — GIAO DIỆN VÀ CẢM GIÁC CHƠI

| # | Vấn đề | Cách sửa |
|---|---|---|
| G1 | Thanh bên trái có 6 nút trở lên (Nhiệm vụ, Đơn hàng, Sạp, Phú Bà, Sổ Tay, Chim), lại thêm Lò Gốm và Lễ Hội bên phải. Nhìn rối và sẽ còn rối hơn khi thêm tính năng. | Chỉ thị 11: chuyển các chức năng vào nhà trong làng. Thanh trái chỉ giữ: Nhiệm vụ, Về Làng, cùng thước đo độ cao ở mép phải. |
| G2 | Ở cấp cao, việc chạm từng chậu để thu hoạch rất mỏi tay. | Vuốt ngón tay qua nhiều chậu để thu hoạch, gieo hoặc bắt bọ liền một lượt, giống Khu Vườn Trên Mây. Có rung nhẹ và số bay lên cho từng chậu. |
| G3 | Không biết tầng ở xa đang có cây chín. | Chấm trên thước đo độ cao (chỉ thị 11), cộng một nút nổi "Có X chậu chín" để bay thẳng tới tầng đó. |
| G4 | Cúc Bông Gòn 60 giây làm người chơi phải chạm liên tục ở 10 phút đầu. | Giữ 60 giây cho phần hướng dẫn. Từ cấp 3, đơn và nhiệm vụ giảm dần yêu cầu Cúc (mục A4). |

---

## A8. NGHIỆM THU PHẦN A (CTO tự chạy lại `progression.ts`)

1. Đạt bảng mục tiêu ở mục 1 với nhịp 2 giờ. Nhịp 4 giờ và 1 giờ không lệch quá 30% so với bảng.
2. Mỗi ngày có ít nhất 2 mốc tiến bộ, cho tới ngày 30.
3. `Xu/U` luôn trong khoảng 1–5.
4. Kho Nông Sản không bị đầy quá 20% thời gian chơi với nhịp 2 giờ. Túi Nguyên Liệu không giới hạn.
5. Migration chuyển kho không mất món nào. Có test.
6. Đơn hàng ở cấp 15+ có Cúc không quá 10% số dòng. Từ khi mở Xưởng, khoảng 40% đơn có hàng chế biến.
7. Toàn bộ test cũ vẫn xanh.


---

# PHẦN B — PHIÊN CHƠI, CHỢ ĐẶT LẠI, PHÚ BÀ ĐỘNG, TRỘM VƯỜN, CHỐNG LẠM PHÁT

## B0. CTO ĐO ĐƯỢC GÌ (mô phỏng `progression.ts`, nhịp 2 giờ vào 1 lần)

| Chỉ số | Ngày 7 | Ngày 30 | Đánh giá |
|---|---|---|---|
| Sâu bọ bắt được, cộng dồn | 7.752 | **61.841** (khoảng 2.000 con/ngày) | Lạm phát nặng |
| Bọ Rùa Mây trong kho | 3.928 | **34.420** | Thừa vô dụng |
| Ve Sầu Ngọc ("Rất hiếm") | 242 | **1.863** | Mất nghĩa "rất hiếm" |
| Châu Chấu Sương, Cánh Cam Ngọc (Khá) | 3 | 3 | Nút thắt: hầu như không có, chặn nâng chậu hệ Rau Thảo và Quả |
| Chậu chữ ký sở hữu (trên tổng 50) | **50/50** | 50/50 | Hết giá trị sưu tầm sau **1 tuần**, vì mua thẳng bằng 5.000–25.000 xu |
| Tổng số chậu / số chậu cấp ≥ 5 | 115 / 13 | 156 / 17 | Có nhiều chậu nhưng hầu như không nâng |
| Quà bất ngờ | 683 | 5.290 | Khoảng 100 lần/ngày, thành rác |
| Đơn đã giao | — | **4** | Bot mô phỏng gần như không giao đơn. Sửa bot (mục A1). |

**Kết luận:** cái gì cũng có quá nhiều, quá dễ, nên không còn cảm giác "muốn có". Chỉ thị này làm cho đồ hiếm thật sự hiếm, đồ thường thì luôn được dùng hết, và mỗi lần vào chơi đều có thứ đáng chờ.

---

## B1. PHIÊN CHƠI 10–15 PHÚT

**Mục tiêu:** người chơi vào **3–4 lần mỗi ngày, mỗi lần 10–15 phút**. Mỗi lần có khoảng 8–12 việc có ý nghĩa, và kết thúc tự nhiên vì hết việc, chứ không phải vì chán.

**Một phiên mẫu** (dùng làm kịch bản kiểm thử):

| Phút | Việc | Hệ thống |
|---|---|---|
| 0–1 | Nhận **Lộc Phiên** (mục B1.1), xem bong bóng báo | Đình |
| 1–4 | Vuốt thu hoạch các tầng, gieo lại, bắt bọ | Trồng cây (mục A7, G2) |
| 4–6 | Giao 1–3 đơn khinh khí cầu, nạp xưởng | Trạm, Xưởng |
| 6–9 | **Đi chợ**: xem 8 ô, đặt lại vài lần, săn đồ hiếm (mục B2) | Chợ Mây |
| 9–13 | **Ghé 3–5 vườn Phú Bà**: trộm, bắt sâu, giúp (mục B4, B5) | Phú Bà |
| 13–15 | Cho chim và thú cưng ăn, nâng 1 chậu, xem **Hẹn giờ** rồi thoát | Tháp Chim, Lò |

### B1.1. Lộc Phiên
- Mỗi ngày nhận được tối đa 3 lần, hai lần cách nhau ít nhất 2 giờ.
- Quà nhỏ tăng dần: lần 1 là xu, lần 2 là 1 lượt đặt lại chợ miễn phí, lần 3 là 1 lượt trộm thêm hoặc 1 ngọc.
- Mục đích: kéo người chơi vào game 3 lần mỗi ngày mà không ép.

### B1.2. Hẹn giờ
- Khi người chơi rời game, hoặc bấm nút đồng hồ, hiện danh sách những thứ sẽ xong và giờ xong. Ví dụ: "14:30 Tầng 2 chín · 15:10 Khinh khí cầu về · 16:00 Chợ tự làm mới · 18:00 Lượt trộm hồi".
- Cây trồng có nhãn **"Chín lúc 14:30"** ngay trong bảng chọn hạt, để người chơi chọn cây theo giờ mình sẽ quay lại.

### B1.3. Quà bất ngờ
- Giảm từ khoảng 100 lần xuống **10–15 lần mỗi ngày**.
- Bù lại bằng giá trị: mỗi lần là một khoảnh khắc thật, như đúng 1 con bọ Khá, 1 Sợi Mây, hay hạt hiếm. Không còn những gói xu lặt vặt.

---

## B2. CHỢ MÂY — ĐẶT LẠI SẠP ĐỂ SĂN ĐỒ HIẾM

Mở rộng tab "Chợ" trong Chợ Mây hiện có. Không làm hệ thống mới.

### B2.1. Cách chơi
- **Hiện 8 ô hàng**, mỗi ô do một Phú Bà bày bán (lấy từ danh sách Phú Bà động ở mục B3).
- **Mỗi ô có độ hiếm**, hiện bằng màu viền và hiệu ứng:

| Độ hiếm | Tỉ lệ mỗi ô | Viền | Có thể ra |
|---|---|---|---|
| Thường | 60% | xám | Nông sản (cả loại người chơi chưa mở, dùng cho đơn), bọ Thường, Hạt Kê |
| Khá | 26% | xanh lá | Bọ Khá (đúng loại người chơi đang thiếu được ưu tiên), Sợi Mây, khoáng thường, hạt giống |
| Hiếm | 10% | xanh dương | Bọ Hiếm, Giọt Sương, Ngọc Mây, **mảnh chậu Hiếm hoặc Sử Thi**, Huy Hiệu thú cưng |
| Sử Thi | 3,5% | tím | **Chậu chữ ký** (chậu nguyên), Mảnh Trứng Rồng, hạt Kỳ Hoa |
| Huyền Thoại | 0,5% | vàng, có tia sáng | Chậu Huyền Thoại (Phượng Hoàng, Long Cung…), bọ Rất hiếm |

- Mỗi ô mua được **1 lần**. Giá theo độ hiếm và cấp người chơi. Đồ Sử Thi trở lên có thể trả bằng xu hoặc ngọc, tùy món.
- **Tự làm mới miễn phí mỗi 4 giờ.**
- **Đặt lại** (làm mới ngay, tốn xu):
  - Giá = `U(cấp) × 0,15 × 1,5^n`, với n là số lần đã đặt lại hôm nay.
  - Lần đầu rẻ, càng đặt lại nhiều trong ngày càng đắt. Hết ngày thì giá về như cũ.
  - Đây là **chỗ tiêu xu chính** để chặn lạm phát xu.
- **Vận May (bảo hiểm):**
  - Mỗi lần đặt lại mà không ra ô Hiếm trở lên thì Vận May tăng 1.
  - Vận May đạt 10 thì lần sau chắc chắn có 1 ô Hiếm.
  - Vận May đạt 40 thì chắc chắn có 1 ô Sử Thi.
  - Vận May hiện bằng một thanh nhỏ, nên người chơi luôn thấy mình đang "gần trúng".
- **Ưu tiên đồ đang thiếu:** ô Khá có 50% khả năng là loại bọ hoặc vật liệu mà người chơi đang thiếu cho lần nâng chậu kế tiếp. Chợ là nơi gỡ nút thắt.
- **Khoảnh khắc trúng:** ra ô Sử Thi hoặc Huyền Thoại thì ô đó rung, có tia sáng, có âm riêng, và Xu Xu ngạc nhiên. Ô Huyền Thoại có thông báo trên Bảng Phú Bà: "Bạn vừa săn được Chậu Phượng Hoàng ở Chợ Mây".
- **Mèo Mây Con** (chỉ thị 11): kỹ năng Khách Quý đổi thành "+1 ô hàng" và tỉ lệ Hiếm +2%.

- **Nói rõ để khỏi nhầm:** đây là hàng của bot bày bán. Người chơi vẫn **không được tự đăng bán** chim, thú cưng, bọ Rất hiếm và chậu Sử Thi trở lên trên Sạp của mình (giữ đúng quy tắc của chỉ thị 10).

### B2.2. Dữ liệu
- Thêm `content/base/market.json`: bảng tỉ lệ độ hiếm, danh sách món theo độ hiếm, giá, hệ số đặt lại, mốc Vận May.
- Kết quả đặt lại tạo từ seed cộng bộ đếm, nên chạy tất định.

---

## B3. PHÚ BÀ ĐỘNG — NHIỀU HƠN, NGẪU NHIÊN, LỚN THEO NGƯỜI CHƠI

Mở rộng `neighbors.ts` và `neighbors.json` hiện có.

- **Giữ 8 Phú Bà "có tên tuổi"** từ danh sách hiện tại. Đây là đối thủ cố định, có tính cách và lời thoại, trong đó có Bà Tám.
- **Thêm Phú Bà sinh ngẫu nhiên:**
  - Luôn có khoảng **60 người** quanh người chơi. Bot nào chơi quá lâu không thấy người chơi tương tác thì "chuyển nhà" và được thay bằng bot mới.
  - Tên ghép từ danh sách họ, tên và danh hiệu (ví dụ "Bà Sáu Hạt Điều", "Cô Ba Trà Sen").
  - Hình đại diện sinh bằng `avatar.ts`. Tính cách và cây ưa trồng chọn ngẫu nhiên.
- **Lớn theo người chơi:**
  - Cấp mỗi bot nằm trong khoảng **cấp người chơi −4 đến +6**, có 2–3 "đại gia" ở mức +8 đến +12 để người chơi có người đuổi theo.
  - Tài sản tỉ lệ với thu nhập của người chơi.
  - Bot tự chơi theo đúng luật người chơi (đã có), nhưng tốc độ được kéo về đúng khoảng trên, để bảng xếp hạng luôn sát nút.
- **Giải Phú Bà theo tuần:**
  - Người chơi ở trong nhóm 30 người cùng hạng.
  - Điểm tuần tính từ xu kiếm được, đơn đã giao, số vườn đã giúp và đã trộm.
  - Cuối tuần, 5 người đứng đầu lên hạng, 5 người cuối xuống hạng.
  - Có 5 hạng: Đồng → Bạc → Vàng → Ngọc → **Phú Bà Huyền Thoại**.
  - Thưởng tuần theo hạng: Sợi Mây, Giọt Sương, ngọc, và chậu Sử Thi ở hạng cao.
  - Đây là động lực mỗi tuần. Dùng lại Bảng Phú Bà hiện có, chỉ thêm tab "Giải tuần".
- **Bảng Phú Bà:**
  - Tab "Quanh tôi": 5 người trên và 5 người dưới mình.
  - Mũi tên lên hoặc xuống hạng so với hôm qua (đã có).
  - Tab "Kẻ thù" (mục B4.3).

---

## B4. TRỘM VƯỜN (thay hành động "thu hoạch hộ" khi ghé vườn người khác)

### B4.1. Luật cơ bản
- **Lượt trộm mỗi ngày:** 5 lượt, hồi 1 lượt mỗi 3 giờ, tối đa giữ 5. Lộc Phiên lần 3 và Cấp Làng cho thêm lượt.
- Chỉ trộm được **cây đã chín** ở vườn Phú Bà.
- Mỗi lượt trộm 1 chậu, lấy **1–2 nông sản và không quá 25% sản lượng chậu đó**. Chậu đã bị trộm có dấu chân và không trộm lại được.
- Nông sản trộm được vào Kho Nông Sản. Đơn hàng dùng được.

### B4.2. Điều làm trộm thú vị (CTO đề xuất, chọn cả 5)
1. **Trộm trúng hàng hiếm:** mỗi lần trộm có 8% ra **nông sản biến dị** (Vàng hoặc Ngọc, bán giá cao) và 3% ra **hạt giống của cây người chơi chưa mở**. Đây là cách duy nhất để trồng thử cây cấp cao sớm, và là lý do chính để đi trộm.
2. **Chó giữ vườn và thú cưng canh:**
   - Vườn có thú cưng canh (chỉ thị 11) hoặc vườn của bot "khó tính" có **20–35% khả năng bắt quả tang**.
   - Bị bắt thì có hoạt cảnh vui (thú cưng đuổi, người chơi chạy), **mất lượt nhưng không mất đồ**.
   - Thú cưng **Cáo Lửa Con** của mình giảm 10% khả năng bị bắt khi đi trộm. **Mèo Mây Con** canh vườn nhà giảm 50% số lần bị bot trộm.
3. **Bot cũng trộm vườn mình:**
   - Chỉ khi người chơi đang tắt game. Tối đa 3 lần mỗi ngày, mỗi lần tối đa 10% một chậu chín.
   - Không bao giờ lấy nông sản biến dị. Không trộm khi người chơi đang chơi.
   - Lúc vào game có thông báo: "Bà Sáu Hạt Điều đã trộm 2 Dâu Tây Mây của bạn".
4. **Trả đũa:** ai đã trộm của mình thì vào danh sách **Kẻ Thù** trong 24 giờ. Trộm lại vườn người đó **không tốn lượt, không bị bắt, và được gấp đôi**. Bắt sâu giúp ở vườn kẻ thù không được thưởng. Đây là lý do để mở game mỗi khi bị trộm.
5. **Chuỗi trộm:** trộm thành công 3 vườn khác nhau liên tiếp, không bị bắt, thì có "Cú Đúp": lần trộm thứ 4 được gấp đôi và chắc chắn ra hàng biến dị.

### B4.3. Cân bằng trộm
- Giá trị trộm mỗi ngày không quá **15% thu nhập nông sản** của người chơi vừa.
- Bot trộm của người chơi tối đa 5%.
- Trộm không ảnh hưởng xếp hạng của bot, nên người chơi không bị "trừ điểm".

---

## B5. BẮT SÂU VÀ GIÚP VƯỜN NGƯỜI KHÁC

- Bắt sâu ở vườn Phú Bà thì **con bọ vào Túi Nguyên Liệu của mình** (đổi so với hiện tại), cộng thêm điểm thân thiết với chủ vườn.
- Giới hạn: **10 lượt giúp mỗi ngày** (bắt sâu và tưới cây dùng chung lượt), tách riêng với lượt trộm.
- Vườn bot có bọ theo đúng loại cây bot đó đang trồng. Bot trồng Rau Thảo thì có Châu Chấu Sương, nên đây là nguồn chính để gỡ nút thắt bọ Khá. Bảng ghé vườn hiện **"Vườn này đang có: Châu Chấu Sương ×3"** để người chơi chọn đúng nhà cần ghé.
- Thân thiết với một Phú Bà đạt mốc 3, 6, 10 thì có quà (đã có hệ điểm thân thiết, chỉ thêm mốc). Phú Bà thân thiết **không trộm vườn mình** và đôi khi gửi đơn khách quen (mục A4).

---

## B6. CHỐNG LẠM PHÁT SÂU BỌ

### B6.1. Mục tiêu
Người chơi vừa, ngày 7–30, mỗi ngày nhận:

| Độ hiếm | Mỗi ngày | Tồn kho tối đa mong muốn |
|---|---|---|
| Thường | 40–70 con | ≤ 5 ngày nhu cầu |
| Khá | 10–18 con (mỗi loại 3–6) | ≤ 5 ngày nhu cầu |
| Hiếm | 1–3 con | — |
| Rất hiếm | **1 con mỗi 3–5 ngày** | — |

### B6.2. Cách làm (chỉ chỉnh số và quy tắc sinh, không đổi hệ)
1. **Giảm tốc độ sinh bọ:**
   - Mỗi lượt trồng sinh tối đa 1 con bọ, hoặc 2 con với cây ≥ 2 giờ.
   - Xác suất sinh tăng theo thời gian lớn của cây. Cây 60 giây gần như không có bọ.
   - Chỉnh `growSecondsPerBug` và trần bọ theo lượt trồng.
2. **Chỉnh trọng số độ hiếm:**
   - Rất hiếm: trọng số từ 3 xuống **0,15**, chỉ ở cây ≥ 4 giờ hoặc ban đêm.
   - Hiếm: chỉ ở cây ≥ 30 phút, trọng số khoảng 2.
   - Mỗi hệ cây có bọ Khá riêng của nó, trọng số khoảng 20.
3. **Thêm chỗ dùng bọ** (đầu ra), tất cả nối vào hệ đã có:
   - Nâng chậu: chỗ tiêu chính, chỉnh lại số ở mục 7.
   - Nâng sao máy Xưởng, nâng Tháp Chim, sao thú cưng (chỉ thị 10, 11).
   - **Mồi câu:** 3 Sâu Lá Non thành 1 Mồi Thường.
   - **Đơn thu mua bọ:** 15% đơn khinh khí cầu có 1 dòng là bọ Thường hoặc Khá.
   - **Bán bọ ở Sạp hoặc Chợ** cho bot, giá thấp. Đây là "sàn" để bọ thừa vẫn có chút giá trị.
4. **Chim và Cáo chỉ bắt bọ đang có, không sinh thêm bọ** (đã đúng). Kiểm tra lại: tổng bọ có chim và Cáo không vượt 1,45 lần tổng bọ khi không có.

### B6.3. Migration cho save cũ
Người chơi đang giữ hàng nghìn con bọ thì **giữ nguyên, không xóa**. Chỉ tốc độ sinh bọ mới chậm lại.

---

## B7. NÂNG CHẬU VÀ ĐỘ HIẾM CHẬU — CHỐNG LẠM PHÁT CHẬU

### B7.1. Lò Gốm chỉ bán chậu thường
- Lò Gốm **chỉ bán bằng xu**: các dòng chậu Thường, Tốt, Hiếm cơ bản (Đất Nung, Sứ Mây, Gỗ Trắc…).
- **Chậu chữ ký (50 chiếc), Sử Thi, Huyền Thoại không bán bằng xu nữa.** Chỉ có được từ:

| Nguồn | Tỉ lệ hoặc nhịp |
|---|---|
| Chợ đặt lại | Ô Sử Thi và Huyền Thoại (mục B2) |
| Đúc chậu ở Lò Gốm | Khoáng sản và Ngọc Mây; chậu hiếm hơn cần khoáng hiếm hơn (chỉ thị 10) |
| Rương Mây Trôi, Rương Biển Mây | Có tỉ lệ ra chậu hoặc mảnh chậu |
| Sự kiện, Giải tuần, Huy Chương Độ Cao | Chậu cố định theo mốc |
| **Mảnh chậu** | Gom đủ 10 mảnh cùng loại thì ghép thành 1 chậu |

- **Nhịp mục tiêu** (người chơi vừa): khoảng 1 chậu chữ ký mới mỗi 2–3 ngày. Đủ 50 chậu chữ ký mất **4–6 tháng**. Chậu Huyền Thoại khoảng 1 chiếc mỗi tháng.
- **Save cũ:** chậu đã mua thì **giữ nguyên**.

### B7.2. Chậu trùng đổi thành sao chậu
- Có chậu trùng loại thì tự đổi thành **10 Mảnh** của đúng loại đó.
- Mảnh dùng để **nâng sao chậu từ ★1 lên ★5**. Mỗi sao cộng 3–5% chỉ số chính và thêm một hiệu ứng nhỏ trên chậu (dùng hào quang và hạt sáng vẽ bằng code).
- Nhờ vậy mỗi lần trúng chậu trùng vẫn có giá trị, không bao giờ là "rác".

### B7.3. Nâng cấp chậu cho có cảm giác
**Hiện trạng:** 156 chậu nhưng chỉ 17 chậu đạt cấp 5 trở lên. Người chơi gom chậu chứ không nuôi chậu.

**Cách sửa:**
- Giảm số chậu Đất Nung cấp 1 "rác". Ô chậu mới có sẵn chậu Đất Nung như hiện nay, nhưng có **nút "Thay chậu"**: chọn chậu tốt trong kho chậu để thay vào, chậu cũ quay về kho.
- **Gợi ý "Gần mốc":** chậu nào còn 1–2 cấp nữa tới mốc đổi ngoại hình (bậc 2, 3, 4) thì có viền vàng nhấp nháy, kèm dòng "Còn 2 cấp nữa chậu sẽ đổi dáng". Bấm vào là thấy trước dáng mới (đã có ở DESIGN_SYSTEM mục 6.7).
- **Chi phí nâng:** xu giảm khoảng 30%, bọ thành điều kiện chính, đúng hệ của chậu (mục B6). Chậu cấp cao cần bọ Hiếm hoặc Rất hiếm. Vì vậy đi chợ, đi giúp vườn và nuôi chim đều có ý nghĩa.
- **Mục tiêu:** người chơi vừa có **6–8 chậu ≥ cấp 10 vào ngày 30**, và 1–2 chậu đạt bậc Bảo Vật (cấp 8+ theo bậc ngoại hình).

---

## B8. NGHIỆM THU (CTO chạy lại mô phỏng)

1. Sửa `progression.ts` để mô phỏng người chơi thật: biết giao đơn, đi chợ đặt lại tối đa 3 lần mỗi phiên, trộm và giúp vườn, mua chậu trong giới hạn.
2. Đạt bảng mục tiêu ở B6.1 (bọ), B7.1 (chậu), và A1 (cấp theo ngày).
3. `Xu/U` trong khoảng 1–5 suốt 30 ngày. Chợ đặt lại chiếm 20–35% tổng xu đã tiêu.
4. Trộm không quá 15% thu nhập nông sản. Bot trộm của người chơi không quá 5%.
5. Giải tuần: mô phỏng 4 tuần, người chơi vừa lên được hạng 2–3, người chơi nhiều lên hạng 4.
6. Mỗi phiên mô phỏng (nhịp 4 giờ) có 8–12 hành động có ý nghĩa và kéo dài khoảng 10–15 phút thao tác theo bảng thời gian ước tính của từng hành động.
7. Test mới:
   - Tỉ lệ độ hiếm ở chợ và mốc Vận May.
   - Trộm: giới hạn 25%, bị bắt quả tang, kẻ thù trả đũa.
   - Bot không trộm khi người chơi đang chơi.
   - Bọ ở vườn bot đúng theo loại cây bot trồng.
   - Chậu trùng đổi thành mảnh. Ghép 10 mảnh thành chậu.
   - Migration giữ nguyên chậu và bọ cũ.
   - BOT dùng chung luật.
8. Bản thử có các màn: Chợ đặt lại (có hiệu ứng trúng Sử Thi), Giải tuần, ghé vườn và trộm (có hoạt cảnh bị bắt), danh sách Kẻ Thù, nâng sao chậu bằng mảnh.

## B9. CẤM
- Không xóa chậu, bọ, xu mà người chơi đang có.
- Không có nạp tiền. Đặt lại chợ chỉ tốn xu hoặc ngọc kiếm trong game.
- Bot không được trộm khi người chơi đang chơi. Không bao giờ trộm hàng biến dị. Không trộm quá giới hạn.
- Không viết hệ thống mới khi mở rộng được hệ cũ (Chợ Mây, `neighbors.ts`, Lò Gốm, ghé vườn).
