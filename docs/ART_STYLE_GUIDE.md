# Phú Bà Trồng Cây — Art Style Guide

Bản gốc: https://claude.ai/artifact/CuXzracfwDvbLbQq8zGTHS · Ngày: 2026-11-16
Trạng thái: bản nháp, **chờ chủ dự án duyệt** (theo `GAME_ROADMAP.md` Giai đoạn 2). Trước khi duyệt, mọi tài nguyên là tạm.

## 1. Tầm nhìn

**"Vườn đồ chơi của một Phú Bà trên mây"**: mỗi đảo là một mô hình thu nhỏ được chăm chút đến từng chi tiết. Đẹp kiểu sang và sung túc (vàng kim, ngọc, lụa), nhưng vui tươi và hài hước, không phô trương.

Năm trụ cột:

1. **Mềm và tròn** — không góc nhọn cứng; cạnh vát bo, khối hơi phồng.
2. **Sung túc** — vật phẩm đầy đặn, mọng nước; thu hoạch cho cảm giác "giàu lên".
3. **Ánh sáng kể chuyện** — một nguồn nắng ấm, bóng mềm tím lam, viền sáng nhẹ, nhất quán.
4. **Chi tiết có thứ bậc** — hình dáng lớn đọc được ở cỡ nhỏ nhất.
5. **Sống** — thiết kế chừa sẵn chỗ cho chuyển động.

Tránh: pixel art, vector phẳng, viền đen dày, hiện thực quá mức, neon, và mọi hình gợi nhớ trực tiếp một game có sẵn.

## 2. Quy chuẩn isometric, tỉ lệ, ánh sáng

| Thông số | Giá trị |
| --- | --- |
| Phép chiếu | Isometric game 2:1, xoay 45°, nhìn xuống khoảng 30° |
| Ô chuẩn | 256 × 128 px bản gốc (@2x); hiển thị 128 × 64 điểm |
| Đơn vị chiều cao | 1 "tầng" = 96 px @2x |
| Điểm neo | Tâm đáy chân đế |
| Hướng mặt | Mặt chính quay về dưới–trái; nhân vật/vật nuôi 4 hướng chéo (2 vẽ, 2 lật gương) |
| Nắng chính | Trên–trái–sau (10 giờ, cao 50°), `#FFE7B8` |
| Ánh trời phụ | Từ trên, `#BFD9FF`, yếu |
| Viền sáng | Sau–phải, mảnh |
| Bóng trên vật | Mềm, tím lam, không đen; có bóng tiếp xúc |
| Bóng đổ xuống đất | Không vẽ vào sprite; engine vẽ, đổi theo giờ |
| Nền ảnh | Trong suốt (AI: nền trơn một màu) |

| Vật | Chân đế | Chiều cao |
| --- | --- | --- |
| Nhân vật người lớn | 0,5 × 0,5 ô | 1 tầng |
| Linh vật, vật nhỏ | 0,4 × 0,4 ô | 0,4–0,5 tầng |
| Vật nuôi lớn | 1 × 1 ô | 0,8 tầng |
| Cây trong chậu | 1 × 1 ô | 0,2 → 0,7 tầng theo giai đoạn |
| Cây lớn | 1 × 1 ô | 1,6 tầng |
| Tổ Linh Thú | 2 × 2 ô | 2 tầng |
| Đồ trang trí nhỏ | 1 × 1 ô | 0,3–1 tầng |

## 3. Hình khối & chất liệu

Phong cách **3D tô vẽ tay kiểu đồ chơi cao cấp** (stylized painterly 3D). Không viền đen; gỗ ấm bo tròn; đá như sỏi lớn; vải nếp to; **vàng kim** là chất liệu "chữ ký" Phú Bà; **ngọc** xanh trong; mây kem như kẹo bông; lá cụm to chuyển xanh vàng → xanh lam.

## 4. Bảng màu

| Màu | Mã | Dùng cho |
| --- | --- | --- |
| Vàng Kim | `#F2B830` | Xu, viền sang, logo, nút phụ |
| Xanh Ngọc | `#2FBF9F` | Ngọc Mây, nút chính |
| Hồng Đào | `#FF9E8A` | Má, hoa, mây chiều |
| Xanh Trời | `#8CCBFF` | Bầu trời, nước |
| Kem Sữa | `#FFF6E3` | Mây, nền bảng |
| Lá Non | `#8BD15A` | Cỏ, lá, thanh tiến trình |
| Nâu Đất | `#5B3A29` | Chữ, viền số, đất |
| Tím Bóng | `#6B5B9A` | Màu bóng |
| Đỏ Cảnh Báo | `#F2676B` | Xóa, hết hàng |

Màu chủ đạo của 10 tầng mây (tên theo `docs/GAMEPLAY_DESIGN.md` mục 3):

| Tầng | Tên | Màu chủ đạo |
| --- | --- | --- |
| 1 | Đồng Mây Ngọc | `#9FE07A` `#6CC6A0` `#FFE9F0` |
| 2 | Vườn Trà Sương Sớm | `#7FBF6A` `#CFE8D5` `#F4F1E6` |
| 3 | Ruộng Bậc Thang Hoàng Kim | `#F5C84C` `#D98E3B` `#8FB34A` |
| 4 | Hồ Sen Cầu Vồng | `#55C8F0` `#FF9EC4` `#FFE07A` |
| 5 | Rừng Nấm Sương Tím | `#7A5CC7` `#3E3A78` `#9EF0E0` |
| 6 | Thung Lũng Hoa Đăng | `#E8505B` `#FFB45C` `#FFF0C8` |
| 7 | Đảo Băng Kẹo | `#BDE8FF` `#FFC4E1` `#FFFFFF` |
| 8 | Vườn Thiên Văn | `#2E3A78` `#8C7BE0` `#FFE7A0` |
| 9 | Cung Trăng Ngọc | `#DDE6FF` `#9FD8C8` `#C9B8F0` |
| 10 | Đỉnh Phú Quý | `#F2B830` `#2FBF9F` `#FFF6E3` |

Khu vực không phải tầng (giai đoạn sau): Chợ Trời `#E8505B` `#F2B830` `#FFF6E3`.

Tài nguyên vẽ ở ánh sáng trưa; engine phủ ánh sáng ngày–đêm.

## 5. Nhân vật, linh vật, vật nuôi, thú cưng

- Nhân vật chibi 2,5 đầu, ghép bộ phận để thay thời trang; trang phục pha nét Việt (áo bà ba lụa, nón lá viền vàng) và "sang chảnh" hiện đại; Phú Bà hoặc Phú Ông.
- **Linh vật Xu Xu**: mèo mây kem, đuôi lọn mây, nơ cổ có đồng xu mầm cây; 6 biểu cảm.
- Vật nuôi (giai đoạn sau): Gà Bông, Bò Đốm Mây, Cừu Kẹo Bông, Heo Má Hồng, Ong Mật Ngọc, Thỏ Ngọc.
- Thú cưng: Cún Bông, Nhím Mầm, Sẻ Vàng.

## 6. Cây, chậu, tầng mây

- Cây: 5 giai đoạn (Hạt, Mầm, Lớn, Ra hoa/đậu trái, Chín) — phân biệt bằng hình dạng; vẽ tách khỏi chậu; mặt đất trong miệng chậu khô/ướt; trạng thái phụ: khát nước, có Bọ Mây.
- **Chậu**: 4 bậc ngoại hình theo cấp; màu độ hiếm ở viền miệng chậu: nâu đất, xanh lá, xanh ngọc, tím, vàng kim.
- **Tầng mây**: đảo nổi dải dài, hàng bệ chậu (4–8), mặt dưới mây bông, rễ, đèn treo; 5 bậc viền theo cấp tầng; cầu thang dây leo.

| Loại | Khung @2x | Ghi chú |
| --- | --- | --- |
| Chậu (mỗi bậc) | 256 × 256 | Neo tâm đáy; neo thứ hai ở miệng chậu |
| Cây (mỗi giai đoạn) | 256 × 320 | Neo gốc cây |
| Cây lớn | 384 × 512 | Tán lá tách lớp |
| Bọ Mây | 96 × 96 mỗi khung | 2–4 khung vỗ cánh |
| Linh Thú, thú cưng | 256 × 256 mỗi khung | Tách bộ phận |
| Nhân vật | 256 × 384 | Tách bộ phận |
| Tầng mây | chia mảnh 1024 × 1024 | |
| Biểu tượng vật phẩm | 256 × 256 | 3/4 từ trên |

## 7. Hoạt ảnh & hiệu ứng

Ảnh minh họa do AI/họa sĩ tạo; chuyển động do engine: shader gió (cỏ, lá, hoa), mây 3–4 lớp thị sai, nước cuộn, hoa nở 3 khung, ánh sáng ngày–đêm, hạt (tia nắng, đom đóm, cánh hoa), thu hoạch bay vào kho, pháo hoa lên cấp, hoạt ảnh xương 2D cho nhân vật. Có đàn hồi, không tuyến tính; vật chờ "thở" lệch pha.

## 8. Giao diện, chữ, logo

- "Kính mờ và vàng kim"; bo góc 24–32 điểm; nút xanh ngọc/vàng kim; biểu tượng là minh họa nhỏ, không icon phẳng.
- Bố cục iPad ngang: trên–trái ảnh đại diện + cấp + XP; giữa–trên xu, Ngọc Mây; trên–phải giờ, cài đặt; dưới–phải cụm nút chính; giao diện < 15% màn hình khi không mở bảng.
- Chữ (OFL, hỗ trợ tiếng Việt, nhúng sẵn): **Baloo 2** cho tiêu đề và số; **Nunito** cho nội dung (cỡ thân ≥ 16 pt theo `QUALITY_STANDARDS.md`).
- Logo: PHÚ BÀ vàng kim viền ngọc (dấu "Ú" là chiếc lá), TRỒNG CÂY xanh lá; đồng xu mầm cây; đám mây; Xu Xu ngồi trên chữ "BÀ". Chữ dựng bằng phông thật; AI chỉ vẽ phần tranh.

## 9. Quy trình tạo ảnh bằng AI

Quyết định của chủ dự án (2026-11-16, `PROJECT_RULES.md` 3.3): chỉ dùng công cụ **miễn phí**, không mua tài nguyên. Không dùng Midjourney (không có gói miễn phí).

**Công cụ chủ lực: Leonardo AI, gói miễn phí.** Toàn bộ ảnh của một giai đoạn tạo bằng một công cụ, một mô hình, một câu lệnh phong cách chung (bên dưới).

| Hạng mục | Gói miễn phí (tra cứu 16/11/2026 — kiểm lại trang giá chính thức trước mỗi đợt) |
| --- | --- |
| Hạn mức | 150 token mỗi ngày, đặt lại hằng ngày, không cộng dồn; mỗi ảnh tốn vài token tùy mô hình và cỡ |
| Riêng tư | Ảnh tạo ra là **công khai** trên thư viện cộng đồng của Leonardo |
| Quyền sử dụng | Quyền sở hữu thuộc Leonardo; người dùng được cấp quyền sử dụng không độc quyền. Gói trả phí mới được sở hữu ảnh |
| Hệ quả cho dự án | Đủ cho bản chơi thử và bản cá nhân. **Trước khi phát hành thương mại** phải rà lại điều khoản và tạo lại ảnh bằng gói có quyền sở hữu (việc này cần chủ dự án quyết định chi phí) |

Ghi nguồn từng ảnh (công cụ, mô hình, ngày, câu lệnh) vào `assets/ASSET_SOURCES.md`.

Developer không điều khiển được dịch vụ AI bên ngoài và không đưa khóa API vào kho; người làm ảnh dán câu lệnh, đính ảnh mỏ neo, gửi ảnh lại; developer xử lý phần còn lại. Trong lúc chờ, game dùng ảnh tạm trong `assets/_placeholder/`.

Bốn bước đồng nhất: ảnh mỏ neo; tiền tố phong cách cố định; tạo theo bộ dạng bảng; sửa bằng hậu kỳ.

```text
PHU BA STYLE — stylized painterly 3D game asset for a cozy premium fantasy farming game set on floating cloud islands. Soft, rounded, chunky shapes with generous bevelled edges, slightly puffy and toy-like, hand-painted texture detail. Warm golden key light from the upper left, soft lavender-blue shadows, subtle cool rim light from the back right, gentle ambient occlusion in crevices. Palette: jade green, warm gold, peach pink, sky blue, creamy white; saturated but soft, never neon. Isometric 2:1 game camera, viewed from about 30 degrees above, rotated 45 degrees, object facing lower-left. Single object, centered, fully visible with margin. No cast shadow on the ground, no ground plane. Transparent background (or flat plain #808080 grey if transparency is unavailable).
AVOID: text, letters, watermark, signature, frame, black outlines, pixel art, flat vector, photorealism, harsh specular plastic, multiple objects, cropped edges, perspective distortion.
```

## 10. Hậu kỳ & đóng gói

Nhận ảnh → tách nền → cắt bảng → chuẩn hóa cỡ và điểm neo → chuẩn hóa màu/ánh sáng → chuẩn bị chuyển động (mặt nạ gió, tách bộ phận) → đóng gói atlas WebP + file khung cho PixiJS → tờ duyệt. Ngân sách theo `QUALITY_STANDARDS.md`: tải lần đầu ≤ 60 MB (mục tiêu ≤ 30 MB), ảnh không lớn hơn 2× kích thước hiển thị.

## 11. Danh sách tài nguyên cho lát cắt giai đoạn 1

| Đợt | Nhóm | Nội dung |
| --- | --- | --- |
| 1 | Ảnh mỏ neo | Một tầng Đồng Mây Ngọc có 4 chậu, cây nhiều giai đoạn, Xu Xu |
| 2 | Tầng mây | Khối đảo tầng 1, 4 bệ chậu, nền trời |
| 3 | Chậu | Chậu Thường × 4 bậc ngoại hình |
| 4 | Cây | 6 bảng 5 giai đoạn + Bọ Mây |
| 5 | Biểu tượng | 6 nông sản, xu, XP, bình tưới, vợt |
| 6 | Giao diện | Khung bảng, nút, thanh XP, biểu tượng ứng dụng |

## 12. Kiểm duyệt chất lượng

- [ ] Đúng góc isometric 2:1, mặt chính dưới–trái
- [ ] Nắng trên–trái, bóng tím lam, không bóng đổ xuống đất
- [ ] Đúng cỡ, điểm neo đúng
- [ ] Màu trong bảng màu, không neon, không viền đen
- [ ] Không chữ, không chi tiết dị dạng
- [ ] Viền tách nền sạch
- [ ] Bóng dáng đọc được ở cỡ nhỏ nhất
- [ ] Không lạc tông cạnh ảnh mỏ neo
- [ ] Không gợi nhớ nhân vật, logo, vật phẩm của game/thương hiệu khác
