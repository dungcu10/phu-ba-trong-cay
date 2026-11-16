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
