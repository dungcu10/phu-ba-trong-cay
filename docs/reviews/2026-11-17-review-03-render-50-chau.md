# REVIEW 03 — Tờ xem trước 50 chậu đặc trưng (chỉ thị 04, việc 1) · 17/11/2026

Kiểm tra: `docs/reports/2026-11-17-chi-thi-04/signature_all_preview.jpg` @ 5d6f7af, cùng bản sửa review 02 trên `feat/full-loop` (5add773, df900ef).

**Điểm: 8/10.** Bộ chậu đạt hướng đã duyệt. Mỗi chậu một dáng; nhóm Thần thoại và Gốm Á Đông đẹp nhất. 38/50 chậu đạt ngay.

## Về cách làm của Claude thực thi
- Render bằng `bpy` 5.3 CPU trên máy mây thay vì Blender 5.2/CUDA trên máy chủ dự án. **Chấp nhận**: cùng cảnh, cùng script, kết quả tương đương. Ghi chú này phải nằm trong ASSET_SOURCES.
- Tự phát hiện và sửa #35, #11, có đo đạc, ghi lý do ngay trong script. **Tốt.**
- Review 02: đã sao lưu save trước khi nâng cấp, có test v4/v7, có nút Đo hiệu năng, biểu tượng Lò Gốm dùng hình cấp cao. **Đạt.** Chủ dự án có thể bấm "Cập nhật" trên bản thử.

## Lỗi hình — CTO đã sửa thiết kế trong `build_signature_all.py` và `potlib.py`
| # | Chậu | Lỗi | Sửa |
|---|---|---|---|
| 3 | Kem Ốc Quế | Kem là vành phẳng, nhìn như mũ | Vòng 11 viên kem tròn quanh miệng |
| 9 | Sushi Cá Hồi | Cá hồi là vành tròn lơ lửng | Lát cá hồi nghiêng phủ nửa sau, có vân trắng |
| 12 | Cáo Chín Đuôi | 9 đuôi trắng dính thành quả cầu trên nền kem | Đuôi hẹp hơn, đầu đuôi xanh đậm |
| 18 | Ếch Lá Sen | Mắt chìm trong thân, trông như cái đĩa | Mắt lồi trên miệng chậu |
| 19 | Cú Mèo | Lông bụng (tiles) không hiện | 3 hàng lông chúc xuống |
| 28 | Quả Thông | Vảy (tiles) không hiện, chỉ là hũ nâu | 6 vòng vảy so le chúc xuống |
| 35 | Rổ Tre Nón Lá | Nón thành quả trứng | Khối nón thẳng, không làm mịn |
| 45 | Long Cung | San hô như sừng hươu | Quạt san hô phía sau + rong biển |
| 47 | Đèn Thần | Thân quá dẹt, như đĩa nước sốt | Thân cao hơn |

Khối nón đổi nên 17, 24, 43 (mỏ, pha lê, vương miện) cũng phải render lại.

## Còn yếu, để đợt sau (không chặn)
- #21 mũ nấm hơi tách khỏi thân.
- #22 vỏ sò giống cốc.
- #50 cánh bướm hơi bệt.
- #4 Donut và #7 Macaron hơi thấp, nhỏ ở cỡ trong game.
