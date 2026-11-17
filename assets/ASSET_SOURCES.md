# Nguồn gốc tài nguyên — Phú Bà Trồng Cây

Mọi tài nguyên trong game phải có dòng ở đây (`PROJECT_RULES.md` 3.3). Developer không tạo ảnh: chỉ hậu kỳ (tách nền, cắt, đóng gói) bằng `tools/process_art.py`.

## Ảnh minh họa — đợt 1 (tờ duyệt 01)

Công cụ: **Leonardo AI, gói miễn phí**, mô hình **Lucid Origin** (chế độ Auto Image), 1344×768 / 768×1344, ngày 16/11/2026. Người tạo: CTO (C3 do developer tạo theo đúng câu lệnh của CTO, tài khoản Leonardo miễn phí khác). Câu lệnh phong cách chung: "Premium fairy-tale mobile farming game asset, stylized painterly 3D illustration…" (xem `docs/ART_STYLE_GUIDE.md`).

Điều khoản gói miễn phí: ảnh công khai, Leonardo giữ quyền sở hữu, người dùng được cấp quyền sử dụng không độc quyền. **Phải rà lại và tạo lại bằng gói có quyền sở hữu trước khi phát hành thương mại.**

| Ảnh gốc (`assets/art-src/`) | Nội dung | Dùng trong game |
| --- | --- | --- |
| `A1_concept.jpg` | Ảnh mỏ neo: cây leo + tầng mây | Chỉ tham chiếu |
| `F2_bau-troi.jpg` | Bầu trời | `assets/art/sky.jpg`, nền biểu tượng ứng dụng |
| `F1_tang-may.jpg` | Tầng mây | `scene` → `floors/cloud-meadow` |
| `V1_than-cay-leo_a.jpg` | Thân cây leo (bản a) | `scene` → `trunk` |
| `V1_than-cay-leo_b.jpg` | Thân cây leo (bản b) | Chưa dùng, chờ CTO chọn |
| `P1-P3_chau-dat-nung.jpg` | Chậu Đất Nung 3 bậc | `sprites` → `pots/terracotta/1..5` |
| `C1_cuc-bong-gon.jpg` … `C6_hoa-dong-tien-vang.jpg` | 6 dải giai đoạn cây | `sprites` → `crops/<cây>/0..4`, `items/<cây>` |
| `C3_bac-ha-may_b.jpg` | Bạc Hà Mây (bản b) | Chưa dùng |
| `B1_bo-rua-may.jpg` | Bọ Rùa Mây 3 tư thế | `sprites` → `bugs/ladybird/0,1`, `items/ladybird` |

Ảnh dải cây có 5–6 hình; chỉ số hình được dùng cho từng giai đoạn ghi trong `CROPS` của `tools/process_art.py`.
Biểu tượng ứng dụng `public/icons/*.png`: ghép từ `F2_bau-troi.jpg` và Hoa Đồng Tiền Vàng chín (hậu kỳ).

## Phông chữ

| Phông | Gói npm | Giấy phép |
| --- | --- | --- |
| Baloo 2 | `@fontsource/baloo-2` | SIL Open Font License 1.1 |
| Nunito | `@fontsource/nunito` | SIL Open Font License 1.1 |

## Thư viện

| Thư viện | Giấy phép |
| --- | --- |
| PixiJS v8 (`pixi.js`) | MIT |

## Vẽ bằng code (hiệu ứng, được phép theo `PROJECT_RULES.md` 3.3)

Giọt nước báo khát, thanh tiến độ, hạt lấp lánh, khung gỗ/giấy da của giao diện (CSS). Biểu tượng đồng xu, ngôi sao XP trong giao diện là hình CSS tạm — **chờ đồ họa** đợt 5–6.

## Chậu dựng bằng Blender (CTO, 2026-11-17)

| File | Nội dung | Nguồn / giấy phép |
|---|---|---|
| `assets/art/pots_phoenix.webp/.json` | 50 cấp Chậu Phượng Hoàng (`pots/phoenix/<cấp>`) | Dựng thủ tục bằng Blender 5.2.3 LTS (Cycles, GPU) từ `tools/potgen`. Không dùng ảnh hay mô hình bên ngoài — tài sản tự tạo hoàn toàn, thuộc dự án. |
| `assets/art/pots_catalog.webp/.json` | 50 dòng chậu ở cấp 50 (`pots/catalog/<id>/50`) | Như trên. Thông số theo danh mục của chủ dự án. Chậu số 36 đổi tên thành "Neon Tương Lai" để tránh trùng tên một trò chơi đã đăng ký. |
| `assets/art/pots_signature.webp/.json` | 50 chậu đặc trưng ở cấp 50 (`pots/sig/<số>/50`), 5 nhóm: Đồ ăn, Linh vật, Thiên nhiên, Gốm Á Đông, Thần thoại | Dựng thủ tục bằng **bpy 5.3.0 (Blender dạng mô-đun Python), Cycles CPU**, cùng script `tools/potgen/blender/render_catalog.py` và cùng cảnh `studio_cream` (96 mẫu, 1024 px, OIDN) như hai atlas trên. Thông số chậu sinh từ `tools/potgen/tools/build_signature_all.py` → `tools/potgen/lines/signature_all.json`. Đóng gói bằng `tools/potgen/tools/pack_pots.py`, WebP chất lượng 90 giữ kênh alpha. Không dùng ảnh hay mô hình bên ngoài — tài sản tự tạo hoàn toàn, thuộc dự án. CTO chấp nhận dùng bpy 5.3 CPU thay cho Blender 5.2 CUDA (Review 03). |

Tái tạo: xem `tools/potgen/README.md` và `docs/reviews/2026-11-17-directive-03-chau-blender.md`.

## Bộ hình của chủ dự án `PhuBa_BoHinh_v1` (chỉ thị 10/11, 2026-11-18)

Hình gốc do chủ dự án vẽ bằng Gemini, lưu ở `tools/art/src/`. Thuộc dự án. Chỉ xử lý bằng các thao tác chỉ thị cho phép: tách nền, cắt, phóng to (Real-ESRGAN anime 6B ×4, Lanczos), chỉnh màu vùng mây ở gốc cây, độ bão hòa ngọn cây, sửa vết nối thân cây. Tái tạo: `tools/art/build.py` (`--only floors,vine,rings,chars,icons`).

| File | Nội dung | Nguồn |
|---|---|---|
| `assets/art/world10_floor_<t1–t4>_<L/R>@1x/@2x` | 4 tầng mây | `1_tang-may/tang*.png` |
| `assets/art/world10_vine*`, `world10_rings*` | Thân dây leo lát liền, gốc, ngọn, lá, nụ, tua, đèn lồng; vòng mây nắng/trăng | `2_cay-leo/*`, `1_tang-may/vong-may-om-cay_nang-va-trang.png` |
| `assets/art/world10_pedestals*` | 3 kiểu bệ đá × 2 | `3_be-chau/be-chau_3-kieu-x2.png` |
| `assets/art/world10_chars*` | 8 bọ, 4 chim (đậu/bay), Xu Xu 4 dáng | `4_nhan-vat/*` |
| `assets/art/world10_icons*` | 32 biểu tượng: hàng chế biến, Sợi Mây Kết, Giọt Sương Trời, Hạt Kê Mây, Năng Lượng Gió, 5 khoáng, 2 mồi, Mảnh Trứng Rồng, 5 cá, phao, 4 Huy Hiệu, Điểm sự kiện, Rương Mây Trôi, 4 Huy Chương Độ Cao. Tờ khoáng có chữ chú thích tiếng Anh: dải chữ được xóa trước khi cắt, không đưa chữ vào game. | `7_bieu-tuong/to1…to5` |
| `icon/crystal` (trong `world10_icons`) | Trang trí "pha lê": viên pha lê treo dưới tầng 1, cắt ra và bỏ phần mây sau dây treo, phóng to ×4 | `1_tang-may/tang1_dong-may-ngoc.png` |

**Biểu tượng tạm:** không còn. Mọi vật phẩm dùng hình đã duyệt (`art:<frame>` trong `materials.json`).

**CẦN HÌNH (còn thiếu):**
- Cành đậu cho chim ở mép phải tầng (hiện chim đậu thẳng trên mây).
- Bát hạt khi chim đói (hiện dùng chữ "z z" vẽ bằng code).
