# Báo cáo chỉ thị CTO số 03 — Chậu Blender vào game

Ngày 2026-11-17 · nhánh `feat/full-loop` @ ed6d29b · bản thử GitHub Pages: gh-pages 8a744bc ("Bản thử từ ed6d29b")

## Đã làm

| Bước | Kết quả | Ở đâu |
|---|---|---|
| Gộp `art/blender-pots` | Không xung đột (merge commit) | — |
| 1. Nạp atlas | `pots_phoenix`, `pots_catalog` nạp cùng `sprites`/`scene`; 100 khung, không lỗi `Thiếu hình`. Biểu tượng HTML (Lò Gốm, kho chậu) tự tìm khung ở mọi atlas | `src/render/assets.ts`, `src/ui/dom.ts` |
| 2. Ảnh khi thiếu cấp | Khung cấp lớn nhất ≤ cấp hiện tại; không có thì khung thấp nhất (catalog: cấp 50 ở mọi cấp); không có khung nào mới dùng đất nung tô màu. Dòng chậu có `looks` (Đất Nung, Sứ, Đỉnh Đồng, Sen Ngọc) vẫn ưu tiên `looks` | `spriteLevelFrame`, `potFrame` |
| 3. Cây đúng miệng chậu | `plant.y = −soil/2` theo khóa `soil` của khung; bong bóng và Bọ Mây dời theo | `src/render/slotView.ts` |
| 4. Tràn ô | Thân chậu, bóng, hào quang của cả tầng nằm ở một lớp dưới mọi cây và bong bóng; vùng chạm vẫn là ô của chính nó | `SlotView.back`, `scene.buildFloor` |
| 5. Nội dung | 51 định nghĩa từ `content/proposals/pots_blender.json` gộp vào `pots.json` nguyên số liệu đề xuất; hiện trong Lò Gốm | `content/base/pots.json` |
| 6. Bản thử | Đã đẩy; Pages phục vụ bản ed6d29b, có đủ 2 file webp | ảnh `pages-ban-moi-cho-cap-nhat.jpg` |

Sửa thêm khi kiểm thử: cửa sổ có thể cao hơn màn hình và không cuộn được (lỗi cũ, lộ ra với cửa sổ chậu mới) — nay mọi cửa sổ giới hạn theo màn hình, thân cửa sổ cuộn.

## Báo cáo cân bằng (chạy trước khi gộp, theo bước 5)

Điểm sức mạnh (công thức trong `docs/POT_BALANCE.md`):

| Dòng | Cấp 1 | Cấp 50 | Tổng xu 1→50 |
|---|---|---|---|
| Chậu Đất Nung (thường, đã có) | 0,03 | **0,83** | 386.000 |
| Phượng Hoàng (huyền thoại, 30.000 xu) | 0,23 | 0,45 | 1,71 triệu |
| Catalog hiếm/sử thi (5.000 xu) | 0,11–0,16 | 0,20–0,32 | 0,86 triệu |
| Catalog huyền thoại (25.000 xu) | 0,11–0,16 | 0,20–0,32 | 2,14 triệu |

- **Không vỡ kinh tế:** chỉ số thấp, tổng thưởng có trần (`bonusCaps`), chi phí cao là chỗ rút xu.
- **Trái nguyên tắc POT_SYSTEM 4:** chậu huyền thoại cấp 50 yếu hơn chậu thường cấp 50; chậu đắt chưa có kỹ năng. **Giữ nguyên cho bản thử theo chỉ thị**, sửa ở bước cân bằng (đề xuất: chuyển 51 dòng sang `growth` + `skills` như 3 dòng mẫu).

## Tiêu chí nghiệm thu

- [x] 100 khung mới nạp được, không lỗi `Thiếu hình` (bài trình duyệt 7/7, không lỗi console).
- [x] Phượng Hoàng đổi hình theo cấp (ảnh: cấp 1, 20, 35, 50); catalog hiện hình cấp 50 ở cấp 1 (ảnh: chậu 17 cấp 1).
- [x] Cây mọc đúng mặt đất ở chậu thấp (Phượng Hoàng cấp 1) và chậu đế mây (cấp 35, 50) — xem `tang-phuong-hoang-catalog.jpg`.
- [ ] **FPS ≥ 60 trên iPad Pro M2 với 2 tầng × 10 chậu cấp 50: chưa đo được.** Máy làm việc dùng Chrome giả lập phần mềm (10 FPS, không có giá trị). Trên Chrome máy chủ dự án (GPU thật), bản trước chạy 63 FPS. Cần chủ dự án mở `?dev=1`, gõ `__pbtc.demo('blender')` trong console (hoặc nhờ developer thêm nút) và đọc FPS ở góc dưới.
- [x] Bộ kiểm thử hiện có vẫn đạt: 92/92 lõi, 7/7 trình duyệt.

## Ảnh (`docs/reports/chau-blender/`)
- `tang-phuong-hoang-catalog.jpg` — tầng 1: Phượng Hoàng cấp 1, 20, 35, 50; catalog 01 (cấp 50), 17 (cấp 1 → hình cấp 50), 33, 02, 50; Đất Nung cấp 1 để so sánh; tất cả đã gieo cây.
- `tang-2-catalog-cap50.jpg` — tầng 2: 10 chậu catalog cấp 50.
- `lo-gom-51-chau.jpg` — Lò Gốm có các dòng mới.
- `pages-ban-moi-cho-cap-nhat.jpg` — trang GitHub Pages thật trên Chrome chủ dự án: bản mới đã tải, đang chờ bấm "Cập nhật". Developer **không bấm** vì sẽ chuyển bản lưu thật của chủ dự án lên save 8.

Ảnh tầng chụp bằng Chrome trên máy làm việc, từ đúng bản build ed6d29b, bằng kịch bản `__pbtc.demo('blender')` (chỉ có ở `?dev=1`).
