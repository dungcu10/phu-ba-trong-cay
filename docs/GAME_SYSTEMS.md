# GAME_SYSTEMS.md — LUẬT TỔNG CHO CLAUDE THỰC THI (đọc trước mọi chỉ thị)

Phiên bản 2.0 · 18/11/2026 · Người ban hành: CTO/Game Director, chủ dự án đã duyệt.
Đặt trong kho tại `docs/GAME_SYSTEMS.md`. **File này thắng mọi chỉ thị khi hai bên mâu thuẫn về cách làm việc.** Về nội dung tính năng thì chỉ thị mới hơn thắng.

---

## 0. MỤC TIÊU DUY NHẤT

**Phát hành sớm nhất một game nông trại trên mây chạy tốt trên iPad Pro M2, khi tắt máy vẫn tính đúng, và cuốn người chơi 3–4 phiên mỗi ngày, mỗi phiên 10–15 phút.**

Mọi quyết định đều so với câu này. Việc nào không làm game hay hơn, ổn định hơn hoặc ra sớm hơn thì **không làm**.

---

## 1. THỨ TỰ CÔNG VIỆC (không đổi)

1. **Chỉ thị 10:** làm nốt M5–M10, kèm sửa các lỗi D1–D6 ở phần A của chỉ thị 11 TỔNG.
2. **Chỉ thị 11 TỔNG:** làng, bầu trời 20 tầng, thú cưng.
3. **Chỉ thị 12 TỔNG:** cân bằng, chợ đặt lại, trộm vườn, Phú Bà động, chống lạm phát, tối ưu thao tác.
   - Những mục chỉ cần chỉnh số trong dữ liệu thì **làm ngay khi đang ở phần kinh tế** của chỉ thị 10 hoặc 11, không chờ tới lượt chỉ thị 12.

Được làm song song: xử lý ảnh (tách nền, cắt, gom atlas), vì không đụng vào lõi game.

---

## 2. KHI GẶP MÂU THUẪN HOẶC CHỖ CHƯA RÕ: TỰ QUYẾT, KHÔNG HỎI

Dùng thứ tự ưu tiên sau để tự quyết:

1. **Không mất save của người chơi.**
2. Không phá vỡ luật chơi tất định và tính bù khi tắt máy.
3. Chỉ thị mới hơn thắng chỉ thị cũ.
4. Số liệu: theo kết quả mô phỏng (mục 6), không theo con số gợi ý trong chỉ thị.
5. Giao diện: dùng thành phần có sẵn trong `theme-fantasy.css`, không thiết kế mới.
6. Vẫn chưa rõ: chọn cách **đơn giản nhất mà vẫn đạt tiêu chí nghiệm thu**, ghi 1 dòng vào báo cáo ở mục "Quyết định tự chọn", rồi làm tiếp.

**Chỉ dừng lại hỏi khi:** phải xóa dữ liệu người chơi, phải đổi giá hạt giống hoặc giá bán nông sản, hoặc phải thêm một loại tiền mới.

---

## 3. LUẬT CỨNG (vi phạm thì không được merge)

| # | Luật |
|---|---|
| L1 | Code chạy tất định, theo seed. Mọi thứ có thời gian (cây lớn, chim bắt bọ, xưởng, việc vặt, nâng nhà) phải **tính bù đúng khi tắt máy**. |
| L2 | **BOT dùng chung code và luật với người chơi.** Không viết luồng code riêng cho BOT. Chim và thú cưng phải gọi đúng `catchBug` và `harvest` như người chơi. |
| L3 | Mọi con số nằm trong `content/base/*.json`. Code không viết cứng con số. |
| L4 | Tăng `SAVE_VERSION` thì phải có migration kèm test. **Không xóa** xu, chậu, bọ, vật phẩm mà người chơi đang có. |
| L5 | Không nạp tiền, không quảng cáo. Không phạt người chơi khi vắng mặt: không làm chết, không làm mất, không làm giảm. |
| L6 | Không dùng tên, hình, chữ của game khác. Chép cơ chế thì được. |
| L7 | **Không tự vẽ hình.** Chỉ được tách nền, cắt, phóng to, chỉnh màu và vẽ hiệu ứng bằng code. Thiếu hình thì dùng hình tạm, ghi vào CẦN HÌNH, và **làm tiếp, không chờ**. |
| L8 | Không thêm loại tiền mới. Mỗi vật phẩm mới phải gắn vào một tài nguyên đã có ở mục 5. |
| L9 | Mở rộng hệ có sẵn trước khi tạo hệ mới. |

---

## 4. NHỮNG VIỆC ĐƯỢC BỎ ĐỂ RA SỚM

Các yêu cầu sau trong chỉ thị cũ **được bỏ hoặc làm gọn** để tiết kiệm thời gian:

| Yêu cầu cũ | Làm thế này thay vào |
|---|---|
| Moodboard, mẫu thử Blender, chờ CTO duyệt từng bước | **Bỏ.** Hình đã có đủ trong `PhuBa_BoHinh_v1`. |
| Quay video hoặc ảnh động khi nộp | **Bỏ.** Chỉ cần ảnh chụp (mục 7). |
| Mô phỏng 3 kiểu người chơi cho mỗi thay đổi | Mỗi lần thay đổi chỉ chạy **1 kiểu (2 giờ vào 1 lần, 30 ngày)**. Chạy đủ 3 kiểu chỉ khi nộp một chỉ thị. |
| Gửi CTO duyệt 16 tên tầng, danh sách tên Phú Bà | **Tự đặt**, ghi vào báo cáo. CTO sửa sau nếu cần. |
| Gửi CTO duyệt từng mốc (M1, M2…) | **Bỏ.** Tự kiểm bằng test và mô phỏng, tự merge (mục 8). CTO chỉ nghiệm thu khi xong cả chỉ thị. |
| Chờ hình cây mới mới làm | Làm dữ liệu, lõi và test với hình tạm. Khi có hình thì chỉ thay hình. |
| Báo cáo dài, nhiều file `docs` mới | Gộp hết vào **1 file báo cáo** cho mỗi chỉ thị (mục 7). `FEATURE_WEB.md` và `economy-*.md` sinh tự động bằng script. |
| Lời nhắn "đo trên iPad thật" | Đo bằng nút "Đo hiệu năng" và Chrome có giới hạn CPU. Chủ dự án sẽ đo trên iPad thật sau. |
| Tối ưu chi tiết giao diện (UI/UX) | Chỉ sửa các lỗi chữ đè, nút che nhau. Phần làm đẹp giao diện để **đợt sau**. |

---

## 5. HỆ THỐNG GAME — BẢN ĐỒ GỌN

### 5.1. Ba vòng chơi
- **Vòng lõi** (vài giây đến 2 phút): gieo, thu, bán hoặc giao.
- **Vòng phiên** (10–15 phút): thu cả vườn, giao đơn, đi chợ, ghé và trộm vườn, chăm chim và thú cưng, nâng một thứ.
- **Vòng dài** (ngày, tuần, tháng): nhiệm vụ, Lộc Phiên, giải tuần, sự kiện, sưu tập, mở tầng.

### 5.2. Năm trục tiến bộ
Mỗi trục phải **luôn hiện mốc kế tiếp kèm số còn thiếu**.

| Trục | Tài nguyên chính |
|---|---|
| Cấp Phú Bà | Kinh nghiệm |
| Độ cao (tầng) | Xu, Sợi Mây, Giọt Sương |
| Sức mạnh vườn (cấp, sao, bộ chậu) | **Sâu bọ**, mảnh chậu |
| Làng (cấp nhà) | Nguyên liệu từ mọi hệ |
| Sưu tập (các sổ, huy chương) | Đồ hiếm |

### 5.3. Tài nguyên
Mỗi tài nguyên khai báo `source`, `mainSink`, `sideSinks` (tối đa 2), `rarity` trong dữ liệu.

| Tài nguyên | Chỗ tiêu chính | Giới hạn |
|---|---|---|
| Xu | Chợ đặt lại, nhà, tầng | `Xu/U` trong khoảng 1–5 |
| Ngọc (kiếm trong game) | Chim, thú cưng | 6–10 mỗi ngày |
| Nông sản | Đơn, Xưởng | Kho Nông Sản có giới hạn |
| Sâu bọ | Nâng chậu | Tồn kho ≤ 5 ngày nhu cầu |
| Sợi Mây, Giọt Sương | Mở tầng | Theo chi phí tầng |
| Khoáng sản | Đúc chậu | Năng Lượng Gió |
| Mảnh chậu | Ghép chậu, sao chậu | 10 mảnh = 1 chậu |
| Huy Hiệu, Mảnh Trứng Rồng | Sao thú cưng, Rồng | — |
| Điểm sự kiện | Mốc sự kiện | Hết hạn khi sự kiện kết thúc |

### 5.4. Độ hiếm dùng chung
Một file duy nhất `content/base/rarity.json`, mọi bảng rơi đồ tham chiếu vào đó.

| Độ hiếm | Màu | Tỉ lệ gốc | Tần suất người chơi vừa gặp |
|---|---|---|---|
| Thường | xám | 60% | Mỗi phiên |
| Khá | xanh lá | 26% | Vài lần mỗi phiên |
| Hiếm | xanh dương | 10% | 1–3 lần mỗi ngày |
| Sử Thi | tím | 3,5% | 2–3 lần mỗi tuần |
| Huyền Thoại | vàng | 0,5% | 1–2 lần mỗi tháng |

---

## 6. CỔNG KIỂM TRA TỰ ĐỘNG (thay cho việc chờ CTO duyệt từng bước)

Viết **một lệnh duy nhất** `npm run check`. Lệnh này chạy lần lượt: typecheck, toàn bộ test, kiểm tra dữ liệu (`validate-content`), build, và mô phỏng nhanh (1 kiểu người chơi, 30 ngày). Mô phỏng in ra bảng dưới đây và **trả lỗi nếu chỉ số nào ra ngoài khoảng**.

| Chỉ số | Khoảng đạt | Hiện tại (CTO đo ngày 18/11) |
|---|---|---|
| Cấp ngày 1 / 7 / 30 | 5–6 / 13–15 / 25–28 | 8 / 32 / 54 |
| Mốc tiến bộ mỗi ngày (ngày 10–30) | ≥ 2 | 1 |
| `Xu/U` | 1–5 | 10–24 |
| Bọ Thường mỗi ngày | 40–70 | khoảng 1.500 |
| Bọ Rất hiếm | 1 con mỗi 3–5 ngày | khoảng 60 con mỗi ngày |
| Chậu chữ ký sở hữu ngày 30 | 10–15/50 | 50/50 (từ ngày 7) |
| Thời gian kho đầy | < 20% | gần 100% |
| Đơn giao mỗi ngày | 10–20 | gần 0 |

- Nếu chỉ số nằm ngoài khoảng mà chưa tới chỉ thị chịu trách nhiệm chỉ số đó, thì **in cảnh báo, không chặn**. Ví dụ chỉ số chậu chỉ chặn từ chỉ thị 12.
- **Sửa bot mô phỏng trước tiên** (`tools/progression.ts`): bot phải biết giao đơn, đi chợ, ghé vườn, giống người chơi thật. Bot không giống người thật thì mọi chỉ số đều vô nghĩa.

---

## 7. BÁO CÁO KHI NỘP MỘT CHỈ THỊ (1 file, gọn)

File: `docs/reports/chi-thi-<số>.md`. Gồm đúng 6 mục:

1. **Kết quả `npm run check`**: dán nguyên bảng chỉ số.
2. **Bảng mốc**: tên mốc, xong hay chưa, commit.
3. **Quyết định tự chọn**: mỗi quyết định 1 dòng (mục 2).
4. **Lệch khỏi chỉ thị**: lệch gì và vì sao, mỗi điểm 1 dòng.
5. **CẦN HÌNH**: những gì đang dùng hình tạm.
6. **Tối đa 6 ảnh chụp**, khung 2388×1668, chụp những màn quan trọng nhất của chỉ thị đó, cộng link bản thử.

---

## 8. MERGE

- **Được tự merge vào `main`** sau mỗi mốc, với điều kiện `npm run check` xanh **và** save cũ mở được.
- Mỗi lần merge: thêm 1 dòng vào `CHANGELOG.md` và gắn tag `m-<chỉ-thị>-<mốc>`.
- Merge xong thì bản thử gh-pages tự cập nhật (đã có sẵn trong CI).

---

## 9. CÁCH ĐỌC MỘT CHỈ THỊ ĐỂ LÀM ĐÚNG NGAY LẦN ĐẦU

1. Đọc **tiêu chí nghiệm thu** của chỉ thị trước, rồi mới đọc phần mô tả. Viết test cho tiêu chí trước khi viết code.
2. Phân biệt rõ ba loại câu trong chỉ thị:
   - **"Bắt buộc", "Cấm", "Không"**: làm đúng nguyên văn.
   - **Con số gợi ý**: là điểm bắt đầu, phải chỉnh lại bằng mô phỏng.
   - **"Ví dụ"**: chỉ để hiểu ý, không cần làm giống hệt.
3. Có sẵn hàm hoặc hệ làm được việc đó thì dùng lại. Tìm trong code trước khi viết mới: `src/systems/*`, `src/core/game.ts`, `content/base/*`.
4. Mỗi lần commit chỉ làm một việc. Ghi rõ mốc trong tiêu đề commit.
5. Không làm thêm những gì chỉ thị không yêu cầu. Ý tưởng hay thì ghi vào mục "Ý tưởng" trong báo cáo.

---

## 10. Ý TƯỞNG ĐỂ DÀNH CHO SAU KHI PHÁT HÀNH (không làm bây giờ)

Ghi lại để CTO lên lịch sau, theo thứ tự ưu tiên:
1. Thời tiết
2. Lai giống
3. Triển lãm chậu
4. Mùa giải miễn phí
5. Dinh Phú Bà
6. Chuyện Phú Bà
7. Hội Phú Bà
8. Chế độ khó

Mỗi bản cập nhật sau phát hành là một **gói nội dung** `content/<mua>/`, gồm 3–4 cây, 1–2 bọ, 1 dòng hoặc bộ chậu, 1 sự kiện. Gói phải qua `npm run check` mới được phát hành.