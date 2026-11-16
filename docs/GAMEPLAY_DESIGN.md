# Phú Bà Trồng Cây — Thiết kế gameplay lõi

Bản gốc (có thể chỉnh sửa, bình luận): https://claude.ai/artifact/6jneqNVWeyAMg9mGeFHBDg
Ngày: 2026-11-16 · Trạng thái: đề xuất, chủ dự án đã chấp thuận hướng "chậu + tầng mây".

> Ghi chú CTO 16/11/2026: Giai đoạn 0 + 1 chỉ làm lát cắt dọc — 1 tầng mây, 4 vị trí chậu, 6 giống cây, 1 loại Bọ Mây, nâng cấp chậu, bán lấy tiền, lên cấp. Các phần còn lại của tài liệu này là thiết kế cho các giai đoạn sau, KHÔNG làm trước khi được nghiệm thu và lên lịch.

## 1. Kiểm kê hiện trạng & thứ tự triển khai

Dự án đang ở giai đoạn thiết kế: chưa có chức năng game nào được lập trình, nên chuyển sang mô hình chậu + tầng mây không phá bỏ gì. Phần lớn kiến trúc đã duyệt dùng lại nguyên vẹn.

| Hạng mục | Trạng thái | Ảnh hưởng của định hướng mới |
| --- | --- | --- |
| Kiến trúc kỹ thuật (lõi mô phỏng, lệnh, đồng hồ, lưu trữ, gói nội dung, BOT dùng chung luật) | Đã duyệt | Giữ nguyên |
| Nền tảng iPad + PixiJS/WebGPU, web app trên màn hình chính | Đã duyệt | Giữ nguyên |
| Tên, thương hiệu, kinh tế không nạp tiền | Đã duyệt | Giữ nguyên |
| Art Style Guide | Bản nháp đầy đủ | Đã cập nhật: chậu, tầng mây, danh sách tài nguyên |
| Bảng hệ thống gameplay trong tài liệu kiến trúc | Bản nháp | Thay bằng tài liệu này |
| Lộ trình | Đã duyệt | Theo `GAME_ROADMAP.md` của CTO |

Thứ tự đề xuất (tham khảo; lộ trình chính thức là `GAME_ROADMAP.md`):

| Giai đoạn | Nội dung | Bản chơi được cuối giai đoạn |
| --- | --- | --- |
| 0 · Nền móng | Lõi mô phỏng, đồng hồ, lưu/khôi phục, nạp gói nội dung; mô hình dữ liệu Tầng–Chậu–Cây | Kiểm thử tự động chạy |
| 1 · Vườn tầng mây đầu tiên | Lát cắt dọc: 1 tầng, 4 chậu, 6 cây, 1 Bọ Mây, nâng cấp chậu, bán, lên cấp; vẽ bằng PixiJS với ảnh tạm; cài lên iPad | Chơi thử trên iPad |
| 2 · Chậu chuyên sâu | 5 độ hiếm, thuộc tính, nâng cấp bằng Bọ Mây, đổi ngoại hình theo cấp, bộ chậu, chậu kỹ năng, mảnh chậu; mở/nâng tầng có hoạt ảnh | Chiều sâu xây dựng |
| 3 · Cây chuyên sâu | Độ hiếm, thu hoạch nhiều lần, Thông Thạo, Biến Dị, Sổ Tay Thực Vật; Linh Thú Tầng; đơn hàng, Bảng Tin Mây, Rương Mây Trôi | Vòng lặp đầy đủ |
| 4 · Thế giới BOT | BOT có vườn tầng mây riêng, mô phỏng offline, thăm vườn, giúp bắt Bọ Mây, Bảng Phú Bà | Thế giới sống |
| 5 · Giao thương | Sạp Phú Bà, Chợ Trời, mua bán chậu/hạt/nông sản với BOT | Kinh tế mở |
| 6 · Nhiệm vụ, thành tựu, sự kiện | Nhiệm vụ ngày/tuần, chuỗi theo tầng, cây & chậu sự kiện | Chơi lâu dài |
| 7 · Trang trí, thời trang, thú cưng, hoàn thiện | Ảnh thật toàn bộ, hiệu ứng, âm thanh, tối ưu, hướng dẫn tân thủ | Bản phát hành |

## 2. Vòng lặp cốt lõi

Khu vườn là **một cột tầng mây xếp chồng lên trời**; mỗi tầng có một hàng vị trí đặt chậu, mỗi chậu trồng một cây. Người chơi vuốt lên xuống giữa các tầng, kéo tay qua cả hàng chậu để thu hoạch và gieo lại. Cảm giác tiến bộ đến từ ba trục: **vườn cao thêm** (tầng mới), **chậu xịn hơn** (độ hiếm, cấp), **cây quý hơn** (độ hiếm, Thông Thạo, Biến Dị).

1. **Gieo** hạt vào chậu trống (một chạm "gieo lại như cũ" cho cả tầng).
2. **Chăm**: tưới khi cây khát, bắt Bọ Mây đậu trên cây.
3. **Thu hoạch** → nông sản vào kho, XP, đôi khi rơi vật phẩm hiếm hoặc ra quả Biến Dị.
4. **Kiếm tiền**: giao đơn hàng, bán cho cửa hàng, bày Sạp cho BOT mua, cho Linh Thú Tầng chế biến.
5. **Đầu tư**: mua và nâng cấp chậu (xu + Bọ Mây), mở và nâng tầng mây, mua hạt quý hơn.
6. **Mở khóa**: cấp độ và tầng mới mở giống cây, loại chậu, Linh Thú và vùng phong cách mới.

Nhịp chơi: phiên ngắn 2–5 phút vài lần mỗi ngày và phiên dài khi muốn.

## 3. Hệ thống Tầng Mây

Mỗi tầng là một đảo mây nổi riêng, xếp chồng và nối nhau bằng cầu thang dây leo; máy quay vuốt dọc theo cột tầng. Gói gốc có **10 tầng**.

| Tầng | Tên & phong cách | Mở ở cấp | Giá mở (xu) | Đặc tính môi trường |
| --- | --- | --- | --- | --- |
| 1 | Đồng Mây Ngọc — đồng cỏ xuân | 1 | miễn phí | Không |
| 2 | Vườn Trà Sương Sớm | 5 | 2.000 | Cây Rau Thảo lớn nhanh hơn 10% |
| 3 | Ruộng Bậc Thang Hoàng Kim | 10 | 8.000 | Cây Quả thêm 10% sản lượng |
| 4 | Hồ Sen Cầu Vồng | 16 | 25.000 | Tưới một lần thấm cả tầng |
| 5 | Rừng Nấm Sương Tím | 22 | 70.000 | Ban đêm lớn nhanh hơn 25% |
| 6 | Thung Lũng Hoa Đăng | 30 | 180.000 | Cây Hoa tăng giá bán 15% |
| 7 | Đảo Băng Kẹo | 38 | 450.000 | Tỉ lệ Biến Dị tăng 50% |
| 8 | Vườn Thiên Văn | 46 | 1,1 triệu | Cây Kỳ Hoa thêm XP 20% |
| 9 | Cung Trăng Ngọc | 55 | 2,6 triệu | Rơi Ngọc Mây khi thu hoạch (hiếm) |
| 10 | Đỉnh Phú Quý | 65 | 6 triệu | Thuộc tính chậu trên tầng mạnh thêm 10% |

**Mỗi tầng có 10 vị trí chậu** (quyết định của chủ dự án, 16/11/2026). **Cấp tầng (1–5)**: đặc tính môi trường mạnh hơn; cách mở rộng tầng theo cấp chờ CTO thiết kế lại cho mốc 10 chậu.

**Góc nhìn và bố cục** (chủ dự án, 16/11/2026): nhìn chính diện; một cây leo cổ thụ đứng dọc bên trái, các tầng mây là kệ mây bám vào thân cây, xếp chồng lên trời. Nâng cấp cần xu + nguyên liệu của Linh Thú tầng đó.

**Hoạt ảnh**: mở tầng — máy quay lướt lên, mây dạt ra, đảo nổi lên, cầu thang mọc, pháo hoa vàng kim. Nâng cấp — đảo rung nhẹ, nở rộng, vị trí chậu mới trồi lên.

## 4. Hệ thống Chậu

| Thuộc tính | Tác dụng |
| --- | --- |
| Tốc Độ | Giảm % thời gian sinh trưởng |
| Sản Lượng | Tăng % nông sản mỗi lần thu hoạch |
| Kinh Nghiệm | Tăng % XP |
| Vận May | Tăng tỉ lệ rơi vật phẩm hiếm và Biến Dị |
| Thu Hút | Tăng số Bọ Mây đậu trên cây |

Hệ ưa thích (Hoa, Quả, Rau Thảo, Kỳ Hoa): trồng đúng hệ thì mọi thuộc tính mạnh thêm 20%.

| Độ hiếm | Thuộc tính chính ở cấp 1 | Số thuộc tính | Cấp tối đa | Nguồn chính |
| --- | --- | --- | --- | --- |
| Thường | 3% | 1 | 5 | Cửa hàng |
| Tốt | 6% | 2 | 8 | Cửa hàng, Rương Mây Trôi |
| Hiếm | 10% | 2 | 10 | Bảng Tin Mây, Linh Thú, ghép mảnh |
| Sử Thi | 15% | 3 | 12 | Ghép mảnh, thành tựu, sự kiện |
| Huyền Thoại | 20% | 3 + kỹ năng | 15 | Chuỗi nhiệm vụ tầng cao, sự kiện lớn |

Mỗi cấp +8% giá trị gốc. **Nâng cấp luôn thành công**, chi phí xu + Bọ Mây (cấp cao cần bọ hiếm hơn: Bọ Rùa Mây → Chuồn Chuồn Ngọc → Đom Đóm Vàng → Bướm Cầu Vồng). Ngoại hình 4 bậc theo cấp. Chậu đặc biệt: bộ chậu (3 chậu cùng bộ cùng tầng), chậu kỹ năng (Heo Đất, Đèn Lồng, Mây Bông, Ngọc Như Ý), chậu sự kiện. Mảnh chậu (30 mảnh = 1 chậu), Nung lại (hoàn một phần Bọ Mây), bộ cấu hình chậu.

## 5. Hệ thống Cây trồng

4 hệ, 5 độ hiếm; khoảng 60 giống trải 10 tầng.

| Ví dụ cây | Hệ | Độ hiếm | Mở ở cấp | Thời gian lớn | Số lần thu hoạch |
| --- | --- | --- | --- | --- | --- |
| Cúc Bông Gòn | Hoa | Thường | 1 | 1 phút | 1 |
| Cà Chua Bi Ngọt | Quả | Thường | 2 | 5 phút | 2 |
| Bạc Hà Mây | Rau Thảo | Thường | 3 | 15 phút | 3 |
| Dâu Tây Mây | Quả | Tốt | 6 | 45 phút | 3 |
| Hoa Đồng Tiền Vàng | Hoa | Tốt | 9 | 2 giờ | 2 |
| Sen Ngọc | Hoa | Hiếm | 16 | 6 giờ | 2 |
| Nấm Đèn Lồng | Kỳ Hoa | Hiếm | 22 | 4 giờ | 4 |
| Táo Vàng Phú Quý | Quả | Sử Thi | 30 | 8 giờ | 5 |
| Lan Hồ Điệp Mây | Hoa | Sử Thi | 38 | 12 giờ | 3 |
| Cây Kim Tiền Ngọc | Kỳ Hoa | Huyền Thoại | 55 | 24 giờ | 7 |

Giai đoạn: Hạt → Mầm → Lớn → Ra hoa/đậu trái → Chín. Cây thu hoạch nhiều lần quay về "Lớn". Thông Thạo (10/50/200/1.000 lần thu hoạch → 1–4 sao). Biến Dị: Vàng 1% ×3, Ngọc 0,2% ×5, Đêm Sao 0,2% ×5 (đêm), Cầu Vồng 0,05% ×10. Sổ Tay Thực Vật; cây sự kiện.

## 6. Chăm sóc

- **Tưới**: khát một lần mỗi giai đoạn; tưới giảm 10% thời gian còn lại; không tưới không bị phạt.
- **Bọ Mây**: số bọ mỗi vụ tỉ lệ với thời gian sinh trưởng (trung bình 1 con mỗi `growSecondsPerBug` giây, tối đa `maxPerCycle`; nhiều hơn khi Thu Hút cao ở giai đoạn sau); bọ đậu khi cây đã lớn (25–95% tiến độ) và ở lại đến khi bị bắt hoặc khi thu hoạch, nên người ghé thưa vẫn bắt được; chạm để bắt từng con; là nguyên liệu nâng cấp chậu; thu hoạch mà chưa bắt thì bọ bay đi, cây không bị hại. (Sửa theo biên bản CTO 01, R2.)
- **Sâu Tham Ăn** (giai đoạn sau): giảm 10% sản lượng nếu còn trên cây lúc thu hoạch.
- **Thu hoạch**: kéo qua hàng chậu; kho đầy thì cây chờ, không hỏng; cây chín không héo.
- **Gieo lại như cũ**; **Rương Mây Trôi** 3–5 lần/ngày (giai đoạn sau).

## 7. Linh Thú Tầng & đơn hàng (giai đoạn 3)

| Tầng | Linh Thú | Ăn | Làm ra |
| --- | --- | --- | --- |
| 1 | Ong Thợ Mây | Hoa | Mật Mây |
| 2 | Tằm Ngọc | Lá trà, rau thảo | Tơ Lụa Mây |
| 3 | Chuột Đồng Phú Quý | Quả, hạt | Mứt Vàng, Bột Bánh |
| 4 | Ếch Sen Hát | Sen | Trà Sen |
| 5 | Đom Đóm Lồng Đèn | Nấm | Dầu Thơm Đêm |

Hàng chờ 2 khe, chạy cả khi tắt game. Đơn hàng: khinh khí cầu mang 6 đơn, trả xu + XP cao hơn bán lẻ.

## 8. Kinh tế & tiến trình dài hạn

Không nạp tiền, không quảng cáo. Xu và Ngọc Mây (chỉ kiếm trong game).

| Kiếm xu | Tiêu xu |
| --- | --- |
| Giao đơn hàng | Hạt giống, Vợt Mây |
| Bán Sạp cho BOT | Mua và nâng cấp chậu |
| Bán cửa hàng (giá thấp, luôn mua) | Mở và nâng cấp tầng |
| Biến Dị, Chậu Heo Đất, Rương Mây Trôi | Nâng kho, khe Linh Thú |
| Nhiệm vụ, thành tựu | Trang trí, thời trang; thuế Chợ Trời 5% |

Năm thước đo tiến trình: cấp người chơi, chiều cao vườn, bộ sưu tập chậu, Sổ Tay Thực Vật, Tài Sản Phú Bà (danh hiệu Bà Tám Trồng Rau → … → Phú Bà Huyền Thoại; Bảng Phú Bà).

## 9. BOT trong mô hình chậu + tầng mây (giai đoạn 4)

Mỗi BOT có cột tầng, chậu, cây, Linh Thú như người chơi, cùng luật và giá; tự gieo, thu hoạch, bắt bọ, mua/nâng chậu, mở/nâng tầng theo mục tiêu và tính cách; thăm vườn được; giao dịch; cạnh tranh trên Bảng Phú Bà; tiếp diễn khi offline (mô phỏng tất định có hạt giống).

## 10. Điểm khác biệt & cải tiến

Lấy cảm hứng từ thể loại "vườn chậu trên tầng mây"; mọi tên gọi, giống cây, chậu, Linh Thú, số liệu, hình ảnh là của riêng Phú Bà Trồng Cây. Không tỉ lệ thất bại khi nâng cấp; không phạt vắng mặt; tầng có đặc tính môi trường thật; thao tác cảm ứng hiện đại; BOT sống khi offline; hoàn toàn miễn phí.
