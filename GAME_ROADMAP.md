# GAME_ROADMAP.md — PHÚ BÀ TRỒNG CÂY

> Lộ trình chia theo giai đoạn. **Chỉ chuyển sang giai đoạn sau khi giai đoạn trước được CTO nghiệm thu và chủ dự án duyệt cột mốc.**
> Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · 🟦 Chờ nghiệm thu · ✅ Đã nghiệm thu · ⛔ Bị dừng

Cập nhật lần cuối: 2026-11-16

---

## Giai đoạn 0 — Rà soát và nền móng (Foundation Audit)
**Mục tiêu:** Biết chính xác dự án đang ở đâu và dựng nền đủ chắc để xây tiếp.
Trạng thái: 🟨

- [ ] CTO rà soát toàn bộ repository hiện có: cấu trúc, công nghệ, mức độ hoàn thiện thật của từng tính năng.
- [ ] Ghi ngăn xếp công nghệ vào `PROJECT_RULES.md` mục 4.1.
- [ ] Phân loại tính năng hiện có: Hoạt động thật / Hoạt động một phần / Giả (UI không có logic) / Placeholder.
- [ ] Tách lớp config · state · systems · render (nếu đang trộn lẫn).
- [ ] Hệ thống lưu offline đạt chuẩn: IndexedDB, save xoay vòng, `saveVersion`, migration, xuất/nhập save.
- [ ] Chạy offline 100% sau lần tải đầu (Service Worker) — kiểm chứng bằng chế độ máy bay.
- [ ] Đo hiệu năng nền trên iPad Pro M2 (FPS, bộ nhớ, thời gian tải).
- [ ] Thiết lập công cụ debug: hiển thị FPS, tua nhanh thời gian, reset save an toàn (chỉ ở chế độ dev).

**Cột mốc M0:** Báo cáo rà soát + nền móng được nghiệm thu. → *Chủ dự án duyệt.*

## Giai đoạn 1 — Vòng lặp lõi (Core Loop)
**Mục tiêu:** Trồng → chăm → thu hoạch → bán → mở rộng phải *vui* ngay cả khi chưa có gì khác.
Trạng thái: ⬜

- [ ] Ô đất trên đảo mây: cày, gieo, tưới, bón, thu hoạch.
- [ ] Tối thiểu 8 loại cây với thời gian, giá trị và yêu cầu khác nhau (có lý do để chọn cây này thay cây kia).
- [ ] Sinh trưởng theo thời gian thực, tiếp tục khi tắt game (tính toán offline progress).
- [ ] Kho chứa có giới hạn, nâng cấp được.
- [ ] Bán nông sản: giá cơ bản + biến động nhẹ.
- [ ] Mở rộng đất / mở khóa ô mới.
- [ ] Cấp độ người chơi và mở khóa theo cấp.
- [ ] Phản hồi tức thì: âm thanh, hiệu ứng, số bay lên khi thu hoạch/bán.

**Cột mốc M1:** Một người chơi mới chơi 15 phút liên tục mà không bối rối và muốn chơi tiếp. → *Chủ dự án chơi thử và duyệt.*

## Giai đoạn 2 — Đồ họa chuẩn và cảm giác (Art & Feel)
**Mục tiêu:** Thay toàn bộ placeholder của vòng lặp lõi bằng tài nguyên hoàn chỉnh, thống nhất phong cách.
Trạng thái: ⬜

- [ ] Chốt Style Guide (bảng màu, ánh sáng, tỷ lệ, nét vẽ) — *chủ dự án duyệt.*
- [ ] Đảo mây, bầu trời, mây trôi nhiều lớp (parallax), chu kỳ ngày–đêm.
- [ ] Đủ các giai đoạn sinh trưởng cho mỗi loại cây (tối thiểu 4 giai đoạn).
- [ ] Hoạt ảnh: cây đung đưa, thu hoạch, tưới nước, hạt rơi, tiền bay.
- [ ] Giao diện (UI) theo phong cách thống nhất, cỡ chạm phù hợp ngón tay.
- [ ] Âm nhạc nền và hiệu ứng âm thanh.

**Cột mốc M2:** Không còn placeholder trong vòng lặp lõi; đạt chuẩn đồ họa và FPS. → *Chủ dự án duyệt phong cách.*

## Giai đoạn 3 — Chiều sâu kinh tế (Economy & Progression)
**Mục tiêu:** Người chơi có chiến lược dài hạn.
Trạng thái: ⬜

- [ ] Chế biến: máy móc biến nông sản thành sản phẩm giá trị cao (chuỗi sản xuất 2–3 bậc).
- [ ] Đơn hàng (orders) với phần thưởng và thời hạn.
- [ ] Thị trường có cung–cầu: bán nhiều một mặt hàng thì giá giảm, hồi phục theo thời gian.
- [ ] Vật nuôi trên mây (tùy chủ dự án duyệt).
- [ ] Mở rộng sang đảo mây mới với khí hậu/cây đặc trưng.
- [ ] Mô hình cân bằng kinh tế bằng bảng tính/mô phỏng, có kiểm thử tự động tránh lạm phát.

**Cột mốc M3:** Kinh tế ổn định qua mô phỏng 30 ngày chơi; không có chiến thuật "vô hạn tiền". → *Chủ dự án duyệt.*

## Giai đoạn 4 — BOT thông minh (Living World)
**Mục tiêu:** Thế giới có cư dân hành động theo mục tiêu thật.
Trạng thái: ⬜

- [ ] Kiến trúc AI chung: mỗi BOT có nhu cầu/mục tiêu, nhận thức trạng thái thế giới, chọn hành động (Utility AI hoặc Behavior Tree).
- [ ] **Khách hàng BOT:** đến mua theo nhu cầu, phản ứng với giá và chất lượng.
- [ ] **Người giúp việc BOT:** tự tưới, thu hoạch, chở hàng theo ưu tiên người chơi đặt; có giới hạn năng lực.
- [ ] **Hàng xóm/đối thủ BOT:** cũng trồng, bán, ảnh hưởng thị trường; có thể giao thương.
- [ ] Tìm đường trên đảo, tránh va chạm.
- [ ] BOT vẫn "sống" khi người chơi offline (mô phỏng gộp, không cần render).
- [ ] Công cụ debug hiển thị BOT đang nghĩ gì (mục tiêu hiện tại, lý do chọn hành động).

**Cột mốc M4:** Chứng minh được BOT ra quyết định thay đổi theo trạng thái game (không phải kịch bản cố định). → *Chủ dự án duyệt.*

## Giai đoạn 5 — Nội dung và sự kiện (Content & Events)
Trạng thái: ⬜

- [ ] Nhiệm vụ/thành tựu, cốt truyện nhẹ "hành trình thành phú bà".
- [ ] Sự kiện theo mùa, lễ Tết Việt Nam.
- [ ] Trang trí đảo: nhà, vườn, tượng, đường đi.
- [ ] Bộ sưu tập (cây hiếm, giống đặc biệt).

**Cột mốc M5:** Đủ nội dung cho ít nhất 2 tuần chơi. → *Chủ dự án duyệt.*

## Giai đoạn 6 — Đánh bóng và phát hành (Polish & Release)
Trạng thái: ⬜

- [ ] Hướng dẫn chơi (tutorial) lồng vào gameplay.
- [ ] Cài đặt: âm lượng, ngôn ngữ, sao lưu save.
- [ ] Kiểm thử toàn diện theo `ACCEPTANCE_CHECKLIST.md`.
- [ ] Kiểm thử độ bền: chơi liên tục 2 giờ, kiểm tra rò rỉ bộ nhớ.
- [ ] Biểu tượng ứng dụng, màn hình chờ, cài lên màn hình chính iPad.

**Cột mốc M6 — Phát hành 1.0.** → *Chủ dự án duyệt phát hành.*

---

## Danh sách chờ (Backlog — chưa lên lịch)
Ý tưởng mới ghi vào đây, **không tự ý làm**. CTO đánh giá, chủ dự án quyết định đưa vào giai đoạn nào.

- (trống)
