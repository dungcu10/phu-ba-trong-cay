# Phú Bà Trồng Cây — Đề xuất kiến trúc & lộ trình

Bản gốc: https://claude.ai/artifact/1RVMP5JorhpWbmJCao5T9g · Ngày: 2026-11-16
Thứ tự ưu tiên tài liệu: `PROJECT_RULES.md` → `QUALITY_STANDARDS.md` → `ACCEPTANCE_CHECKLIST.md` → `GAME_ROADMAP.md` → tài liệu này.

## 1. Tóm tắt

Phú Bà Trồng Cây là game nông trại trên mây cho **iPad**, cài như ứng dụng trên màn hình chính, chạy toàn màn hình và hoàn toàn offline, đồ họa 2.5D vẽ bằng GPU. Toàn bộ luật chơi nằm trong một **lõi mô phỏng** dùng chung cho người chơi và BOT. Không nạp tiền, không quảng cáo.

Nguyên tắc: thời gian tuyệt đối (lưu mốc, không lưu "còn bao lâu"); hướng dữ liệu (nội dung là JSON); mô phỏng tất định (số ngẫu nhiên có hạt giống); mỗi giai đoạn chạy được và có kiểm thử.

## 2. Công nghệ

Đã chốt: **web app cài lên màn hình chính iPad** (PWA, Service Worker), vẽ bằng **PixiJS v8 trên WebGPU** (tự lùi về WebGL2). Chủ dự án không cần Mac, không build, không tài khoản Apple.

- iPadOS 26: mọi trang thêm vào màn hình chính đều mở như ứng dụng riêng; Safari có WebGPU ([firt.dev](https://firt.dev/notes/pwa-ios/)).
- Dữ liệu web app trên màn hình chính không bị xoá sau 7 ngày như trang thường ([web.dev](https://web.dev/articles/storage-for-the-web)).
- Safari mặc định 60 khung hình/giây; 120Hz cần tắt cờ "Prefer Page Rendering Updates near 60fps" ([MacRumors](https://macrumors.com/how-to/enable-smoother-120hz-browsing-in-safari/)).

| Cách đưa game lên iPad | Chủ dự án phải làm gì | Kết luận |
| --- | --- | --- |
| Web app trên màn hình chính | Mở link trong Safari, Thêm vào MH chính — một lần | **Chọn** |
| App native qua TestFlight (Capacitor bọc chính mã nguồn) | Apple Developer 99 USD/năm | Tùy chọn về sau |
| Godot / Unity native | Cần Mac + Xcode | Không chọn |

Lưu ý quy tắc: PixiJS v8 lớn hơn 50 KB gzip → theo `PROJECT_RULES.md` mục 2 cần phê duyệt; chủ dự án đã chọn PixiJS ngày 16/11/2026, CTO cần xác nhận chính thức ở mục 4.1.

## 3. Kiến trúc tổng thể

Bốn lớp, đúng `PROJECT_RULES.md` 4.2:

1. **Config** — gói nội dung JSON (`content/base/*.json`): tầng, chậu, cây, bọ, kinh tế.
2. **State** — trạng thái game là dữ liệu thuần, tuần tự hóa thẳng ra JSON.
3. **Systems** — lõi mô phỏng TypeScript thuần, không phụ thuộc DOM/PixiJS; nhận lệnh, kiểm tra hợp lệ, áp dụng; đồng hồ và RNG được tiêm vào.
4. **Render/UI** — PixiJS + giao diện; chỉ đọc state và gửi lệnh.

Người chơi và BOT gửi lệnh vào cùng một chỗ. Lưu trữ: IndexedDB, 2 khe xoay vòng + checksum, `saveVersion` + migration, xuất/nhập file.

```
phu-ba-trong-cay/
  content/base/       gói nội dung JSON
  src/core/           rng, clock, types, content loader, game (bộ xử lý lệnh)
  src/systems/        growth, pots, economy (mỗi hệ thống một module)
  src/persistence/    serializer, migrations, save manager, IndexedDB store
  src/app/            vỏ ứng dụng trình duyệt: khởi động, vòng đời lưu, FPS dev
  src/render/         (giai đoạn 1) renderer PixiJS
  public/             index.html, manifest, service worker, icon
  assets/_placeholder/ hình tạm
  tests/              kiểm thử tự động
  docs/               tài liệu thiết kế
```

## 4. Hệ thống gameplay

Xem `docs/GAMEPLAY_DESIGN.md` (chậu + tầng mây). Lát cắt giai đoạn 0+1 theo chỉ thị CTO.

## 5. BOT offline (giai đoạn 4)

- 80–120 BOT mỗi hồ sơ, sinh từ hạt giống hồ sơ; tên kiểu biệt danh game Việt; phân bố cấp rộng; BOT gia nhập/bỏ game theo thời gian.
- Vector tính cách (chăm chỉ, hiệu quả, thương nhân, trang trí, xã giao, sưu tầm, cạnh tranh, nhịp sinh học).
- AI theo độ hữu ích: lịch phiên mỗi ngày, chấm điểm hành động theo mục tiêu × tính cách, chọn có trọng số; mục tiêu dài hạn.
- Hai mức mô phỏng: trừu tượng (khi không nhìn) và cụ thể (khi ghé thăm).
- Khi mở lại game: phát lại phiên của mọi BOT theo thứ tự thời gian; RNG lấy theo (hạt giống BOT, ngày, số phiên) nên kết quả không phụ thuộc số lần mở game; vắng > 30 ngày dùng mô hình thống kê.
- Có công cụ debug xem mục tiêu và lý do hành động (`QUALITY_STANDARDS.md` mục 5).

## 6. Lưu dữ liệu & thời gian offline

- Mỗi thao tác là một lệnh; lưu sau 1–2 giây (gom thao tác), ngay khi `visibilitychange`/`pagehide`, định kỳ 30 giây.
- Hai khe A/B có checksum; hỏng thì dùng khe còn lại; không bao giờ ghi đè save bằng dữ liệu mặc định khi đọc lỗi.
- `navigator.storage.persist()`.
- Xuất/nhập file sao lưu có kiểm tra hợp lệ; migration theo phiên bản.
- Thời gian: chỉ lưu mốc (`plantedAt`…); trạng thái = hàm của thời gian hiện tại. Chống lùi giờ: lưu mốc lớn nhất từng thấy, đồng hồ lùi → thời gian game đứng yên. Vặn giờ tới không chặn tuyệt đối được offline; giảm lợi bằng các giới hạn ở giai đoạn sau.

## 7. Kinh tế & cân bằng

Giá trị tham chiếu tự động: V(món) = ΣV(nguyên liệu) + k_t·thời gian(phút)^0,85 + k_c·cấp mở khóa. Bán cửa hàng ~0,6×V; đơn hàng 1,1–1,5×V. Xu và Ngọc Mây chỉ kiếm trong game. Cân bằng kiểm chứng bằng mô phỏng (BOT chơi thử nhiều ngày).

## 8. Hướng dữ liệu & cập nhật

ID có không gian tên (`base:`), không đổi; kiểu dữ liệu + kiểm tra lúc nạp; gói xếp lớp; sự kiện theo lịch; hành vi BOT cũng là dữ liệu; module tính năng; đa ngôn ngữ (tiếng Việt chính). Cập nhật qua Service Worker, không mất save.

## 9. Đồ họa, âm thanh, UI

Xem `docs/ART_STYLE_GUIDE.md`. Giao diện iPad ngang, ô bấm ≥ 44 pt, cử chỉ (chụm-phóng, kéo máy quay, kéo qua hàng chậu), giao diện chiếm < 15% màn hình khi không mở bảng. Âm thanh tổng hợp bằng Web Audio, chỉ bật sau chạm đầu tiên.

## 10. Kiểm thử

| Lớp | Nội dung | Công cụ |
| --- | --- | --- |
| Luật chơi | Gieo/thu hoạch, giá, nâng cấp, lên cấp, lệnh không hợp lệ | `node:test` trên lõi mô phỏng |
| Thời gian | Đồng hồ giả: 8 giờ, 3 ngày, 40 ngày; lùi/vặn giờ | Đồng hồ tiêm vào lõi |
| Lưu/khôi phục | Ghi→đọc giống hệt; file hỏng → khe dự phòng; migration | Bộ lưu trong bộ nhớ + IndexedDB thật |
| Trình duyệt | IndexedDB, Service Worker offline | Playwright + Chrome headless |
| Thiết bị | 9 bước kiểm thử khói `ACCEPTANCE_CHECKLIST.md` mục C | Safari iPad Pro M2 (cần chủ dự án hoặc thiết bị thật) |
