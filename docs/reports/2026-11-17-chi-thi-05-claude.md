# Chỉ thị 05 — phần của Claude thực thi

Ngày 17/11/2026.

1. **Gộp nhánh của CTO.** Đã gộp `feat/cto-05-can-bang-chau` vào `feat/nang-cap-v3` (commit c9cccbc), không có xung đột. Sau khi gộp: typecheck sạch, **120/120 test đạt**. Số này gồm `tests/signature-balance.test.ts` của CTO và bộ mô phỏng 365 ngày của Đợt 1.
2. **Render lại #9, #35, #47.**
   - Lấy thiết kế từ `art/blender-pots` @ 6829abf. Chạy `build_signature_all.py` cho ra JSON trùng khớp với bản đã commit.
   - Render `--levels 9,35,47` bằng bpy 5.3 trên CPU: 3/3 chậu, 92 giây, không lỗi (`docs/reports/2026-11-17-chi-thi-04/status_lan4_9-35-47.json`).
   - Đóng gói lại `pots_signature`: 4061×817, 559.778 byte WebP q90 (commit ee6f89d trên art/blender-pots). Đã gộp vào `feat/nang-cap-v3` ở commit ade3cff.
   - Ảnh xem trước: `docs/reports/2026-11-17-chi-thi-04/render-lai-9-35-47.jpg`.
   - Ảnh trong game (bản ade3cff): `docs/reports/2026-11-17-chi-thi-04/tang-sau-render-lai.png`.
3. **Nhận xét từng chậu:**
   - #47 Đèn Thần: nay có thân cao, có cổ, có vòi và tay cầm, nhìn ra đèn thần. Đạt.
   - #9 Sushi: lát cá hồi dày và cong hơn bản trước, nhìn ra miếng cá. Chấp nhận được.
   - #35 Rổ Tre Nón Lá: hết bị nhìn như quả cầu, nhưng nón giờ là một miếng tam giác phẳng gác trên miệng rổ, **chưa thấy rõ hình nón**. Đề xuất: giảm `scale` z của nón ít hơn (ví dụ `[0.5, 0.5, 0.5]`) và nghiêng thêm khoảng 10°.
4. **Bộ nhớ texture:** khi đo bằng nút "Đo hiệu năng" với cảnh 10 chậu đặc trưng, sau khi gộp phần nạp atlas khi cần của CTO thì texture còn 65,6 MB (trước là 95,1 MB). FPS ngang bản trước khi đo trên cùng máy vẽ bằng phần mềm.
