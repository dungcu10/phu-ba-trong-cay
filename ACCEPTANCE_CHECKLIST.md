# ACCEPTANCE_CHECKLIST.md — PHÚ BÀ TRỒNG CÂY

> CTO dùng danh sách này để nghiệm thu. **Không nghiệm thu chỉ dựa trên báo cáo của developer** — mọi mục phải có bằng chứng (chạy thử, ảnh chụp, số đo, kết quả test).
> Sao chép phần "Phiếu nghiệm thu" cho mỗi tính năng.

---

## A. Điều kiện để được đưa vào nghiệm thu
Developer phải có đủ trước khi yêu cầu nghiệm thu, thiếu một mục → trả lại ngay:

- [ ] Báo cáo giao việc theo mẫu tại `PROJECT_RULES.md` 3.4
- [ ] Đã cập nhật `CHANGELOG.md`
- [ ] Kiểm thử tự động chạy qua (ghi lệnh và kết quả)
- [ ] Có bằng chứng chạy trên Safari iPadOS (ảnh chụp/video hoặc ghi chép thiết bị)
- [ ] Liệt kê rõ phần chưa làm và phần còn dùng placeholder

---

## B. Phiếu nghiệm thu tính năng

```
Tính năng: ____________________   Giai đoạn: ___   Ngày: __________
Người nghiệm thu: CTO (Claude giám sát)
```

### 1. Hoạt động chính xác
- [ ] Làm đúng yêu cầu đã giao, không thiếu, không tự thêm phạm vi
- [ ] Mọi nút/điều khiển liên quan đều có tác dụng thật
- [ ] Không có số liệu giả/viết cứng thay cho logic
- [ ] Xử lý trường hợp biên: không đủ tiền, kho đầy, chạm liên tục, dữ liệu rỗng
- [ ] Đúng khi tắt game rồi mở lại (tiến trình offline tính đúng)
- [ ] Chỉnh giờ hệ thống không tạo lợi thế bất thường

### 2. Giao diện và trải nghiệm
- [ ] Không còn placeholder (hoặc ghi rõ "chức năng xong — chờ đồ họa")
- [ ] Đúng phong cách theo Style Guide
- [ ] Phản hồi chạm ≤ 100 ms, có hiệu ứng/âm thanh phù hợp
- [ ] Vùng chạm ≥ 44×44 pt, chữ tiếng Việt đúng dấu, đọc rõ
- [ ] Người chơi mới hiểu cách dùng mà không cần giải thích
- [ ] Hoạt động đúng ở cả hướng ngang và dọc, cả trong Safari và khi cài lên màn hình chính

### 3. Hiệu năng (đo trên iPad Pro M2)
- [ ] FPS trung bình ≥ 60, 1% low ≥ 45 khi dùng tính năng
- [ ] Kịch bản tải nặng FPS ≥ 50
- [ ] Không tăng bộ nhớ liên tục sau 10 phút dùng tính năng
- [ ] Không gây giật khi lưu game
- Số đo thực tế: FPS TB ____ · 1% low ____ · Heap ____ MB

### 4. Không gây lỗi chức năng cũ (Regression)
- [ ] Bộ kiểm thử tự động toàn dự án chạy qua
- [ ] Chạy lại "Kịch bản kiểm thử khói" (mục C) — đạt toàn bộ
- [ ] Save từ phiên bản trước mở được, không mất dữ liệu

### 5. Có thể bảo trì và mở rộng
- [ ] Đúng phân lớp config · state · systems · render
- [ ] Số liệu cân bằng nằm trong file cấu hình
- [ ] Có kiểm thử tự động cho logic mới
- [ ] Không có code chết, `console.log` debug, `TODO` vô chủ
- [ ] Thêm một biến thể mới (ví dụ thêm 1 loại cây) chỉ cần sửa cấu hình/dữ liệu

### Kết luận
- [ ] **ĐẠT** — nghiệm thu
- [ ] **ĐẠT CÓ ĐIỀU KIỆN** — nghiệm thu, kèm danh sách P2/P3 phải sửa trong giai đoạn
- [ ] **KHÔNG ĐẠT** — trả lại, kèm danh sách lỗi theo mức P0–P3

Lỗi phát hiện:
| # | Mức | Mô tả | File/Module | Tiêu chí xác nhận đã sửa |
|---|---|---|---|---|
| 1 | | | | |

---

## C. Kịch bản kiểm thử khói (Smoke Test) — chạy sau MỌI thay đổi

1. [ ] Mở game từ màn hình chính iPad, vào được trong ≤ 3 giây
2. [ ] Bật chế độ máy bay → tải lại → game vẫn chạy đầy đủ
3. [ ] Gieo 1 cây → chờ/tua nhanh → thu hoạch → bán → tiền tăng đúng
4. [ ] Vuốt về màn hình chính giữa chừng → mở lại → không mất tiến trình
5. [ ] Đóng hẳn tab/app → mở lại → tiến trình offline được tính đúng
6. [ ] Xoay màn hình → bố cục đúng, không mất trạng thái
7. [ ] Âm thanh phát sau chạm đầu tiên, không lỗi
8. [ ] Console không có lỗi đỏ
9. [ ] Chơi 5 phút: FPS hiển thị ổn định ≥ 60

## D. Nghiệm thu cột mốc (Milestone)

Cột mốc chỉ được trình chủ dự án duyệt khi:
- [ ] Mọi tính năng trong giai đoạn đã ĐẠT hoặc ĐẠT CÓ ĐIỀU KIỆN
- [ ] Không còn lỗi P0, P1
- [ ] Kiểm thử độ bền: chơi liên tục 30 phút (từ M3 trở đi: 2 giờ) không crash, không rò rỉ bộ nhớ
- [ ] `GAME_ROADMAP.md` cập nhật trạng thái
- [ ] Báo cáo tổng kết cho chủ dự án: đã xong gì, điểm chất lượng /10, rủi ro còn lại, đề xuất giai đoạn sau
