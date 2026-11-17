# Báo cáo tái thiết kế v2 — giai đoạn 1 đến 4

Ngày 2026-11-16 · nhánh `feat/full-loop` · tài liệu: `docs/research/2026-11-16-kvtm-doi-chieu.md`, `docs/REDESIGN_V2.md`

## Đã làm

| Giai đoạn | Kết quả |
|---|---|
| 1. Kiểm toán + nghiên cứu | Bảng đối chiếu KVTM/PBTC (5 cột) — `docs/research/2026-11-16-kvtm-doi-chieu.md`. **Không cài và không chơi được KVTM**; dựa trên ảnh chủ dự án gửi + nguồn công khai. |
| 2. Thiết kế | `docs/REDESIGN_V2.md`: góc nhìn, cấu trúc tầng, chậu/bộ/bậc, tương tác, nhiệm vụ, HUD, thứ tự làm. Đồ họa đợt mới: `ART_STYLE_GUIDE.md` §11.7 (15 câu lệnh). |
| 3. Khu vườn mẫu | Xem bảng dưới. Mọi nút có lệnh thật trong lõi, có kiểm tra. |
| 4. Tự kiểm | 81 bài lõi + 7 bài trình duyệt (Chrome) qua; ảnh chụp trong `tai-thiet-ke-v2/`; phát hiện và sửa 1 lỗi đứng hình (dưới). |

### Tính năng mới (giai đoạn 3)
- **Tầng 6→10 chậu**: tầng mới có 6 chậu to; ô "Thêm chậu" phát sáng ở cuối hàng, chạm để mở rộng (xu). Chậu tự co lại khi tầng đông.
- **Sao tầng** (0–3) trên biển gỗ dưới mỗi tầng: cần cấp + xu + nông sản; mỗi sao +5% lớn nhanh, +5% XP cho cả tầng.
- **Bộ chậu**: 3 bộ (Đồ Cổ Mộc Đồng, Gốm Sứ Cung Đình, Bảo Vật Trời Mây); đủ 4/6 chậu cùng bộ trên một tầng → thưởng cả tầng. Chậu đất nung khởi đầu không thuộc bộ nào (thưởng phải giành được).
- **Bậc ngoại hình chậu**: Mộc / Tinh (hào quang ấm + 2 đốm sáng) / Thần (hào quang vàng + 4 đốm sáng bay vòng trước-sau chậu).
- **Vòng sáng khi thu hoạch** từ gốc cây, cùng nông sản bay vào Rương.
- **Khay hạt**: nút Hạt giống mở khay ở đáy; **kéo hạt qua các chậu trống để gieo**, hạt bay theo ngón tay; chạm hạt để chọn rồi vuốt gieo.
- **Nhiệm Vụ Hôm Nay**: 3 nhiệm vụ/ngày (giờ Việt Nam), đếm từ sự kiện thật, nhận thưởng, quà khi xong cả 3; chấm đỏ trên HUD.
- **Thăm vườn hàng xóm**: Bảng Phú Bà → "Ghé vườn": thấy vườn BOT (tầng, chậu, cây theo cấp và sở thích của họ, lớn theo thời gian), chạm chậu khát/có bọ để giúp, tối đa 3 lần/nhà/ngày, mỗi lần được xu + XP + thân thiết.
- **Save 6→7**: lưu cũ giữ nguyên 10 ô (coi như đã mở rộng hết), sao = 0, nhiệm vụ/lượt giúp trống. Có kiểm tra migration.

### Lỗi tìm ra khi tự kiểm
- **Game đứng hình** khi hoạt ảnh còn chạy trên vật thể vừa bị dựng lại (ví dụ lên 2 sao liên tiếp, mở tầng rồi mở rộng ngay). Chụp màn hình phát hiện, stack trace xác nhận. Sửa: hoạt ảnh gắn chủ, tự dừng khi chủ bị huỷ; một hoạt ảnh lỗi không được làm dừng vòng vẽ.
- Hào quang chậu ban đầu là khối trắng cứng → đổi sang texture toả mềm.
- Khay hạt bị thanh DEV đè (chỉ ở chế độ dev) → khay nổi lên trên.
- Tên tầng bị ô xu/ngọc đè (lỗi cũ) → tầng chưa mở dùng biển gỗ nằm thấp trên mây.

## Tự đánh giá theo danh sách "không chấp nhận" của yêu cầu

| Tiêu chí | Đạt chưa | Bằng chứng / lý do |
|---|---|---|
| Giao diện kiểu web quản trị | Đạt | Khung gỗ, ruy băng, nút kẹo, khay gỗ (ảnh 03–06) |
| Ô vuông đơn giản | Đạt | — |
| Cây đứng im | **Đạt một phần** | Có đung đưa, nảy, nhún khi chín, vòng sáng khi thu; **chưa có mặt/tính cách** (cần ảnh §11.7 #1–6) |
| Nút mặc định, biểu tượng thô | **Chưa đạt hẳn** | Nút đã theo hệ thiết kế; vài biểu tượng HUD vẫn là hình CSS tạm (cuộn giấy, vương miện, khinh khí cầu) |
| Tầng chỉ là nền | **Chưa đạt** | Đã có số chậu riêng, sao, biển tên, mở rộng; **chưa có đồ treo, trang trí, máy, thú cưng** — cần ảnh §11.7 #12–15 và hệ trang trí (giai đoạn 5) |
| Ảnh AI không đồng bộ | **Chưa đạt** | Chậu sứ/ngọc/đồng/mây/vàng vẫn là chậu đất nung tô màu chờ ảnh (ảnh 04 thấy rõ) |
| Hiệu ứng che thiếu gameplay | Đạt | Mỗi hiệu ứng gắn với lệnh thật có kiểm tra |
| 60 FPS iPad Pro M2 Safari | **Chưa đo** | Chrome giả lập phần mềm (swiftshader) chỉ 10 FPS, không có giá trị đo; cần thử trên iPad thật |

**Kết luận: gameplay và tương tác của khu vườn mẫu đã có thật và đã kiểm tra; chất lượng hình ảnh chưa tới mức thương mại.** Nút thắt còn lại là đồ họa: cây có mặt, chậu theo bậc, đồ trang trí, máy. Không tự coi là xong.

## Việc tiếp theo (giai đoạn 5)
1. Tạo 15 ảnh §11.7 (Leonardo, ~1 ngày hạn mức) → chủ dự án tải về → tôi cắt, đóng gói, thay vào (tên khung đã định sẵn).
2. Hệ trang trí: neo 2 đầu tầng + 3 dây treo, mua ở Lò Gốm, có chỉ số nhỏ.
3. Máy chế biến mỗi tầng + chim trợ giúp bắt bọ.
4. Hướng dẫn người mới có tay chỉ.
5. Chủ dự án thử trên iPad thật: FPS, kéo-thả hạt bằng ngón tay, vuốt leo tầng.
