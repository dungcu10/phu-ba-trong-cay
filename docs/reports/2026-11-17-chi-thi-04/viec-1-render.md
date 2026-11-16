# Chỉ thị 04 — Việc 1: render 50 chậu đặc trưng (dừng chờ duyệt)

Ngày 2026-11-17 · nhánh `art/blender-pots` (từ 3a12c89)

## Cách chạy — khác chỉ thị ở đâu

Chỉ thị yêu cầu render trên máy Windows của chủ dự án (Blender 5.2, GPU CUDA). Developer **không làm việc trên máy đó**: phiên làm việc là máy Linux trên mây, không có Blender, không GPU, không kết nối tới máy Windows. Đã làm thay:

| | Chỉ thị | Đã chạy |
|---|---|---|
| Blender | 5.2 (Windows) | **5.3.0**, gói `bpy` chính thức (PyPI), môi trường ảo riêng |
| Thiết bị | GPU CUDA | **CPU** (2 lõi) — script tự lùi về CPU khi không có GPU |
| Lệnh | `render_catalog.py -- --line …/signature_all.json --levels 1-50 --out tools/potgen/out` | giống hệt (chạy `python render_catalog.py` thay vì `blender -b -P`) |
| Cảnh | studio_cream, 96 mẫu, 1024 px, OpenImageDenoise | giống hệt |

Hình học, vật liệu, ánh sáng, camera không đổi. Nếu CTO cần đúng bản 5.2/CUDA cho đồng bộ với các atlas trước, chạy lại đúng lệnh trên máy Windows — script và JSON đã sửa nằm trong commit này.

## Kết quả

- `status.json` (bản sao trong thư mục này): `"state": "done"`, `done: 50`, `errors: []`, `device: "CPU"`, 1.397 giây (23 phút). Chậu chậm nhất: #50 Hồ Điệp Tiên 100 s, #26 Hoa Sen 63 s, #48 Ngai Vàng 58 s.
- Tờ xem trước: `signature_all_preview.jpg` (bản gốc `tools/potgen/out/signature_all/preview/signature_all.png`, không commit).
- Kiểm tra tự động: không chậu nào có điểm ảnh chạm mép khung 1024 px.
- `tools/potgen/out/` đã có trong `.gitignore`, không commit.

## Chậu lỗi ở lần render đầu và cách sửa

Lần đầu (ảnh `lan-1-truoc-sua.jpg`) cũng 50/50 không lỗi trong `status.json`, nhưng soi bằng mắt và đo mép khung thấy 2 lỗi thật:

| # | Chậu | Lỗi | Nguyên nhân | Sửa (trong `build_signature_all.py`, sinh lại JSON) |
|---|---|---|---|---|
| 35 | Rổ Tre Nón Lá | Thân rổ thành một tấm ván ngang phủ hết khung, cắt 2 bên | Hồ sơ `basket` 4 điểm có góc gãy; sau làm mượt, Solidify `use_even_offset` đẩy thành ra ±1.684 đơn vị (đo bằng hộp bao của lưới đã tính modifier) | Thêm điểm trung gian cho hồ sơ, giữ dáng rổ loe miệng; nón lá dựng nghiêng sau miệng rổ |
| 11 | Phi Hành Gia Mèo | Vành quỹ đạo chạm đáy khung (cắt) và thò xuống dưới mặt đất | Vành `scale 1.8` với góc nghiêng 72° gần như đứng | Thu vành còn 1,3, giữ nguyên góc và thiết kế mẫu đã duyệt |

Hai sửa này đổi `tools/potgen/tools/build_signature_all.py` (có ghi chú lý do ngay tại chỗ) và `tools/potgen/lines/signature_all.json` (sinh lại bằng script, không sửa tay). Đã render lại cả 50 để `status.json` và tờ xem trước là của một lượt chạy trọn vẹn.

## Chỗ yếu, chưa coi là lỗi — xin CTO/chủ dự án quyết

- **#35 nón lá:** nhìn chính diện thành mặt tròn có chóp, dễ hiểu hơn trước nhưng chưa thật rõ là nón lá.
- **#28 Quả Thông:** thân nâu chấm hạt, thiếu vảy thông xếp lớp — chi tiết nhận diện yếu ở cỡ nhỏ.
- **#21 Nấm Rừng Đỏ:** mũ nấm là vành đỏ phẳng nằm trên thân, nhìn hơi tách rời (mẫu đã duyệt từ trước, không sửa).
- **#22 Vỏ Sò Ngọc Trai:** phía trước hở thấy đất, dáng giống cốc hơn vỏ sò.

## Dừng ở đây

Theo chỉ thị: chưa đóng gói (việc 2), chưa gắn vào game (việc 3), chưa làm bản thử (việc 4) cho tới khi chủ dự án và CTO duyệt tờ xem trước.
