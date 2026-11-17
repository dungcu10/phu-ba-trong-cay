# CHỈ THỊ 06 — Làm mới giao diện: đẹp, hiện đại, vẫn chất cổ tích

Kiểm tra trên bản thử 75c2d00 (ảnh `tang-vo-tan.png`, `nhiem-vu-today.png`). **Điểm giao diện hiện tại: 5,5/10.** Chức năng đủ, nhưng nhìn rối và cũ.

## Lỗi cụ thể đang thấy
1. **Rối chữ trên vườn.** Nhãn "-40 xu", "-120 xu" to, viền trắng, đè lên bong bóng nước/sao, đè cả lên nhau.
2. **Thông báo quá to.** Hai hộp xanh lá to che tên tầng và nút. Màu xanh lá lạc tông so với bảng màu.
3. **Chồng lớp.** Biển tên tầng đè lên hàng chậu; dock dưới (Hạt giống, Rương Mây, Lò Gốm) đè lên chậu tầng dưới; thanh DEV đè lên vườn.
4. **Menu trái** bị cây leo che một nửa. Mỗi nút một cỡ nhãn. Thanh kinh nghiệm "0/19.296" không có phần đầy, không đọc được tiến độ.
5. **Bảng (Nhiệm Vụ...) kiểu gỗ – giấy da cũ.** Nút "Nhận" khi chưa đủ điều kiện xám đục, trông như hỏng. 7 tab chen chúc. Thứ bậc chữ yếu: tiêu đề, nội dung và phần thưởng cùng cỡ.
6. **Một kiểu chữ cho mọi thứ**, không có chữ tiêu đề có cá tính.

## Hướng thiết kế: "Cổ tích hiện đại" (cozy modern)
Giữ thế giới cổ tích (mây, cây leo cổ thụ, chậu đặc trưng). **Làm mới lớp giao diện phủ lên trên**: sạch, thoáng, mềm, có chiều sâu nhẹ — kiểu game nông trại di động đời mới, không phải kiểu app doanh nghiệp.

### Hệ thống thiết kế (cập nhật DESIGN_SYSTEM.md + design-tokens.json, làm TRƯỚC mọi màn hình)
- **Màu:** nền thẻ kem trắng mờ `rgba(255,251,244,0.92)`. Chữ chính nâu đậm `#3B2A1E`. Một màu nhấn chính (vàng mật ong `#F5B83D`) cho hành động chính. Một màu phụ (xanh ngọc `#2FA39A`) cho trạng thái tốt/hoàn thành. Đỏ san hô `#E8615A` chỉ cho cảnh báo/thông báo mới. Bỏ xanh lá chói.
- **Chữ:** 1 font tiêu đề tròn, có cá tính (gợi ý Baloo 2 hoặc Quicksand, giấy phép OFL, hỗ trợ đủ dấu tiếng Việt, **nhúng offline**, chỉ lấy các cỡ chữ cần dùng, ≤ 150 KB). Nội dung dùng Nunito hoặc font hiện tại. Thang cỡ: 28 / 20 / 16 / 13. Chỉ 2 độ đậm.
- **Hình khối:** bo góc thẻ 20px, nút 14px, chip tròn. Bóng mềm một lớp `0 6px 20px rgba(60,40,20,.15)`. Bỏ viền gỗ dày và hoa văn giấy da.
- **Khoảng cách:** lưới 8px. Vùng chạm tối thiểu 44×44px.
- **Biểu tượng:** một bộ duy nhất, cùng nét, cùng độ dày, cùng góc nhìn. Không trộn ảnh chụp với hình vẽ phẳng.
- **Chuyển động:**
  - nút nhấn co 0,96 trong 120ms;
  - bảng mở dạng trượt lên từ dưới (bottom sheet) với lò xo 250ms;
  - số xu bay lên và mờ dần 600ms;
  - tôn trọng `prefers-reduced-motion`.
- **Hiệu năng:**
  - `backdrop-filter` chỉ dùng cho thẻ nhỏ, không dùng cho nền toàn màn hình (Safari iOS tốn GPU);
  - không đổ bóng động trên canvas;
  - FPS bằng nút Đo hiệu năng không giảm quá 5% so với trước khi làm mới.

### Bố cục màn hình chính
- **Góc trên trái:** ảnh đại diện có vòng tiến độ cấp quanh viền (thay thanh "0/19.296"). Bấm vào ra chi tiết.
- **Giữa trên:** 2 viên xu và ngọc gọn, có nút "+" nhỏ.
- **Phải trên:** thư, cài đặt.
- **Menu trái:** chuyển thành cột nút tròn 56px đều nhau, đặt **ngoài** vùng cây leo hoặc trên nền thẻ mờ. Nhãn nhỏ dưới nút, cùng cỡ. Chấm đỏ thông báo nhỏ gọn.
- **Dock dưới:** một thanh nổi bo tròn, nền kem mờ, 3–5 nút. **Vườn phải chừa khoảng trống phía dưới** để không bị đè.
- **Tên tầng:** chip nhỏ góc trên trái của tầng, không đè chậu.
- **Nhãn trên chậu:** chỉ hiện 1 biểu tượng trạng thái nhỏ (nước / chín / bọ). Giá "Thêm chậu" chuyển vào nút "+". Bỏ chữ "-40 xu" thường trực; xu chỉ bay lên lúc thu hoạch.
- **Thông báo:** viên thuốc nhỏ giữa trên, tối đa 1 cái cùng lúc, tự tắt sau 2,5 giây, không che biển tên tầng.
- **Thanh DEV** chỉ hiện khi `?dev=1` và thu gọn được.

### Bảng (Nhiệm Vụ, Lò Gốm, Rương Mây, Sổ Tay...)
- Dạng **bottom sheet** chiếm khoảng 85% chiều cao, kéo xuống để đóng, có nút X.
- Tab dạng thanh trượt ngang (segmented, cuộn được), không xuống dòng.
- Thẻ nhiệm vụ:
  - tiêu đề 16 đậm;
  - thanh tiến độ mảnh bo tròn;
  - phần thưởng là chip có biểu tượng;
  - nút "Nhận" màu vàng khi nhận được. Khi chưa đủ, nút hiện tiến độ ("3/6"), màu nhạt nhưng **không xám đục**.
- Trạng thái trống có hình minh họa nhỏ và một câu hướng dẫn.

## Quy trình bắt buộc (bài học từ bộ chậu: duyệt hình trước, làm sau)
1. **Bước A — Bản mẫu, chưa sửa code game.** Làm 3 màn mẫu ở 1194×834:
   - màn chính có 2 tầng;
   - bảng Nhiệm Vụ;
   - Lò Gốm.

   Mỗi màn chụp ảnh **trước/sau** đặt cạnh nhau. Gửi chủ dự án và CTO duyệt. **Dừng chờ duyệt.**
2. **Bước B — Sau khi duyệt:** áp hệ thống thiết kế vào code theo thứ tự HUD → dock → nhãn chậu → thông báo → các bảng. Mỗi phần một commit.
3. **Bước C — Kiểm tra:**
   - ảnh trước/sau mọi màn;
   - iPad Pro 11 (1194×834) và 12,9 inch (1366×1024), cả màn ngang lẫn dọc;
   - Safari iOS hoặc WebKit;
   - số đo hiệu năng trước/sau;
   - toàn bộ test xanh.

## Không làm
- Không đổi gameplay, số liệu, save, BOT.
- Không thay ảnh nền, cây leo, chậu. Chỉ làm lớp giao diện.
- Không thêm thư viện UI nặng. Không tải font từ CDN.
