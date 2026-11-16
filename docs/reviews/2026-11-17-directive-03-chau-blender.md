# Chỉ thị số 03 của CTO — Đưa chậu Blender vào game (2026-11-17)

Nhánh: `art/blender-pots` (tách từ `feat/full-loop` @ 27159a0). Chủ dự án yêu cầu: **có kết quả trên game nhanh nhất**.

## CTO đã làm (có trong nhánh này)

| File | Nội dung |
|---|---|
| `assets/art/pots_phoenix.webp/.json` | 50 hình Chậu Phượng Hoàng, frame `pots/phoenix/<cấp>` (1–50) |
| `assets/art/pots_catalog.webp/.json` | 50 dòng chậu ở cấp 50, frame `pots/catalog/<id 2 số>/50` |
| `content/proposals/pots_blender.json` | **Đề xuất** 51 định nghĩa chậu theo đúng schema `pots.json` (số liệu cân bằng mặc định, chưa duyệt) |
| `tools/potgen/` | Toàn bộ xưởng chậu Blender: dựng, render, đóng atlas — tái tạo được mọi hình |
| `assets/ASSET_SOURCES.md` | Mục nguồn ảnh Blender |

Quy cách atlas giống `sprites.json`: `meta.scale = "2"`, mỗi frame có `anchor` = điểm đáy chậu.
Thân chậu đã chuẩn hóa bằng chậu đất nung (~168 px @2x). Cánh và hào quang **tràn ra ngoài ô** có chủ đích.
Thêm khóa riêng `soil` mỗi frame = khoảng cách (px atlas) từ anchor lên mặt đất trồng.

## Developer làm, theo thứ tự

1. **Nạp atlas** — `src/render/assets.ts`: thêm `pots_phoenix` và `pots_catalog` vào `Art.load()` như `sprites`/`scene`.
2. **Ảnh khi thiếu cấp** — `Art.pot()`: nếu không có `<sprite>/<level>`, dùng frame cùng sprite có cấp **lớn nhất ≤ level**; nếu không có frame nào ≤ level thì dùng frame thấp nhất của sprite đó (dòng catalog mới chỉ có cấp 50). Chỉ khi sprite không có frame nào mới dùng đất nung tô màu như hiện tại.
3. **Đặt cây đúng miệng chậu** — `slotView`: nếu frame có `soil`, đặt `plant.y = -soil / 2` (đổi px @2x → pt) thay cho `SLOT_GEOM.soilY`.
4. **Tràn ô** — chậu có cánh rộng hơn ô: hạ `zIndex` phần chậu dưới cây và bong bóng trạng thái; bảo đảm vùng chạm vẫn là ô của chính nó.
5. **Nội dung** — gộp `content/proposals/pots_blender.json` vào `content/base/pots.json` **sau khi** chạy báo cáo cân bằng. Nếu số liệu đề xuất làm vỡ kinh tế, chỉnh số và ghi lý do. Chủ dự án muốn thấy ngay trên game: được phép cho xuất hiện trong Lò Gốm/kho chậu ở bản thử trước, cân bằng ở bước sau.
6. Bản thử GitHub Pages như thường lệ, báo cáo kèm ảnh chụp: 1 tầng có Phượng Hoàng cấp 1, 20, 50 và 3 chậu catalog.

## Không làm

- Không sửa ảnh trong atlas bằng tay; muốn đổi hình thì báo CTO render lại.
- Không đổi tên frame.

## Tiêu chí nghiệm thu

- [ ] 100 frame mới nạp được, không lỗi `Thiếu hình`.
- [ ] Phượng Hoàng hiển thị đúng hình theo cấp 1→50; catalog hiển thị hình cấp 50 ở mọi cấp.
- [ ] Cây mọc đúng mặt đất trong miệng chậu ở cả chậu thấp (cấp 1) và chậu có đế mây (cấp ≥35).
- [ ] FPS ≥ 60 trên iPad Pro M2 với 2 tầng × 10 chậu cấp 50.
- [ ] Bộ kiểm thử hiện có vẫn đạt.

## Việc CTO làm tiếp (để developer biết trước)

Render tách lớp (thân / cánh trái / cánh phải / hào quang / linh vật) để chậu có chuyển động, món đặc trưng riêng cho từng chậu, bản ánh kim hiếm. Sẽ giao frame mới cùng quy cách tên, có thêm hậu tố lớp.
