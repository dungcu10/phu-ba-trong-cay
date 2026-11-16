# QUALITY_STANDARDS.md — PHÚ BÀ TRỒNG CÂY

> Tiêu chuẩn đo được. Một tính năng không đạt bất kỳ tiêu chuẩn **bắt buộc** nào thì không được nghiệm thu.
> Thiết bị chuẩn để đo: **iPad Pro M2, Safari iPadOS bản mới nhất, chế độ Nguồn điện thấp TẮT**, trừ khi ghi khác.

---

## 1. Hiệu năng (Performance)

| Chỉ số | Bắt buộc | Mục tiêu |
|---|---|---|
| FPS trung bình khi chơi bình thường | ≥ 60 | 60 ổn định (120 trên màn ProMotion nếu kiến trúc cho phép) |
| FPS thấp nhất (1% low) | ≥ 45 | ≥ 55 |
| FPS khi kịch bản tải nặng* | ≥ 50 | ≥ 60 |
| Thời gian khung hình (frame time) cao nhất | ≤ 33 ms | ≤ 20 ms |
| Mở game lần đầu (có mạng) | ≤ 5 giây | ≤ 3 giây |
| Mở game các lần sau (offline) | ≤ 3 giây | ≤ 1,5 giây |
| Bộ nhớ JS heap sau 30 phút chơi | ≤ 300 MB, không tăng liên tục | ≤ 200 MB |
| Thời gian lưu game | ≤ 50 ms, không gây giật | ≤ 16 ms |
| Tính tiến trình offline (8 giờ vắng mặt) | ≤ 1 giây | ≤ 300 ms |
| Tổng dung lượng tải lần đầu | ≤ 60 MB | ≤ 30 MB |

\* **Kịch bản tải nặng:** 200 ô đất đang có cây, 30 BOT di chuyển, hiệu ứng thời tiết bật, đang thu hoạch hàng loạt.

**Quy tắc kỹ thuật bắt buộc:**
- Gộp ảnh thành sprite atlas; không tải hàng trăm file ảnh rời.
- Không tạo object mới mỗi khung hình trong vòng lặp nóng (dùng object pool cho hạt, số bay, BOT).
- Không đọc/ghi DOM trong vòng lặp game (nếu render bằng Canvas/WebGL).
- Chỉ vẽ lại phần tĩnh khi thay đổi (cache lớp nền).
- Đối tượng ngoài màn hình không render (culling).
- Ảnh không lớn hơn 2× kích thước hiển thị thực tế.

## 2. Tương thích Safari iPadOS

**Bắt buộc:**
- Không dùng API Safari không hỗ trợ; tính năng mới phải kiểm tra trên Safari thật, không chỉ Chrome máy tính.
- Âm thanh chỉ khởi động sau tương tác chạm đầu tiên (chính sách autoplay của iOS).
- Chặn các cử chỉ mặc định gây phiền: chụm-phóng cả trang, kéo nảy (rubber-band), chạm đúp phóng to, chọn văn bản khi giữ lâu.
- Xử lý vùng an toàn (safe area) và thanh địa chỉ khi chạy trong trình duyệt lẫn khi cài lên màn hình chính.
- Lưu game khi `visibilitychange`/`pagehide` (iOS có thể đóng tab nền bất kỳ lúc nào).
- Không phụ thuộc `localStorage` cho save chính (giới hạn dung lượng, có thể bị xóa); dùng IndexedDB, yêu cầu `navigator.storage.persist()` khi có thể.
- Xử lý mất WebGL context (nếu dùng WebGL): khôi phục được, không màn hình đen.
- Xoay màn hình không làm vỡ bố cục hoặc mất trạng thái.

## 3. Đồ họa và nghệ thuật (Art)

### 3.1. Phong cách
- Một phong cách thống nhất theo Style Guide được chủ dự án duyệt (Giai đoạn 2). Trước khi có Style Guide, mọi tài nguyên được coi là tạm.
- Không trộn lẫn ảnh pixel art, vector, ảnh chụp, ảnh 3D render trong cùng một màn hình trừ khi Style Guide cho phép.
- Bảng màu giới hạn, ánh sáng nhất quán (một hướng nguồn sáng chính).

### 3.2. Chất lượng tài nguyên
- Sắc nét trên màn hình Retina (hệ số điểm ảnh 2×): không mờ, không răng cưa, không viền trắng quanh ảnh trong suốt.
- Mỗi loại cây có ≥ 4 giai đoạn sinh trưởng phân biệt rõ bằng hình dạng, không chỉ bằng cỡ.
- Không có placeholder (ô màu, chữ "TODO", hình mẫu, emoji thay thế) trong tính năng được nghiệm thu đồ họa.
- Không dùng tài nguyên vi phạm bản quyền; mọi tài nguyên có nguồn trong `assets/ASSET_SOURCES.md`.

### 3.3. Hoạt ảnh
- Mọi tương tác có phản hồi thị giác trong ≤ 100 ms.
- Hoạt ảnh có easing, không chuyển động tuyến tính cứng; không giật khung.
- Hành động lặp lại nhiều lần (thu hoạch hàng loạt) không gây quá tải hiệu ứng: gộp hoặc giới hạn số hạt.

### 3.4. Giao diện (UI/UX)
- Vùng chạm tối thiểu 44×44 pt.
- Văn bản tiếng Việt có dấu hiển thị đúng, cỡ chữ thân ≥ 16 pt, tương phản đủ đọc (≥ 4,5:1).
- Người chơi luôn biết: đang có bao nhiêu tiền, cây nào sắp chín, việc tiếp theo nên làm.
- Không quá 3 lần chạm cho một hành động thường xuyên (gieo, thu hoạch, bán).
- Mọi nút trên màn hình đều hoạt động thật. Nút chưa có chức năng thì **ẩn**, không để trơ.

## 4. Gameplay

**Bắt buộc:**
- **Lựa chọn có ý nghĩa:** không tồn tại một lựa chọn luôn tốt nhất (ví dụ một loại cây vượt trội mọi mặt). Kiểm chứng bằng bảng so sánh lợi nhuận/giờ.
- **Tiến trình rõ ràng:** người chơi mới đạt cấp 2 trong ≤ 5 phút; luôn có mục tiêu ngắn hạn (≤ 5 phút), trung hạn (≤ 1 giờ), dài hạn (nhiều ngày).
- **Kinh tế ổn định:** mô phỏng 30 ngày chơi không xảy ra lạm phát vô hạn, không kẹt (hết tiền, hết hạt, không thể tiếp tục).
- **Tôn trọng thời gian:** thời gian chờ có ý nghĩa; luôn có việc gì đó để làm khi chờ.
- **Không có lỗi khai thác** (exploit): chỉnh giờ hệ thống, bấm nhanh liên tục, thoát giữa chừng không tạo lợi thế bất hợp lý.

## 5. BOT

Một BOT được coi là **thật** khi đáp ứng đủ:
- Có trạng thái nội tại (nhu cầu, mục tiêu, tài nguyên) được lưu vào save.
- Ra quyết định dựa trên trạng thái thế giới hiện tại; cùng một tình huống khác nhau → quyết định khác nhau.
- Hành động có hệ quả thật lên kinh tế/thế giới (mua làm giảm hàng, bán làm đổi giá, tưới làm cây lớn).
- Mô phỏng được khi offline mà không cần render.
- Có công cụ debug xem được mục tiêu và lý do hành động.

BOT **không đạt** nếu: chỉ đi theo đường vẽ sẵn, chỉ chạy hoạt ảnh trang trí, hoặc kết quả được tính bằng số ngẫu nhiên không phụ thuộc trạng thái.

Hiệu năng BOT: 30 BOT hoạt động đồng thời tốn ≤ 2 ms mỗi khung hình cho logic.

## 6. Dữ liệu và độ tin cậy

**Bắt buộc:**
- Không mất tiến trình khi: tắt app đột ngột, khóa màn hình, hết pin giả lập (đóng tab), mất mạng, cập nhật phiên bản game.
- Save hỏng → tự khôi phục bản save trước, thông báo nhẹ cho người chơi.
- Cập nhật phiên bản game không làm mất save cũ (có migration và test migration).
- Xuất/nhập save hoạt động và có kiểm tra tính hợp lệ.

## 7. Chất lượng mã nguồn

**Bắt buộc:**
- Tách lớp config · state · systems · render (xem `PROJECT_RULES.md` 4.2).
- File không quá ~500 dòng; hàm không quá ~60 dòng (ngoại lệ phải có lý do).
- Số liệu cân bằng nằm trong file cấu hình, không viết cứng trong logic.
- Có kiểm thử tự động cho: logic sinh trưởng, kinh tế, tính tiến trình offline, lưu/đọc/migration save, quyết định BOT.
- Không còn `console.log` debug, code chết, `TODO` không có mã việc.
- Không lỗi/cảnh báo trong console khi chơi bình thường.
- Đặt tên rõ nghĩa, nhất quán (một ngôn ngữ cho tên biến — tiếng Anh).
