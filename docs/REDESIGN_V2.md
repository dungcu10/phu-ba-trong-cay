# Tái thiết kế v2 — Phú Bà Trồng Cây

Ngày 2026-11-16 · dựa trên `docs/research/2026-11-16-kvtm-doi-chieu.md` · thay thế các phần tương ứng của `GAMEPLAY_DESIGN.md` khi khác nhau.

Nguyên tắc: giữ nguyên lõi đang chạy (lưu, giờ game, BOT, đơn hàng, Sổ Tay); mọi tính năng mới là dữ liệu JSON + hệ thống thuần + lệnh `dispatch`, có bài kiểm tra; lưu cũ đọc được (migration 6→7). Mỗi nút có hành vi thật — không dựng màn hình minh họa.

## 1. Góc nhìn và phong cách

**Chính diện 2.5D** (không isometric — lý do ở mục 4 bản đối chiếu). Chiều sâu tạo bằng: lớp mây trôi phía sau và phía trước tầng, bóng đổ dưới chậu, ánh viền vàng ở chậu bậc cao, đồ treo lơ lửng phía trên hàng chậu, tầng phía trên mờ dần theo độ cao. Cổ tích sáng, ấm (ART_STYLE_GUIDE §8).

## 2. Cấu trúc khu vườn

### 2.1 Tầng mây
| Thuộc tính | Quy tắc |
|---|---|
| Ô chậu | Bắt đầu **6 ô**, mở rộng từng ô tới **10** bằng xu (`floors.json` → `expand.costs`). Chậu càng ít càng to: 6 ô = chậu to gấp ~1,35 lần 10 ô. |
| Sao tầng | 0–3 sao, hiện trên dây leo cạnh tầng. Mỗi sao: mọi chậu trên tầng **+5% tốc độ lớn, +5% XP**. Cần cấp + xu + nông sản (`floors.json` → `stars`). |
| Đặc tính tầng | Giữ như cũ (Vườn Trà: thảo mộc lớn nhanh; Ruộng Hoàng Kim: quả sai hơn). |
| Mở tầng | Giữ: cấp + xu, chạm tầng mờ phía trên. |
| Neo trang trí | Mỗi tầng có neo: 2 đầu tầng (đứng), 3 dây treo giữa các chậu. **Giai đoạn 5** — cần đồ họa. |
| Máy chế biến | Một máy mỗi tầng bên thân cây leo. **Giai đoạn 5** — cần đồ họa + hệ chế biến. |

Lưu cũ có 10 ô → coi như đã mở rộng hết, không mất gì.

### 2.2 Chậu
- **Bộ chậu** (`potsets.json`): *Đồ Cổ Mộc Đồng* (Gỗ Hồng Mộc, Đỉnh Đồng), *Gốm Sứ Cung Đình* (Sứ Men Lam, Sen Ngọc Bích), *Bảo Vật Trời Mây* (Mây Bông, Hũ Vàng). Chậu Đất Nung khởi đầu **không thuộc bộ nào** — thưởng bộ phải giành bằng cách mua và sắp chậu. Trên **một tầng**, đủ **4 chậu cùng bộ** → thưởng bộ bậc 1; đủ **6** → bậc 2. Thưởng bộ áp cho mọi chậu trên tầng đó.
- **Bậc ngoại hình theo cấp**: *Mộc* (cấp đầu), *Tinh* (từ 40% cấp tối đa: viền sáng vàng, đốm sáng), *Thần* (từ 75%: hào quang + đốm sáng bay quanh). Khi có ảnh riêng từng bậc, ảnh thay hiệu ứng tô.
- **Nâng cấp**: xu + Bọ Mây (đã có). Bảng chậu hiện **so sánh cấp hiện tại ↔ cấp sau** từng chỉ số, bộ chậu, tiến độ bộ trên tầng.
- **Sưu tầm**: Lò Gốm hiện mọi loại chậu, đã có/chưa có, bộ.

### 2.3 Cây
Hệ thống giữ 5 giai đoạn. Hoạt ảnh: nảy khi lên giai đoạn, đung đưa theo họ cây, nhún khi chín, **nở bung + vòng sáng khi thu hoạch**. Cây nhân hoá (mặt, má) là **đồ họa đợt mới** (`ART_STYLE_GUIDE §11.7`) — tên khung giữ nguyên `crops/<id>/<stage>` nên chỉ cần thay ảnh.

## 3. Tương tác

| Thao tác | Kết quả |
|---|---|
| Chạm "Hạt giống" | Mở **khay hạt** ở đáy màn hình (không che vườn). |
| **Kéo hạt từ khay** qua các chậu trống | Gieo vào từng chậu trống đi qua; hạt bay theo ngón tay. |
| Chạm hạt trong khay | Chọn hạt đó; vuốt qua chậu trống sẽ gieo hạt đó. |
| Vuốt ngang qua chậu | Bắt bọ → thu hoạch → tưới (như cũ). |
| Kéo dọc | Leo thân cây giữa các tầng (như cũ). |
| Chạm chậu đang lớn | Bảng chậu (so sánh cấp, bộ). |
| Chạm ô "+" cuối hàng | Mở rộng tầng (xác nhận giá). |
| Chạm sao trên dây leo | Nâng sao tầng (điều kiện + thưởng). |
| Bảng Phú Bà → "Ghé vườn" | **Thăm vườn BOT**: xem vườn của họ, chạm chậu khát để tưới giúp / bọ để bắt giúp. Mỗi hàng xóm nhận giúp tối đa 3 lần/ngày, mỗi lần được xu + XP. |

## 4. Nhiệm vụ ngày (mới)
3 nhiệm vụ mỗi ngày (ngày theo giờ game, múi giờ Việt Nam), rút từ `missions.json`: thu hoạch N, gieo N, bắt N bọ, giao N đơn, giúp hàng xóm N lần, bán N món. Tiến độ đếm từ sự kiện của lệnh. Nhận thưởng xu/XP/Ngọc Mây. Cả 3 xong → thưởng thêm.

## 5. HUD
Sửa tên tầng bị đè: tên tầng nằm trên tấm biển gỗ dưới hàng chậu (đã có), bỏ dòng tên dưới ô xu. Cột trái thêm **Nhiệm vụ** (có chấm đỏ khi có thưởng chờ nhận). Đáy giữa: khay hạt.

## 6. Thứ tự làm
- **Giai đoạn 3 (làm ngay)**: mục 2.1 (ô, mở rộng, sao), 2.2 (bộ, bậc ngoại hình, so sánh, sưu tầm), 2.3 hoạt ảnh thu hoạch, 3 (khay kéo-thả, thăm vườn BOT), 4, 5. Kèm migration 6→7 và kiểm tra.
- **Giai đoạn 4**: tự kiểm bằng ảnh chụp + kiểm tra tự động; sửa đến khi đạt.
- **Giai đoạn 5**: đồ họa đợt mới (cây nhân hoá, chậu theo bậc, đồ trang trí, máy), hệ trang trí, máy chế biến, hướng dẫn người mới có tay chỉ.
