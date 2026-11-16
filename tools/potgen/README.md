# potgen — Xưởng chậu 3D của PHÚ BÀ TRỒNG CÂY

Tạo ảnh chậu 2.5D cho game bằng Blender, hoàn toàn tự động. Chủ dự án không cần mở Blender.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `blender/potlib.py` | Thư viện dựng chậu: thân tiện tròn, viền, lông vũ, đá quý, hoa văn vàng, cánh, đuôi, mào, bệ mây, hào quang, tia lửa; vật liệu; camera và ánh sáng chuẩn |
| `blender/render_line.py` | Render một dòng chậu → PNG nền trong suốt, ảnh so sánh, manifest PixiJS |
| `style/studio.json` | Cảnh chuẩn dùng chung: camera, ánh sáng, khung hình, độ phân giải. Mọi dòng chậu dùng chung để đồng nhất |
| `lines/<dòng>.json` | Thiết kế một dòng chậu: dáng thân, vật liệu, 10 mốc tiến hóa và thay đổi nhỏ giữa các mốc |
| `out/<dòng>/` | Kết quả: `master/` (1024px), `game/` (512px), `preview/`, `manifest.json`, `status.json` |

## Chạy

```
blender -b --factory-startup -P blender/render_line.py -- --line lines/phuong_hoang.json --levels milestones
blender -b --factory-startup -P blender/render_line.py -- --line lines/phuong_hoang.json --levels 1-50
```

## Thêm một dòng chậu mới

Sao chép `lines/phuong_hoang.json`, đổi `id`, `name`, vật liệu, hồ sơ dáng thân và danh sách bộ phận của từng mốc. Không cần sửa code.

Mỗi tham số số học có thể viết `{"from": a, "to": b}` để thay đổi dần giữa hai mốc. Mỗi bộ phận có thể có `"min_p": 0.5` để chỉ xuất hiện từ nửa sau chặng.

## Đưa vào game

Chép `out/<dòng>/game/*.png` vào `assets/pots/<dòng>/` của game, và `manifest.json` vào `content/art/pots/<dòng>.json`.
`manifest.pixi.bundles` dùng trực tiếp với `Assets.init({ manifest })` của PixiJS. `frame.anchor` là điểm đáy chậu, đặt làm `sprite.anchor`.

Công cụ này **không đụng tới** dữ liệu game (`content/base/`), gameplay hay file lưu.
