# PROJECT_RULES.md — PHÚ BÀ TRỒNG CÂY

> Văn bản gốc của dự án. Mọi Claude thực thi (developer) phải đọc file này **trước mỗi phiên làm việc**.
> Khi có mâu thuẫn giữa các tài liệu, thứ tự ưu tiên là:
> `PROJECT_RULES.md` → `QUALITY_STANDARDS.md` → `ACCEPTANCE_CHECKLIST.md` → `GAME_ROADMAP.md` → chỉ dẫn trong phiên làm việc.

Phiên bản: 1.0 · Ngày ban hành: 2026-11-16 · Chủ dự án: Dũng · CTO/Game Director: Claude (giám sát)

---

## 1. Định nghĩa sản phẩm

**Phú Bà Trồng Cây** là game nông trại trên mây (sky farm) dành cho iPad, chơi offline hoàn toàn.

| Hạng mục | Định hướng |
|---|---|
| Thể loại | Nông trại mô phỏng + quản lý kinh tế + trang trí đảo mây |
| Nền tảng mục tiêu | iPad Pro M2, Safari iPadOS (bản mới nhất và bản trước đó) |
| Hình thức phân phối | Web app cài lên màn hình chính (PWA), chạy offline 100% sau lần tải đầu |
| Hướng màn hình | Ngang (landscape) là chính; dọc phải không vỡ giao diện |
| Điều khiển | Cảm ứng là chính (chạm, giữ, kéo, chụm-phóng). Apple Pencil và bàn phím là phụ |
| Kết nối mạng | Không bắt buộc. Không có tính năng nào được phép chặn người chơi khi mất mạng |
| Dự án liên quan | **KHÔNG liên quan đến app TPTV.** Không dùng chung code, tài nguyên, dữ liệu hay tài khoản |

### Trụ cột trải nghiệm (Design Pillars)

1. **Đẹp và thư giãn** — mỗi màn hình phải đủ đẹp để chụp lại. Cảm giác nhẹ nhàng, ấm áp, sang trọng ("phú bà").
2. **Có chiều sâu** — người chơi luôn có quyết định đáng giá: trồng gì, bán khi nào, mở rộng đảo nào, đầu tư vào đâu.
3. **Thế giới sống** — BOT (cư dân, khách hàng, đối thủ, người giúp việc) có mục tiêu và hành vi thật, không phải hoạt cảnh trang trí.
4. **Tôn trọng người chơi** — không ép thời gian chờ vô lý, không dark pattern, không mất dữ liệu.

## 2. Vai trò và quyền hạn

| Vai trò | Người | Quyền hạn |
|---|---|---|
| Chủ dự án | Dũng | Quyết định chiến lược, phạm vi, tên gọi, phong cách nghệ thuật chủ đạo; duyệt cột mốc; duyệt phát hành |
| CTO / Game Director / QA Lead | Claude giám sát | Đặt tiêu chuẩn, phản biện, nghiệm thu hoặc từ chối nghiệm thu, yêu cầu dừng tính năng mới, yêu cầu sửa/tái cấu trúc |
| Developer | Claude Code thực thi | Lập trình, kiểm thử, ghi CHANGELOG, báo cáo trung thực |

**Những việc developer KHÔNG được tự làm khi chưa được phê duyệt:**
- Xóa dữ liệu người chơi, xóa save, đổi định dạng save mà không có migration.
- Thay đổi kiến trúc lớn (đổi engine/framework, đổi cách lưu trữ, tách/gộp module lõi).
- Thêm thư viện bên thứ ba > 50 KB (gzip) hoặc thư viện cần mạng.
- Triển khai lên bản chính (nhánh `main` / bản người chơi đang dùng).
- Đổi tên game, phong cách nghệ thuật chủ đạo, hoặc bỏ một tính năng đã có trong roadmap.

## 3. Quy tắc làm việc cho developer

### 3.1. Trước khi code
- Đọc `GAME_ROADMAP.md` để biết đang ở giai đoạn nào. **Không làm tính năng của giai đoạn sau** khi giai đoạn hiện tại chưa được nghiệm thu.
- Nếu yêu cầu mơ hồ, ghi rõ cách hiểu đã chọn trong báo cáo thay vì tự mở rộng phạm vi.

### 3.2. Trong khi code
- Một thay đổi = một mục đích. Không gộp sửa lỗi, refactor và tính năng mới trong cùng một lần giao.
- Sửa đúng module có vấn đề. **Không viết lại toàn bộ hệ thống** để sửa một lỗi cục bộ.
- Không để lại `TODO`, `console.log` debug, code chết, hoặc tính năng "giả" (nút bấm không có tác dụng, số liệu cứng thay cho logic thật).
- Mọi số liệu cân bằng game (giá, thời gian, tỷ lệ, phần thưởng) đặt trong file cấu hình dữ liệu, không rải rác trong logic.

### 3.3. Tài nguyên đồ họa
- Placeholder **được phép** trong lúc phát triển nhưng phải đặt trong thư mục `assets/_placeholder/` hoặc có hậu tố `_placeholder`.
- Placeholder **không bao giờ** được tính là hoàn thành. Một tính năng còn dùng placeholder chỉ được đánh dấu "chức năng xong — chờ đồ họa".
- Mọi tài nguyên phải ghi rõ nguồn gốc và giấy phép trong `assets/ASSET_SOURCES.md`. Không dùng tài nguyên có bản quyền, nhân vật/thương hiệu của người khác.

### 3.4. Sau khi code — báo cáo bắt buộc
Mỗi lần giao việc xong, developer phải báo cáo theo mẫu:

```
## Báo cáo giao việc — [tên nhiệm vụ]
- Đã làm: ...
- File đã thay đổi: ...
- Cách kiểm thử đã chạy (lệnh + kết quả thực tế): ...
- Bằng chứng: ảnh chụp / số FPS / log test
- Những gì CHƯA làm hoặc làm chưa tới: ...
- Rủi ro ảnh hưởng chức năng cũ: ...
- Đã cập nhật CHANGELOG.md: có / không
```

**Báo cáo không trung thực (nói đã xong nhưng chưa chạy thử, nói đã test nhưng không có bằng chứng) là vi phạm nghiêm trọng nhất của dự án.** Nói "chưa xong" luôn tốt hơn nói "xong" sai sự thật.

## 4. Quy tắc kỹ thuật cốt lõi

> Ngăn xếp công nghệ cụ thể được ghi tại mục 4.1 sau khi CTO rà soát repository hiện có. Các nguyên tắc dưới đây áp dụng bất kể công nghệ.

### 4.1. Ngăn xếp công nghệ
- Trạng thái: **chờ CTO rà soát repository và xác nhận.** Developer điền công nghệ đang dùng vào đây; CTO phê duyệt hoặc yêu cầu thay đổi.
- Định hướng mặc định: chạy trên Safari iPadOS, render bằng Canvas/WebGL, lưu bằng IndexedDB, offline bằng Service Worker.

### 4.2. Kiến trúc
- Tách rõ 4 lớp: **Dữ liệu cấu hình** (config) · **Trạng thái game** (state) · **Logic mô phỏng** (systems) · **Hiển thị** (render/UI).
- Logic mô phỏng không được phụ thuộc vào lớp hiển thị. Phải chạy được logic (ví dụ tua nhanh 8 giờ offline) mà không cần vẽ.
- Thời gian game dựa trên đồng hồ thực có kiểm soát (chống chỉnh giờ hệ thống gây lỗi), không dựa trên số khung hình.
- Không dùng biến toàn cục để chia sẻ trạng thái giữa các module.

### 4.3. Dữ liệu offline
- Save tự động khi có thay đổi quan trọng và khi ứng dụng chuyển nền (`visibilitychange` / `pagehide`). Không chỉ dựa vào `beforeunload` (không tin cậy trên iOS).
- Save có số phiên bản (`saveVersion`) và hàm migration cho từng lần đổi định dạng.
- Giữ ít nhất 2 bản save xoay vòng; nếu bản mới hỏng phải khôi phục được bản trước.
- Có chức năng xuất/nhập save thủ công (sao lưu).
- Không bao giờ ghi đè save người chơi bằng dữ liệu mặc định khi đọc lỗi.

### 4.4. Git
- Nhánh `main` = bản ổn định đã nghiệm thu. Làm việc trên nhánh `feat/...`, `fix/...`.
- Commit message rõ nghĩa, tiếng Việt hoặc tiếng Anh, một commit một ý.
- Không commit file build, file tạm, khóa bí mật.

## 5. Quy tắc dừng (Stop Rules)

CTO sẽ yêu cầu **dừng phát triển tính năng mới** khi xảy ra bất kỳ điều nào:
- Có lỗi mức **P0** (mất save, crash, không vào được game, không chạy offline).
- FPS trung bình trên iPad Pro M2 giảm dưới ngưỡng tại `QUALITY_STANDARDS.md`.
- Có từ 3 lỗi **P1** trở lên chưa sửa.
- Một tính năng đã nghiệm thu bị hỏng do thay đổi mới (regression).

Khi bị dừng, developer chỉ được sửa lỗi và ổn định, cho đến khi CTO mở lại.

## 6. Mức độ nghiêm trọng lỗi

| Mức | Định nghĩa | Thời hạn xử lý |
|---|---|---|
| **P0 — Chặn** | Mất/hỏng dữ liệu, crash, không chạy offline, không mở được game | Sửa ngay, dừng mọi việc khác |
| **P1 — Nghiêm trọng** | Tính năng chính không hoạt động đúng, lỗi Safari iOS, FPS dưới ngưỡng, kinh tế game vỡ | Trong lần giao việc tiếp theo |
| **P2 — Trung bình** | Lỗi hiển thị, trải nghiệm khó chịu, hoạt ảnh giật, văn bản sai | Trong giai đoạn hiện tại |
| **P3 — Nhỏ** | Đánh bóng, cải tiến nhỏ | Đưa vào danh sách cải tiến |

## 7. Ngôn ngữ và nội dung
- Ngôn ngữ giao diện: tiếng Việt có dấu đầy đủ, dùng font hỗ trợ tiếng Việt (không lỗi dấu).
- Giọng văn: vui vẻ, sang trọng, hài hước nhẹ; không phản cảm, không vùng miền/giới tính miệt thị.
- Không thu thập dữ liệu cá nhân. Không quảng cáo. Không mua bán bằng tiền thật trừ khi chủ dự án quyết định.
