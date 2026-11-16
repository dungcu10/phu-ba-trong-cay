# Giai đoạn 1 — Kiểm toán Phú Bà Trồng Cây và đối chiếu với Khu Vườn Trên Mây

Ngày 2026-11-16 · nhánh `feat/full-loop` · bản build 45ec5d2

## 0. Giới hạn của cuộc nghiên cứu (nói rõ trước)

- **Không cài và không chơi trực tiếp được Khu Vườn Trên Mây (KVTM).** Môi trường làm việc là máy Linux trên mây, không có iOS/Android, không tải được ứng dụng. Mọi nhận xét về KVTM dưới đây đến từ: ảnh chụp màn hình chủ dự án gửi, trang App Store (id1588009371) và các bài giới thiệu/hướng dẫn công khai (danh sách nguồn ở cuối). **Không có nhận xét nào về cảm giác chạm, tốc độ hoạt ảnh hay độ trễ của KVTM là đã kiểm chứng.** Những chỗ suy ra từ ảnh tĩnh được ghi "(suy từ ảnh)".
- Phú Bà Trồng Cây (PBTC) được kiểm tra thật: đọc mã, chạy 72 bài kiểm tra lõi + 5 bài trình duyệt, chụp màn hình bản build bằng Chrome (Playwright, khung 1194×834 như iPad Pro 11" ngang). **Chưa thử trên iPad thật / Safari** — việc đó cần chủ dự án.
- Không sao chép tài sản, mã hay thiết kế độc quyền của KVTM. Chỉ học **cấu trúc vòng chơi và cách tổ chức màn hình**; hình ảnh, tên gọi, nhân vật của PBTC là riêng.

## 1. Khu Vườn Trên Mây — những gì quan sát được

### 1.1 Ảnh chụp chủ dự án gửi (suy từ ảnh)
- **Góc nhìn chính diện** (không phải isometric): các tầng mây tím nhạt xếp chồng theo chiều dọc, mỗi tầng một "kệ" mây dày.
- **6 chậu mỗi tầng**, chậu rất to so với màn hình (chiếm ~1/7 chiều ngang), mỗi chậu có hình dáng riêng theo chủ đề con vật/linh vật, nhiều màu, có viền vàng — chậu là đồ trang trí chính, không phải bối cảnh.
- **Cây có mặt** (nhân hoá: mắt, má hồng), mỗi loài một dáng riêng, không phải đổi màu.
- **Đồ treo phía trên chậu** (đèn lồng, dây hoa) và **đồ trang trí hai đầu tầng** (cá chép trên tre ở bên phải).
- **Thân cây leo bên trái** gắn đầu lân và **một cỗ máy ở mỗi tầng** (chế biến).
- **3 ngôi sao trên dây leo cạnh mỗi tầng** — cấp độ/sao của tầng.
- HUD: trên trái cấp + XP, xu, kim cương; cột trái *Tin tức, Nhiệm vụ, rương 4/10, sự kiện hoa hướng dương có đồng hồ*; dưới trái *Trang trí, Bạn bè, Tăng cường*; trên phải *bảng đơn hàng + thư*; cột phải các ưu đãi/sự kiện có giờ; dưới phải *Cửa hàng*.

### 1.2 Theo tài liệu công khai
- Cây trồng theo thời gian thực, lớn qua từng giai đoạn; chậu đặt trên tầng mây với ngoại hình ngộ nghĩnh; kết bạn, trao đổi hàng, giúp nhau hoàn thành nhiệm vụ; sự kiện thường xuyên (thegioididong).
- **Sâu bọ có hại nếu bám lâu nhưng là nguyên liệu nâng cấp chậu; nâng chậu cần bắt sâu bọ + tiền vàng** (vietnamnet). Có chim giúp bắt sâu.
- **Mở tầng mây** bằng nút "Mở tầng mây" rồi "Mở khóa" khi đủ điều kiện (download.vn); điều kiện gồm cấp và vật phẩm.
- Bắt đầu chỉ có **một tầng mây với vài chậu đơn sơ**; mục tiêu dài hạn là sưu tầm chậu hiếm ("chậu thần thoại"), huy hiệu, nhiều tầng.
- Mỗi tầng có một cỗ máy/kén để **chế biến sản phẩm** (mytour); máy nâng sao giảm thời gian chế biến, tăng kinh nghiệm.
- Bộ chậu: đặt đủ bộ trên một tầng nhận thưởng bộ; cường hóa chậu/trang trí có tỉ lệ thành công; trang trí có hiệu ứng (giảm thời gian lớn, tăng thưởng đơn hàng); "thay áo" khu vườn.
- Đơn hàng qua khinh khí cầu, nhiệm vụ ngày, vòng quay, rương, sự kiện có hạn giờ, bảng xếp hạng, thăm vườn bạn bè, bảng tin rao vặt.

## 2. Phú Bà Trồng Cây hiện tại — kiểm toán

### 2.1 Phần lõi (tốt, giữ nguyên)
| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Kiến trúc 4 lớp (nội dung JSON · trạng thái · hệ thống thuần · vẽ/giao diện) | Tốt | `src/core`, `src/systems` không đụng DOM |
| Lưu cục bộ: 2 khe xoay vòng, checksum, migrations 1→6, reconcile | Tốt | `tests/save.test.ts` (13), `reconcile.test.ts` (8) |
| Giờ game không lùi, không đóng băng | Tốt | `clock.ts`, R4 |
| Offline (Service Worker cache-first) | Tốt | `offline.test.ts` (6) |
| Cây lớn theo thời gian thật, tưới, bọ theo thời gian lớn, thu hoạch, bán | Có | `growth.test.ts` (9) |
| Nhiều tầng (3), mở tầng có điều kiện + hoạt ảnh | Có | `floors-pots.test.ts` |
| 7 loại chậu, 5 chỉ số, nâng cấp, Lò Gốm (mua chậu), đổi chậu | Có | `pots.ts` |
| Đơn khinh khí cầu, quà, biến dị, Sổ Tay, Ngọc Mây | Có | `world.test.ts` (12) |
| 8 hàng xóm BOT có lý do, Sạp, Bảng Phú Bà | Có | `neighbors.ts` |

### 2.2 Phần nhìn và cảm giác (chụp màn hình bản build — `docs/research/anh/truoc-01.png`)
- **10 chậu đất nung giống hệt nhau xếp một hàng thẳng**, nhỏ (≈1/13 chiều ngang) → không có điểm nhấn, không thấy chậu là đồ sưu tầm.
- **Tầng mây trống**: không đồ treo, không đồ trang trí, không máy, không nhân vật/thú cưng. Tầng chỉ là nền.
- **Tên tầng bị ô xu/ngọc đè lên** (lỗi bố cục HUD).
- Chậu cấp cao chỉ khác **màu tô** (chờ đồ họa) → "cấp chậu thay đổi rõ hình dáng" chưa đạt.
- Cây có 5 giai đoạn, đung đưa theo họ cây, nảy khi chín — nhưng **không có mặt/tính cách**, không có hoạt ảnh nở hoa khi thu hoạch.
- Gieo hạt: mở bảng hạt → chọn → chạm/vuốt chậu. **Chưa có kéo-thả hạt từ khay xuống chậu.**
- Không có nhiệm vụ ngày, không thăm được vườn hàng xóm, không mở rộng tầng, không sao tầng, không bộ chậu.

## 3. Bảng đối chiếu

Cột: **KVTM có** · **PBTC đang có** · **PBTC còn thiếu** · **PBTC làm sai / quá đơn giản** · **Phải xây lại**

| Mảng | KVTM có | PBTC đang có | Còn thiếu | Sai / quá đơn giản | Xây lại? |
|---|---|---|---|---|---|
| Bố cục tầng | Kệ mây dày, 6 chậu to, đồ treo, trang trí 2 đầu, máy | Mây kéo giãn, 10 chậu nhỏ một hàng | Đồ treo, trang trí, máy | Chậu quá nhỏ, quá đều, tầng trống | **Có** — bố cục tầng mới |
| Số ô / mở rộng tầng | Ít chậu lúc đầu, mở thêm dần (suy từ ảnh + tài liệu) | Cố định 10 ô | Mở rộng ô có chi phí | Bắt đầu với 10 ô làm mất mục tiêu | **Có** — 6 ô, mở tới 10 |
| Sao tầng | 3 sao trên dây leo | Không | Nâng sao tầng tăng hiệu ứng tầng | — | Thêm mới |
| Mở tầng | Nút Mở tầng, cấp + vật phẩm | Chạm tầng mờ, cấp + xu, hoạt ảnh | Vật phẩm điều kiện | Ổn | Giữ, bổ sung |
| Chậu: chủng loại | Rất nhiều, theo bộ, có linh vật | 7 loại, có chỉ số | Bộ chậu + thưởng bộ | Ngoại hình chỉ tô màu | **Có** — bộ + bậc hình dáng |
| Chậu: nâng cấp | Vàng + sâu bọ + đá, tỉ lệ | Xu, chỉ số tăng | Nguyên liệu bọ | Chậu không đổi dáng theo cấp | Sửa: bọ làm nguyên liệu, bậc ngoại hình |
| Chậu: sưu tầm/so sánh | Có | Lò Gốm liệt kê chậu | Bảng so sánh cấp hiện tại ↔ cấp sau, bộ sưu tập | — | Thêm |
| Cây | Nhân hoá, mỗi loài khác dáng | 6 loài, 5 giai đoạn, ảnh riêng | Mặt/tính cách, hoạt ảnh nở | Hoạt ảnh nghèo | Cần **đồ họa mới** + hoạt ảnh |
| Gieo/chăm/thu | Chạm, kéo, vuốt | Chạm, vuốt thu hoạch | **Kéo-thả hạt** từ khay | Phải mở bảng mới gieo | **Có** — khay hạt kéo-thả |
| Bọ | Bám cây, chim giúp, nguyên liệu | Bám cây, chạm bắt, vào Rương | Dùng bọ nâng chậu | Bọ chỉ để bán | Sửa |
| Chế biến (máy) | Mỗi tầng một máy | Không | Máy chế biến | — | Giai đoạn 5 (cần đồ họa) |
| Đơn hàng | Khinh khí cầu, chim | Khinh khí cầu 6 đơn | — | Ổn | Giữ |
| Nhiệm vụ ngày | Có | Không | Nhiệm vụ ngày + phần thưởng | — | **Thêm** |
| Bạn bè / thăm vườn | Thăm, giúp, trao đổi | BOT ở Sạp, Bảng Phú Bà | **Thăm vườn BOT, giúp tưới/bắt bọ** | BOT không có vườn để nhìn | **Thêm** |
| Bảng xếp hạng | Có | Bảng Phú Bà (giả lập) | — | Ổn | Giữ |
| Trang trí | Nhiều, có hiệu ứng, thay áo vườn | Không | Toàn bộ | — | Giai đoạn 5 (cần đồ họa) |
| HUD | Phân vùng rõ 4 góc | Trên trái + cột trái + dưới phải | Nút Nhiệm vụ, Thăm vườn | **Tên tầng bị đè** | Sửa bố cục |
| Hướng dẫn người mới | Có | Gợi ý dạng chữ | Hướng dẫn từng bước có tay chỉ | Đơn giản | Giai đoạn 5 |

## 4. Xung đột cần ghi lại

1. **"Fantasy 2.5D Isometric" trong yêu cầu ↔ ảnh tham chiếu KVTM và quyết định trước (nhìn chính diện).** Ảnh KVTM là góc chính diện; toàn bộ đồ họa đã có (thân cây leo, tầng mây, 6 cây, chậu) vẽ chính diện. Đổi sang isometric = vẽ lại tất cả + viết lại lớp vẽ. **Chọn: chính diện có chiều sâu (2.5D chính diện)** — lớp trước/sau, đổ bóng, ánh sáng, đồ treo lơ lửng, mây trôi phía trước — giữ được cảm giác 2.5D mà không đập bỏ tài sản. Nếu chủ dự án vẫn muốn isometric thật, cần quyết định riêng vì chi phí đồ họa gấp nhiều lần.
2. **Đồ họa là nút thắt.** Tôi không tự tạo ảnh và không tải được ảnh từ Leonardo về máy làm việc; cây có mặt, bộ chậu theo bậc, đồ trang trí, máy đều cần ảnh mới do chủ dự án tải về. Phần mã làm trước, ảnh thay vào sau theo tên khung đã định — hệ thống không phụ thuộc ảnh.

## Nguồn
- Ảnh chụp màn hình KVTM chủ dự án gửi trong phiên.
- App Store: https://apps.apple.com/vn/app/id1588009371
- https://vietnamnet.vn/gioi-thieu-game-khu-vuon-tren-may-tren-zingme-i346005.html
- https://www.thegioididong.com/game-app/khu-vuon-tren-may-zingplay-xay-dung-khu-vuon-tren-nhung-tang-may-223277
- https://download.vn/cach-them-tang-may-va-nang-cap-chau-trong-khu-vuon-tren-may-18853
- https://mytour.vn/vi/blog/bai-viet/huong-dan-tham-gia-khu-vuon-tren-may-zingplay-tren-dien-thoai.html
