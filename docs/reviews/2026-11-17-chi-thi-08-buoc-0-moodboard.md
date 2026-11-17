# Chỉ thị 08 · Bước 0 — Moodboard (chờ CTO duyệt)

Nhánh: `art/blender-world` (tách từ `feat/cto-07-cho-may-giao-dien` @ d672d63, nhánh này đã chứa toàn bộ `feat/nang-cap-v3`).
Đã dừng mọi bản phác 2D mây / cây leo / thú cưng. Canvas giao diện v3 giữ nguyên, không vẽ thêm.

Ảnh tham khảo là ảnh chụp thật, chỉ dùng để học hình khối, ánh sáng, chất liệu. Không đưa ảnh nào vào game hay vào kho.
Không dùng ảnh chụp màn hình Genshin / Sky / Hay Day: ba game này chỉ là mức chất lượng cần đạt, không phải nguồn để chép.

## 10 tham khảo và thứ lấy từ mỗi ảnh

| # | Tham khảo | Lấy gì |
|---|-----------|--------|
| 1 | Mây cumulus lúc hoàng hôn | Khối chồng nhiều cỡ (to–vừa–nhỏ, không đều). Đỉnh trắng ngà bắt nắng, bụng hồng đào, đáy tím lavender. Mép mỏng sáng xuyên (subsurface). |
| 2 | Thân tử đằng (wisteria) già | Nhiều sợi thân xoắn quấn vào nhau, vân vỏ chạy theo chiều xoắn. Mẫu cho thân 3–4 sợi lặp liền. |
| 3 | Rêu trên vỏ cây và đá | Rêu đọng ở rãnh và mặt trên hướng sáng, không phủ đều khắp nơi. |
| 4 | Đá bậc phủ rêu trong vườn Nhật | Bệ chậu: đá tròn cạnh mòn, kích cỡ lệch nhau, rêu ở chân. |
| 5 | Ruộng bậc thang Mù Cang Chải | Tầng Hoàng Kim: bờ bậc cong theo đường đồng mức, vàng lúa chín gần, xanh nhạt ngả tím ở xa. |
| 6 | Đồi chè Mộc Châu | Tầng Trà Sương Sớm: hàng chè uốn lượn theo đồi, sương thấp nằm giữa các hàng. Tránh hàng thẳng gồm các khối tròn bằng nhau (lỗi bản trước). |
| 7 | Đèn lồng lụa Hội An | Đèn lồng: lụa mỏng phát sáng ấm, 2 dáng (tròn, quả trám), tua đỏ. Đây là điểm nhấn bão hòa nhất trên cây leo. |
| 8 | Cáo đỏ con | Cáo Lửa con: đầu to, tai to, mõm ngắn, má lông xù, ngực kem. |
| 9 | Chim sẻ xù lông | Chim Sẻ Mây: dáng tròn như quả bóng, bụng xốp → làm thành "bụng mây". |
| 10 | Bộ chậu đã duyệt + nền trời hiện tại (ảnh của game) | Chuẩn "cùng một thế giới": mọi asset mới đặt lên nền này cạnh chậu phải cùng tông, cùng nét kawaii (mắt hai điểm sáng, má hồng). Xem `renders/2026-11-17-chi-thi-08-buoc-0-bang-mau.jpg`. |

Lá ngược sáng (gân lộ, mép sáng) không tìm được ảnh tham khảo tốt. Tôi sẽ dựng trực tiếp bằng transmission 0,25 trên lá trong Bước 1.

## Bảng màu và ánh sáng

Xem `renders/2026-11-17-chi-thi-08-buoc-0-bang-mau.jpg`. Bảng màu gồm 14 màu:
- Mây: ngà / đào / lavender.
- Bóng: tím mát, không dùng đen hay xám.
- Lá: non / già.
- Vỏ cây và rãnh vỏ.
- Điểm nhấn: đèn lồng cam, hoa hồng, lúa vàng, ngọc.

Ánh sáng dùng chung `tools/potgen/style/studio_cream.json` với chậu, không tạo bộ đèn riêng.

## Cần CTO chốt trước Bước 1

1. **Rim light.** Trong file dùng chung, Rim hiện là xanh lạnh `#A9C8FF` từ sau-phải. Tiêu chí 2 lại muốn viền sáng vàng và bóng tím.
   - Đề xuất: đổi Rim thành vàng `#FFD27A` và thêm một đèn hắt tím `#B9A8D6` từ dưới. Việc này đổi luôn ánh sáng của chậu.
   - Nếu được duyệt, tôi render lại 6 chậu mẫu để so trước/sau, rồi mới áp cho cả thế giới.
   - Nếu không duyệt, giữ đèn hiện tại và chỉ thêm viền vàng bằng chất liệu (emission ở mép, tính theo góc nhìn).
2. **Bệ chậu.** Số ô chậu thay đổi theo từng tầng: `scene.ts` rải đều các ô trên bề ngang 940 điểm (`potRowSpan`), cộng ô "Thêm chậu".
   - Đề xuất: mặt tầng không vẽ bệ cố định. Bệ là ảnh rời trong atlas, code đặt bệ đúng tọa độ ô. Như vậy khớp với mọi số ô mà không đổi gameplay.
   - Nếu CTO muốn bệ vẽ liền vào tầng thì phải render một bản cho mỗi số ô (2, 4, 6, 8, 10).
3. **Danh sách thú cưng.** Chỉ thị 08 có 4 con: Mèo Mây, Cáo Lửa con, Rồng Ngọc con, Chim Sẻ Mây. Thay cho 6 con bản trước (Cún Sương, Thỏ Trăng, Rùa Ngọc, Cú Đêm bị bỏ).
   - Nội dung thú cưng của Đợt 5 sẽ theo danh sách mới.
4. **Lệch nhánh.** `origin/art/blender-pots` có hai commit Chỉ thị 06/07 (4e67f0a, 49bd996) không nằm trong `feat/cto-07-cho-may-giao-dien`. Phần `tools/potgen` của hai nhánh giống hệt nhau nên không ảnh hưởng việc dựng 3D.
   - Cần CTO xác nhận nhánh preview chuẩn là `feat/cto-07-cho-may-giao-dien`.

## Bước 1 sẽ nộp (sau khi duyệt)

- 3 đoạn cây leo ghép liền có lá rải, kèm ảnh phóng 200% ở chỗ nối.
- 1 tầng Đồng Mây Ngọc.
- 1 Mèo Mây.

Mỗi thứ nộp 2 ảnh: ảnh render riêng và ảnh đặt trên nền game ở 2388×1668. Kèm bảng chấm 8 tiêu chí.
