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

Chuẩn giao diện chi tiết nằm ở `docs/DESIGN_SYSTEM.md` (số liệu trong `content/ui/design-tokens.json`); khi mâu thuẫn, `DESIGN_SYSTEM.md` thắng. Mục này chỉ tóm tắt hướng chung để tranh minh họa khớp với giao diện.

- **Phong cách cổ tích**, không phải ứng dụng quản lý: mỗi cửa sổ là một vật thể trong truyện (sạp gỗ, rương mây, bàn thợ gốm, cuộn giấy da), khung gỗ bo tròn, giấy da ấm, ruy băng, dây leo, đinh tán vàng. Không dùng kính mờ, thẻ trắng phẳng, đường kẻ xám.
- Biểu tượng là tranh minh họa nhỏ cùng phong cách vật phẩm (3/4 từ trên, nắng trên–trái), nhận ra được ở 32 pt; không emoji, không icon nét mảnh.
- Số liệu gắn với hình (đồng xu, giọt nước, ngôi sao), không để số trần.
- Bố cục iPad ngang: trên–trái huy hiệu cấp hình bông hoa + thanh XP dây leo; giữa–trên túi xu vải thêu; trên–phải mặt trời/mặt trăng chỉ giờ + bánh răng cài đặt; dưới–phải 3 nút chính xếp vòng cung (Hạt giống, Kho, Cửa hàng); giao diện thường trực < 15% màn hình.
- Chữ (OFL, hỗ trợ tiếng Việt, nhúng sẵn): **Baloo 2** cho tiêu đề, số, nút; **Nunito** cho nội dung (≥ 16 pt). Cỡ, đậm, màu chữ–nền theo `DESIGN_SYSTEM.md` mục 3–4.
- Logo: PHÚ BÀ vàng kim viền ngọc (dấu "Ú" là chiếc lá), TRỒNG CÂY xanh lá; đồng xu mầm cây; đám mây; Xu Xu ngồi trên chữ "BÀ". Chữ dựng bằng phông thật; AI chỉ vẽ phần tranh.
- Phép thử: che hết chữ, nhìn màn hình vẫn biết đây là game cổ tích về vườn trên mây.

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

## 11. Danh sách tài nguyên và câu lệnh cho lát cắt giai đoạn 1

| Đợt | Nhóm | Nội dung |
| --- | --- | --- |
| 1 | Ảnh mỏ neo | Một tầng Đồng Mây Ngọc có 4 chậu, cây nhiều giai đoạn |
| 2 | Tầng mây | Đảo tầng 1, bệ chậu, bộ mây trôi |
| 3 | Chậu | Chậu Đất Nung × 3 bậc ngoại hình (lát cắt chỉ có cấp 1–5) |
| 4 | Cây | 6 bảng 5 giai đoạn + Bọ Rùa Mây |
| 5 | Biểu tượng | 6 nông sản, xu, XP, bình tưới, vợt (câu lệnh viết sau) |
| 6 | Giao diện | Khung gỗ, giấy da, ruy băng, nút theo `DESIGN_SYSTEM.md` (câu lệnh viết sau) |

### 11.1. Cách dùng (người tạo ảnh)

- Công cụ: **Leonardo AI, gói miễn phí** (mục 9). Một mô hình cho cả đợt; ghi tên mô hình vào `assets/ASSET_SOURCES.md`.
- Mỗi câu lệnh = **tiền tố phong cách ở mục 9** + một dòng mô tả bên dưới. Dán nguyên văn tiền tố, không sửa.
- Đợt 1 tạo trước. Ảnh mỏ neo được duyệt thì dùng làm **ảnh tham chiếu** (Image Guidance / Style Reference) cho mọi ảnh đợt 2–4.
- Nền: Leonardo gói miễn phí không xuất nền trong suốt ổn định → luôn yêu cầu nền xám phẳng `#808080`. Developer tách nền ở bước hậu kỳ (mục 10).
- Với ảnh mỏ neo, dải 5 giai đoạn cây, bộ mây và 2 khung bọ: bỏ câu `Single object, centered, fully visible with margin.` khỏi tiền tố và bỏ `multiple objects` khỏi dòng AVOID (các ảnh này cố ý có nhiều vật).
- Mỗi ảnh tạo 4 bản, chọn 1. Gửi ảnh gốc PNG, **đặt đúng tên file** ở cột "Tên file" để code nạp được ngay. Thư mục: `assets/art/<nhóm>/`.
- Cỡ tạo: dùng cỡ ở cột "Cỡ tạo"; developer thu về "Khung @2x" ở mục 6.

### 11.2. Đợt 1 — Ảnh mỏ neo

| Tên file | Cỡ tạo | Mô tả (nối sau tiền tố) |
| --- | --- | --- |
| `anchor/anchor-floor1.png` | 1536 × 1024 | `Reference scene, not a single object: one long floating cloud island "jade cloud meadow" seen in isometric view, soft spring grass top, rounded earth edge with small roots, fluffy cream cloud underside, four round stone pot pedestals in a row along the island, each holding a terracotta pot with a plant at a different growth stage (seed mound, sprout, leafy plant, plant with ripe red fruits), one tiny red ladybird with cloud-white wings resting on a leaf, a few small peach flowers in the grass, hanging paper lantern at the island edge. Bright sky-blue background with soft clouds. Fairy-tale picture-book mood.` |

### 11.3. Đợt 2 — Tầng mây

| Tên file | Cỡ tạo | Mô tả |
| --- | --- | --- |
| `floors/cloud-meadow.png` | 1536 × 640 | `A long, wide floating island platform for a row of four pots, jade cloud meadow theme: flat soft spring-green grass top (#9FE07A, #6CC6A0), thick rounded earth edge with a few dangling roots and tiny pink blossoms (#FFE9F0), fluffy cream cloud mass underneath, two small hanging lanterns at the ends. Top surface left empty and flat (no pots, no plants). Wide horizontal composition, whole island visible.` |
| `floors/pedestal.png` | 1024 × 1024 | `A single small round stone pedestal for a flower pot, cream pebble stone with a thin moss ring and a tiny gold rivet, low and wide, empty top.` |
| `clouds/cloud-set.png` | 1536 × 640 | `Three separate fluffy cream-white cumulus clouds of different sizes (small, medium, large) arranged left to right with clear space between them, soft lavender shading underneath, cotton-candy texture.` |

### 11.4. Đợt 3 — Chậu Đất Nung (theo `DESIGN_SYSTEM.md` mục 7: mỗi bậc thêm vật thể, giữ nguyên bóng dáng bầu tròn)

| Tên file | Dùng cho cấp | Cỡ tạo | Mô tả |
| --- | --- | --- | --- |
| `pots/terracotta-1.png` | 1–2 | 1024 × 1024 | `A round-bellied terracotta flower pot, plain smooth warm orange-brown clay (#A9744F rim), wide rolled rim, dark moist soil visible inside the mouth, empty (no plant).` |
| `pots/terracotta-2.png` | 3–4 | 1024 × 1024 | `The same round-bellied terracotta flower pot, same shape and size, now with raised carved leaf-and-cloud relief around the belly and a glossy jade-glazed rim, soil inside, empty (no plant).` |
| `pots/terracotta-3.png` | 5 | 1024 × 1024 | `The same round-bellied terracotta flower pot with carved leaf-and-cloud relief and jade-glazed rim, now also with two small gold handles, a gold foot ring and three small inset jade gemstones, soil inside, empty (no plant).` |

### 11.5. Đợt 4 — Cây (mỗi giống một ảnh dải 5 giai đoạn) và Bọ Mây

Chung cho mọi dải cây: thêm câu sau vào cuối mô tả —
`Five growth stages of the same plant shown left to right in one horizontal strip, evenly spaced, all at the same scale and standing on the same baseline, each stage clearly different in shape: 1 seed in a small soil mound, 2 tiny sprout with two leaves, 3 young leafy plant, 4 budding or flowering plant, 5 fully ripe plant. Plants only, no pots.`

| Tên file | Cây | Cỡ tạo | Mô tả (bóng dáng và màu chủ đạo riêng, theo `DESIGN_SYSTEM.md` mục 9) |
| --- | --- | --- | --- |
| `crops/cotton-daisy.png` | Cúc Bông Gòn (Hoa) | 1536 × 512 | `A cotton daisy: slender stems, at ripe stage three fluffy round white daisies with soft cotton-ball petals and warm yellow centres.` |
| `crops/cherry-tomato.png` | Cà Chua Bi Ngọt (Quả) | 1536 × 512 | `A cherry tomato vine: bushy plant on a tiny bamboo stake, at ripe stage heavy clusters of glossy scarlet cherry tomatoes; stage 4 shows small yellow star flowers and green fruits.` |
| `crops/cloud-mint.png` | Bạc Hà Mây (Rau Thảo) | 1536 × 512 | `A cloud mint herb: upright stems with layered pairs of soft jade-blue serrated leaves, at ripe stage the top leaves are lush and give off small white cloud wisps.` |
| `crops/sky-carrot.png` | Cà Rốt Mây (Rau Thảo) | 1536 × 512 | `A sky carrot: tall feathery bright green fronds, at ripe stage a big round orange carrot shoulder pushes out of the soil with a tiny cloud puff beside it.` |
| `crops/cloud-strawberry.png` | Dâu Tây Mây (Quả) | 1536 × 512 | `A cloud strawberry plant: low rounded clump of trefoil leaves, at ripe stage plump pearly pink strawberries with cream seeds hanging over the leaves; stage 4 shows white blossoms.` |
| `crops/golden-gerbera.png` | Hoa Đồng Tiền Vàng (Hoa) | 1536 × 512 | `A golden gerbera: sturdy stems and broad leaves, at ripe stage two large radiant gold gerbera flowers with amber centres and a faint golden glow; stage 4 shows tight golden buds.` |
| `bugs/ladybird.png` | Bọ Rùa Mây | 1024 × 512 | `Two frames of the same tiny cute ladybird side by side: round glossy red shell with soft dark spots, small cloud-white fluffy wings, big shiny eyes; left frame wings up, right frame wings down. Same size and position in both frames.` |


### 11.6. Đợt 2 — ảnh cho phần mở rộng (quyết định 2026-11-16, `docs/decisions/2026-11-16-mo-rong-giai-doan-1.md`)

Cùng công cụ và cách làm như tờ duyệt 01: Leonardo, chế độ **Auto Image** (ra Lucid Origin, gói miễn phí), 16:9 cho dải ngang, 9:16 cho vật đứng. Mỗi câu lệnh = phần mở đầu chung bên dưới + mô tả riêng + phần kết chung.

Mở đầu chung: `Premium fairy-tale mobile farming game asset, stylized painterly 3D illustration, original design. Soft rounded chunky toy-like shapes, hand-painted detail, warm golden key light from upper left, soft lavender shadows, highly detailed, polished, charming. Front-facing side view.`
Kết chung: `Isolated on a flat plain solid light grey background, sharp focus everywhere, no depth of field. No text, no letters, no numbers, no labels, no watermark, no black outlines, not pixel art, not flat vector, not photorealistic.`

Ưu tiên theo thứ tự (hạn mức ~17 ảnh/ngày):

| # | Tên file (`assets/art-src/`) | Cỡ | Mô tả riêng |
|---|---|---|---|
| 1 | `V2_than-cay-leo_doan.jpg` | 9:16 | `A straight vertical segment of a giant ancient climbing beanstalk trunk, braided green vines twisting around it, a few big heart-shaped leaves and small golden lanterns, the top and bottom edges cut flat horizontally so the segment can repeat seamlessly when stacked. No roots, no top foliage.` |
| 2 | `F3_tang-may_tra.jpg` | 16:9 | `A long floating cloud shelf for a row of pots, misty tea-garden theme: soft white cloud base with pale green tea bushes and dew drops along its rim, small bamboo lanterns hanging underneath. Flat top, empty, wide horizontal.` |
| 3 | `F4_tang-may_hoang-kim.jpg` | 16:9 | `A long floating cloud shelf for a row of pots, golden rice-terrace theme: cloud base with tiny golden terraced fields along its rim, warm amber glow, small brass lanterns hanging underneath. Flat top, empty, wide horizontal.` |
| 4 | `P4-P6_chau-hiem.jpg` | 16:9 | `Three different flower pots side by side, each with a clearly different silhouette and dark soil inside, empty: (1) a tall-necked white-and-blue porcelain pot with cloud patterns, (2) a bronze tripod cauldron pot with three curled feet and green patina, (3) a jade-green pot shaped like a blooming lotus.` |
| 5 | `P7-P9_chau-quy.jpg` | 16:9 | `Three different luxurious flower pots side by side, each with a clearly different silhouette and dark soil inside, empty: (1) a carved rosewood pot with gold inlay, (2) a fluffy cloud-shaped pot made of soft white cloud with a pearl rim, (3) a golden treasure pot with jade gems and coins around its base.` |
| 6 | `O1_khinh-khi-cau.jpg` | 9:16 | `A cute hot-air balloon delivering goods: peach-and-cream striped balloon with golden ropes, a woven wicker basket hanging below holding small wooden crates of fruit and flowers, a tiny pennant flag.` |
| 7 | `O2_bang-don-hang.jpg` | 16:9 | `A wooden order board on two posts with a small tiled roof, six empty parchment notes pinned in two rows with little brass pins, vines and tiny flowers on the posts.` |
| 8 | `G1_ruong-may.jpg` | 16:9 | `Three items side by side: (1) a small wooden treasure chest with gold trim wrapped in a little cloud, closed, (2) the same chest open with golden light and coins spilling out, (3) a single shining jade-green gem shaped like a cloud.` |
| 9 | `G2_xu-ngoc-sao.jpg` | 16:9 | `Three game icons side by side: (1) a thick gold coin with a tiny sprout embossed in the middle, (2) a faceted jade-green gem, (3) a plump soft blue star.` |
| 10 | `N1-N4_hang-xom.jpg` | 16:9 | `Four chibi fairy-tale villager characters standing in a row, 2.5 heads tall, each clearly different: (1) a cheerful plump auntie in a silk ao ba ba with a conical hat trimmed in gold, (2) a young gardener boy with a straw hat and a watering can, (3) an elegant rich lady with pearls and a parasol, (4) a grandpa with a white beard holding a bamboo basket. Front view, full body.` |
| 11 | `N5-N8_hang-xom.jpg` | 16:9 | `Four more chibi fairy-tale villager characters standing in a row, 2.5 heads tall, each clearly different: (1) a little girl with twin buns holding a flower, (2) a merchant uncle with a round belly and an abacus, (3) a shy bookish young woman with round glasses, (4) a sporty auntie in a tracksuit with a towel. Front view, full body.` |
| 12 | `M1_bien-di.jpg` | 16:9 | `Three magical fruit variations side by side: (1) a ripe tomato made of shining gold, (2) a ripe strawberry made of translucent green jade, (3) a ripe flower glowing with soft rainbow light and sparkles.` |

Tầng mây theo tầng có thể tạm dùng `F1_tang-may.jpg` đổi màu bằng code cho đến khi có ảnh 2–3. Biến Dị có thể tạm dùng ánh sáng phủ màu bằng code cho đến khi có ảnh 12.

### 11.7. Đợt 3 — tái thiết kế v2 (`docs/REDESIGN_V2.md`)

Mục tiêu: chậu là **đồ sưu tầm** và cây có **tính cách**, đủ để bố cục 6 chậu to mỗi tầng trông như game thương mại. Học tinh thần sưu tầm/nhân hoá của thể loại, **không** chép hình chậu linh vật, đầu lân, cá chép hay nhân vật nào của Khu Vườn Trên Mây. Nhìn chính diện, phần phông giữ như §11.1. Ưu tiên theo thứ tự (~16 ảnh/ngày):

| # | Tên file (`assets/art-src/`) | Cỡ | Mô tả riêng |
|---|---|---|---|
| 1 | `C1v2_cuc-bong-gon_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic cotton daisy in a row, left to right: a tiny seed sprout with two dot eyes, a small sprout with a sleepy smile, a leafy young plant with rosy cheeks, a bud with a curious face, a full white fluffy daisy whose golden center is a happy smiling face. Each plant stands alone with no pot, base flat at the bottom, same scale.` |
| 2 | `C2v2_ca-chua-bi_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic cherry tomato vine in a row: seed sprout with dot eyes, small sprout, bushy young plant, plant with green tomatoes that have shy faces, plant heavy with ripe red cherry tomatoes each with a cheeky grin and rosy cheeks. No pot, flat base, same scale.` |
| 3 | `C3v2_bac-ha-may_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic cloud mint herb: sprout with dot eyes, small sprout, leafy clump, tall clump with tiny lilac flower spikes and a calm smiling face among the leaves, lush full mint bush with a serene face and little cloud puffs floating around. No pot, flat base, same scale.` |
| 4 | `C4v2_ca-rot-may_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic sky carrot: sprout with dot eyes, feathery sprout, bushy greens, greens with the orange carrot top peeking out with wide curious eyes, a whole plump carrot half out of the ground waving its leafy hair with a proud grin. No pot, flat base, same scale.` |
| 5 | `C5v2_dau-tay-may_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic cloud strawberry plant: sprout with dot eyes, small sprout, leafy rosette, rosette with white blossoms and green berries with sleepy faces, rosette with big ripe red strawberries each with a sweet smile and sparkle. No pot, flat base, same scale.` |
| 6 | `C6v2_dong-tien-vang_mat.jpg` | 16:9 | `Five growth stages of a cute anthropomorphic golden gerbera: sprout with dot eyes, small sprout, leafy plant, tall stem with a closed golden bud winking, a radiant golden gerbera whose center is a joyful face with a tiny crown of light. No pot, flat base, same scale.` |
| 7 | `P10_bo-gom-su_3bac.jpg` | 16:9 | `The same porcelain flower pot shown in three upgrade tiers side by side, same silhouette, empty with dark soil: (1) plain white-and-blue porcelain with cloud pattern, (2) the same pot with gold rim, gold handles and a small jade medallion, (3) the same pot made luxurious with gilded phoenix-tail relief, glowing jade inlays and a soft halo.` |
| 8 | `P11_sen-ngoc_3bac.jpg` | 16:9 | `The same jade lotus flower pot shown in three upgrade tiers side by side, same silhouette, empty with dark soil: (1) simple green jade lotus pot, (2) with gold-edged petals and pearl beads, (3) with glowing translucent petals, golden stamens and floating light motes.` |
| 9 | `P12_dinh-dong_3bac.jpg` | 16:9 | `The same bronze tripod cauldron pot in three upgrade tiers side by side, same silhouette, empty with dark soil: (1) bronze with green patina, (2) polished bronze with cloud-scroll engravings and gold feet, (3) gleaming gold-bronze with jade dragon-scale relief and a warm glow.` |
| 10 | `P13_hong-moc_3bac.jpg` | 16:9 | `The same carved rosewood pot in three upgrade tiers side by side, same silhouette, empty with dark soil: (1) plain carved rosewood, (2) with gold inlay vines and brass corners, (3) with mother-of-pearl flowers, gold filigree and a soft glow.` |
| 11 | `P14_may-bong-hu-vang.jpg` | 16:9 | `Two pots side by side, each in two tiers (four pots total), empty with dark soil: a fluffy cloud-shaped pot with a pearl rim (plain, then with rainbow trim and floating stars), and a golden treasure pot with jade gems (plain, then overflowing with glowing coins and a jade crest).` |
| 12 | `D1_den-long-treo.jpg` | 16:9 | `Five hanging decorations side by side, each hanging from a short vine string: a round silk lantern with tassel, a string of paper cranes, a bamboo wind chime, a little birdcage with a sleeping bird, a garland of tiny flowers. Front view.` |
| 13 | `D2_trang-tri-dung.jpg` | 16:9 | `Four standing garden decorations for the ends of a cloud shelf, side by side: a stone lantern with moss, a small wooden torii-like arch wrapped in flowers (no text), a koi-free lotus water basin, a cozy mushroom house with a round door. Front view, flat base.` |
| 14 | `D3_may-che-bien.jpg` | 16:9 | `Three cute fairy-tale processing machines side by side, each sits on a small wooden platform: a copper juice press with a fruit funnel, a wooden drying rack with a tiny windmill, a glass perfume still with bubbling flasks. Front view, flat base.` |
| 15 | `B2_chim-tro-giup.jpg` | 16:9 | `A small plump sky-blue songbird helper in three poses side by side: perched, flying with a tiny ladybug in its beak, hopping happily. Front view.` |

Dùng `tools/process_art.py` như cũ: ảnh 1–6 thay thẳng khung `crops/<id>/<stage>` (mã không đổi); ảnh 7–11 cắt thành `pots/<id>/<bậc>` — khi có ảnh, `Art.pot()` dùng ảnh thật thay hiệu ứng tô; ảnh 12–15 chờ hệ trang trí và máy chế biến (giai đoạn 5).

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
