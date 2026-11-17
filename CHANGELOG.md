# CHANGELOG.md — PHÚ BÀ TRỒNG CÂY

> Nhật ký mọi thay đổi. Developer **phải** ghi vào đây sau mỗi lần giao việc, trước khi báo cáo.
> Mục mới nhất ở trên cùng. Mục chưa nghiệm thu nằm dưới `[Chưa phát hành]`.

## Quy ước

Mỗi mục ghi theo mẫu:

```
### [YYYY-MM-DD] Tên nhiệm vụ — Giai đoạn X
- Loại: Thêm / Sửa lỗi / Thay đổi / Tối ưu / Gỡ bỏ / Bảo mật dữ liệu
- Mô tả: ...
- File/Module: ...
- Ảnh hưởng save: Không / Có (saveVersion cũ → mới, đã có migration)
- Kiểm thử: lệnh/cách thử + kết quả
- Trạng thái nghiệm thu: Chờ / Đạt / Không đạt (lý do) — do CTO điền
```

Phân loại:
- **Thêm** — tính năng mới
- **Sửa lỗi** — ghi kèm mức P0–P3
- **Thay đổi** — thay đổi hành vi tính năng đã có
- **Tối ưu** — hiệu năng, ghi số liệu trước/sau
- **Gỡ bỏ** — tính năng/tài nguyên bị bỏ
- **Bảo mật dữ liệu** — liên quan lưu trữ/save

---

## [Chưa phát hành]

### [2026-11-18] CTO — Bật 3 núm A6.4–A6.5 và cân lại (tag `m-cto-cay-trong-2`)
- Hoa Trăng Non lớn nhanh ×1,5 ban đêm (đề xuất ×2 làm nó lời nhất mọi kiểu chơi). Giá bán Hoa Trăng Non 260, XP 75.
- Thông Thạo: ★1 +2% sản lượng, ★2 +3% XP, ★3 +3% may mắn, ★4 +3% sản lượng.
- Cây Hot: đơn có cây Hot +20% xu. **Giá bán ở Rương giữ nguyên (sellBonus 0)**: +30% làm giá Rương mua lại cao hơn giá Chợ, tạo vòng mua ở Chợ bán vào Rương ra lãi (test market đỏ).
- Bù: xpExponent 2,9, Cà Chua Bi XP 8, Bạc Hà Mây XP 14, Ve Ngọc ×1,25.
- Cổng số liệu XANH (cấp 5/15/26, Bọ Rất hiếm 0,29, chậu chữ ký 14, đơn 13,3).
- `tests/world.test.ts`: tiền khinh khí cầu so với `flightFor` (có thưởng Cây Hot) thay vì `order.coins`.
### [2026-11-18] B6 phần code — chỗ tiêu bọ lặp lại: Xưởng tốn bọ thợ, bán bọ cho thương lái; tăng tốc BOT (tag `m-12-b6-code`)
- Loại: Thêm / Tối ưu
- Mô tả: (1) mỗi mẻ Xưởng tốn bọ thợ của máy — trường mới `workerBugs` trong công thức (`workshop.json`, sinh bởi `tools/make-workshop.py`, đang là 1), thiếu bọ thì không làm được, cửa sổ Xưởng hiện bọ thợ như một nguyên liệu. (2) Bán bọ cho thương lái BOT: trường mới `neighbors.json` → `market.bugTrader` { factor 0,5, rarityValue thường 30 / khá 80 / hiếm 250 / rất hiếm 800 } — giá = `market.values` (Bọ Rùa 30) hoặc theo độ hiếm, × factor; lệnh `sellBugs`; Rương Mây có nút "Bán cho thương lái". (3) Cho thú cưng ăn bọ: để tới khi làm thú cưng (chỉ thị 11).
- Tối ưu: 40 BOT × 7 ngày 142 → 109 ms (máy này) — chim BOT dùng một lần băm mỗi phiên rồi sinh số kế tiếp, BOT tự bắt bọ dùng danh sách chậu nhớ theo ngày, vườn BOT cho luật chim/bọ chỉ dựng cây (`botCrops`, cùng khóa ngẫu nhiên với `botGarden`, có test trùng khớp).
- **Cho CTO:** chưa đổi số nào cũ; ba số mới (`workerBugs` 1, `bugTrader.factor` 0,5, `rarityValue`) chờ CTO chỉnh qua mô phỏng. Bot mô phỏng (`tools/progression.ts`) chưa bán bọ.
- File/Module: `src/systems/{workshop,neighbors,botBirds,visit}.ts`, `src/core/{content,game}.ts`, `src/ui/{workshopPanel,panels}.ts`, `src/app/controller.ts`, `content/base/{workshop,neighbors}.json`, `tools/make-workshop.py`
- Ảnh hưởng save: Không.
- Kiểm thử: `tests/workshop10.test.ts` (+ bọ thợ), `tests/bugSinks12.test.ts`, `tests/botBirds11.test.ts` (+ vườn rút gọn trùng khớp). `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Bổ sung A6.4–A6.5 phần code — Hoa Trăng Non ban đêm, Thông Thạo, Cây Hot (tag `m-12-a6-code`)
- Loại: Thêm
- Mô tả: `content/base/crop-extras.json` (file mới của luồng tính năng; `crops.json` là của CTO) + `src/systems/cropExtras.ts`. Cây lớn nhanh ban đêm (cộng với đặc tính đêm của Vườn Trăng, tắt game vẫn đúng); Thông Thạo 5 sao theo số lần thu hoạch, thưởng đi qua `slotBonus` nên chịu trần; Cây Hot mỗi ngày (theo seed và ngày): giá bán và đơn có cây Hot được cộng; khay hạt có nhãn "Hot hôm nay", Sổ Tay hiện sao Thông Thạo và số lần còn thiếu. Test A6.6 "mỗi cây ≥ 3 công dụng".
- **Cho CTO — 3 núm để trung tính** (`crop-extras.json`, số đề xuất trong `_proposed`): bật riêng từng núm đã làm lệch cổng (Trăng Non đêm: cấp ngày 7 = 16, Rất hiếm 0,17; Thông Thạo: cấp ngày 1 = 4; Hot: Rất hiếm 0,04). Cổng hiện rất nhạy (lệch 1 cấp / vài con bọ là trượt) — đề nghị CTO cân lại khi bật.
- File/Module: `content/base/crop-extras.json`, `src/systems/{cropExtras,growth,modifiers,economy,orders}.ts`, `src/ui/{gardenPanels,worldPanels}.ts`, `tests/cropExtras12.test.ts`
- Ảnh hưởng save: Không.
- Kiểm thử: `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] CTO — B6: đo bọ theo chậu và đo bọ tồn trong túi (chủ dự án duyệt)
- Thay chỉ số "Bọ Thường mỗi ngày 40–70" (không thể đạt vì bọ tăng theo số chậu) bằng 2 chỉ số: Bọ Thường mỗi chậu mỗi ngày 1–2 (chặn, đo được 1,39) và Bọ tồn trong túi ngày 30 tính bằng số ngày bắt, tối đa 5 (cảnh báo, đo được 20,6).
- Bot mô phỏng nâng sao Xưởng Bọ khi dư xu. Ngày ghi thêm `bugStock`, `commonBugsPerPot`.
- File: `tools/progression.ts`, `tools/check-metrics.json`, `tools/check.ts` (thêm 2 dòng đo, không sửa phần khác).
- Phát hiện: bọ tồn tăng ~250 con/ngày (ngày 30: 3.536, ngày 60: 11.931). Chỗ tiêu bọ hiện chỉ là nâng sao máy (dùng 1 lần). Cần chỗ tiêu bọ lặp lại, xem chỉ thị cho luồng thực thi.
### [2026-11-18] Chỉ thị 10 M6 (phần 2) — Đơn hàng khinh khí cầu, chim dẫn đường, nhờ hàng xóm; công thức Xưởng cho 14 cây (tag `m-10-m6`)
- Loại: Thêm / Thay đổi
- Mô tả: gửi đơn thì hàng đi ngay, XP cộng ngay (lời cảm ơn của khách), khinh khí cầu bay đi `refillSeconds` rồi mang xu/ngọc/vật phẩm về (tắt game vẫn đúng). Chim dẫn đường (cấp 11): đi cùng tới khi về, không bắt sâu khi đi, cộng thưởng theo loài. Đơn có hàng chế biến (thưởng thêm theo sao máy), đơn hiếm có hạn và vật phẩm thưởng, thêm ô đơn theo cấp, nhờ hàng xóm góp hàng mỗi ngày 1 lần (cấp 13). Bảng Đơn: ô đang bay, hàng chọn chim, nút "Nhờ góp", hạn đơn quý. Ô số lượng đọc được trên giao diện tối (lỗi cũ). Xưởng: công thức cho cây mới của CTO (Hồng Mây, Hướng Dương, Táo, Đào Tiên, Cải Mây) và Máy Mài Ngọc nhận Hoa Trăng Non / Cỏ Sao Băng.
- **Cho CTO — 4 núm kinh tế mới trong `orders.json` để trung tính** (code và test đã đủ, test dùng số riêng): `goodsShare` 0 (đề xuất 0,4; cần bot mô phỏng biết dùng Xưởng — bật lên thì bot bỏ đơn có hàng chế biến, bọ người chơi 40 → 27/ngày); `rareHours` chưa đặt (đề xuất 24; bật lên đổi chuỗi đơn, Bọ Rất hiếm 0,21 → 0,13 — chỉ số này dựa trên ~6 con/30 ngày nên rất nhạy); `extraSlots` [] (đề xuất 7/8/9 ô ở cấp 10/15/20; bật lên đơn/ngày ~23); `rareItems` [] (đề xuất Sợi Mây Kết, Giọt Sương Trời; bật lên cấp ngày 7 = 16).
- File/Module: `src/systems/orders.ts`, `src/core/{game,state,content}.ts`, `src/persistence/reconcile.ts`, `src/ui/worldPanels.ts`, `src/app/controller.ts`, `content/base/{orders,workshop}.json`, `tools/make-workshop.py`
- Ảnh hưởng save: Không đổi phiên bản. Ô đơn và khinh khí cầu đang bay được giữ khi đọc save (trước đây bước đọc save cắt về 6 ô — đã sửa, có test).
- Kiểm thử: `tests/orders10.test.ts` (7 bài), `tests/world.test.ts` cập nhật (xu về cùng khinh khí cầu). `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Gộp A6 dữ liệu (CTO) + D1: chỉnh tỉ lệ bọ BOT, sửa BOT thuê chim sai họ
- Loại: Sửa lỗi (P2) / Thay đổi
- Mô tả: BOT chỉ thuê loài chim có họ cây đang trồng trong vườn (hoặc không giới hạn họ), mỗi phiên dời chim tới tầng có nhiều cây hợp họ nhất trong ngày (vườn dựng đổi cây mỗi ngày) — trước đó chim có thể bắt 0 bọ. `birds.json` `rules.bots.growingShare` 0,35 → 0,45 theo nền 14 cây: BOT cấp 11–15 38,5 bọ/ngày, người chơi 40,0 (tỉ lệ 0,96). Không sửa crops/config.
- File/Module: `src/systems/{botBirds,neighbors}.ts`, `content/base/birds.json`, `tests/botBirds11.test.ts` (thêm test "chim nào cũng bắt được bọ")
- Ảnh hưởng save: Không.
- Kiểm thử: `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] CTO — Chỉ thị 12 A6 phần dữ liệu: 14 giống cây (tag `m-cto-cay-trong-1`)
- Thêm 8 cây mới vào `content/base/crops.json`: Hồng Mây (5), Táo Trời (7), Cải Mây (8), Hướng Dương Nắng (11), Hoa Trăng Non (12, Kỳ Hoa), Bí Vàng (14), Cỏ Sao Băng (16, Kỳ Hoa), Đào Tiên (20). Giá trị theo công thức A6 (kL × t^0,75 × hệ họ).
- Hình: cắt 8 bảng cây của chủ dự án thành 5 giai đoạn + biểu tượng, gói vào `assets/art/sprites.png/json` (atlas 2048×2304, 99 khung). Không vẽ thêm.
- Cân bằng: mỗi kiểu chơi có cây tốt nhất riêng (ghé 1 phút Cà Chua Bi, 15 phút Dâu Mây, 2 giờ Đào Tiên). Ve Ngọc trên cây ≥ 3 giờ (0,06–0,25). XP đầu game tinh chỉnh; `xpExponent` 2,85.
- Bot mô phỏng chỉ nhận đơn trồng kịp trong khoảng giữa 2 lần ghé. Chậu chữ ký hiếm đổi bằng 22 Đất Sét + 1 Ấn.
- Cổng số liệu `npm run check`: XANH (cấp 5/15/27, Bọ Rất hiếm 0,21/ngày, chậu chữ ký 12, đơn 12,5/ngày, kho đầy 0).
- Còn đỏ 2 test của luồng thực thi (`tests/botBirds11.test.ts`): BOT thuê chim không hợp họ cây trên tầng của nó nên chim bắt 0 bọ.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Gộp kinh tế G2 phần 1 của CTO vào main + chỉnh D1 theo nền bọ mới
- Loại: Thay đổi
- Mô tả: nhánh `feat/cto-kinh-te-1` gộp với Xưởng Bọ (PR #8) qua nhánh `feat/gop-cto-kinh-te-1` (merge, không ghi đè lịch sử). Sau khi bọ giảm ~20 lần, test "chim BOT ±20% chim người chơi" không còn đúng ý tiêu chí D1, vì chim người chơi tranh bọ với chính người chơi. D1 nay so **tổng bọ** của BOT (tự bắt + chim) với **tổng bọ** của người chơi vừa cùng tầm cấp: BOT thêm `botCatchBugs` (bắt phần bọ đậu trên vườn trong mỗi phiên mà chim chưa bắt, cùng tỉ lệ sinh bọ, cùng cách chọn loại); `birds.json` `rules.bots.growingShare` 0,6 → 0,35 (đo từ người chơi 2 giờ/lần). Kết quả: BOT cấp 11–15 26,8 bọ/ngày, người chơi 25,5 bọ/ngày. Bộ nhớ đệm vườn BOT nay theo cả cấp BOT (trước dùng chéo giữa hai ván cùng seed).
- File/Module: `src/systems/{botBirds,neighbors}.ts`, `content/base/birds.json`, `tests/botBirds11.test.ts`
- Ảnh hưởng save: Không.
- Kiểm thử: `npm run check` XANH; chỉ số kinh tế của CTO giữ nguyên (cấp ngày 1/7/30 = 5/15/27, đơn 18,7/ngày, chậu chữ ký 13, Rất hiếm 0,25/ngày).
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 10 M6 (phần 1) — Xưởng Bọ (tag `m-10-m6a`)
- Loại: Thêm
- Mô tả: 4 máy (Máy Sấy Hoa cấp 6, Nồi Mứt 7, Máy Ép Nước 10, Máy Mài Ngọc 16), bọ thợ là hình bọ đã duyệt; hàng chờ 2 khe (mua tới 4), chạy nối tiếp, vẫn chạy khi tắt game; thành phẩm tự vào Rương Mây, kho đầy thì chờ trong máy; nâng sao 1–5 bằng bọ thợ + xu (nhanh hơn 5%/sao). Hàng chế biến là loại vật phẩm mới, bán được, giá = 1,5 × nông sản đầu vào (trần 1,6). Công thức theo cây (bổ sung A6.3), sinh bằng `tools/make-workshop.py` từ `crops.json` (chỉ đọc). Cửa sổ độc lập `openWorkshop()`, nút "Xưởng" tạm ở thanh trái (mở ở cấp 6). "Đá Quý Mài" đổi tên thành "Ngọc Mây".
- File/Module: `content/base/workshop.json` (mới), `src/systems/workshop.ts`, `src/ui/workshopPanel.ts`, `src/core/{content,game}.ts`, `tools/make-workshop.py`, `tools/make-quests.py`
- Ảnh hưởng save: Không đổi phiên bản (trường `workshop` đã có từ save 12).
- Kiểm thử: `tests/workshop10.test.ts` (6 bài: trần giá, khóa cấp, hàng chờ nối tiếp, tắt game 8 giờ = liên tục, kho đầy không mất, nâng sao). `npm run check` XANH.
- Ghi chú cho CTO: Máy Sấy Hoa tạm có công thức Cúc Bông Gòn cho tới khi có Hồng Mây (cấp 5); chạy lại `python3 tools/make-workshop.py` sau khi thêm cây. Ở D1 em đã sửa `tools/progression.ts` (bot nuôi chim) trước khi có PHAN_CONG.md; từ nay không đụng file này.

### [2026-11-18] CTO — Luồng kinh tế G2 phần 1: bot mô phỏng, đường cấp, bọ, chậu hiếm, đơn (tag `m-cto-kinh-te-1`)
- Loại: Thay đổi / Cân bằng (chỉ thị 12 TỔNG A1, B6, B7 phần số liệu; PHAN_CONG.md luồng CTO)
- Mô tả: bot mô phỏng trồng theo đơn đang mở và bỏ đơn không làm được (trước: 0 đơn/ngày, nay ~19); đường cấp xpBase 3, xpExponent 2.8, xpGrowthUntil 25 (ngày 1/7/30 = cấp 5/15/27, vẫn lên cấp cả năm); bọ: growSecondsPerBug 25.000, tối đa 2 con/vụ, trọng số Khá 18, Bọ Hung 2,5, Đom Đóm 3, Ve Sầu 0,5 (Rất hiếm ~1 con/4 ngày); 88 chậu chữ ký + Sử Thi + Huyền Thoại thôi bán bằng xu, chuyển nhóm `crafted`, đổi bằng Đất Sét Mây + Ấn Công Trạng (12 chậu chữ ký ở ngày 30); khinh khí cầu về sau 30 phút, bỏ đơn chờ 60 phút; đơn hiếm 5%, thưởng 1 ngọc. Bật chặn 7 chỉ số trong check-metrics.json.
- File/Module: `tools/progression.ts`, `tools/check-metrics.json`, `content/base/{config(levels),bugs,crops(bugs),pots,orders}.json`, test kinh tế (`progression`, `economy`, `bugs10`, `signature-pots`).
- Ảnh hưởng save: Không. Chậu và bọ người chơi đang có giữ nguyên.
- Kiểm thử: 164/164 test; validate-content xanh; mô phỏng 7/10 chỉ số đạt (Xu/U, bọ Thường đầu–cuối, mốc/ngày còn cảnh báo, chờ chỗ tiêu xu của 12 TỔNG và nội dung 11 TỔNG).
- Ghi chú cho Claude thực thi: đúc chậu (M7) có thể thêm công thức riêng cho nhóm `crafted`; giữ nguyên `exchange` hiện có. Test "ôm xu" chuyển sang chỉ số Xu/U của npm run check.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 11 đính chính D1 — BOT có chim (dùng chung luật chim), sửa 2 lỗi nhỏ (tag `m-10-d1`)
- Loại: Thêm / Sửa lỗi (P3)
- Mô tả: lõi chim tách thành `runBirds(owner)` dùng chung cho người chơi và BOT (lịch, đói/ngủ, lên cấp, hết hạn thuê, 5% bọ hiếm hơn, `newBird`, `addFood`); BOT thuê chim hợp họ cây thích, mua Hạt Kê và cho ăn; chim BOT bắt bọ trên vườn dựng theo tỉ lệ sinh bọ của luật đếm. Bot mô phỏng người chơi biết nuôi chim. Nút "Thêm chậu" ở hàng sau đứng giữa mặt cỏ; `demo('signature')` không lỗi khi chưa mở tầng 2.
- File/Module: `src/systems/{birds,botBirds,neighbors}.ts`, `src/persistence/reconcile.ts`, `src/core/state.ts`, `content/base/birds.json`, `tools/progression.ts`, `src/render/scene.ts`, `src/app/demo.ts`
- Ảnh hưởng save: Không đổi phiên bản. BOT trong save cũ được thêm `birds: []`, `bugs: {}` khi đọc.
- Kiểm thử: `tests/botBirds11.test.ts` (40 BOT × 7 ngày có chim; ±20% so với chim người chơi vừa: BOT 172/ngày, người chơi ~180/ngày; tất định liên tục = mở lại; 40 BOT × 7 ngày < 150 ms). `npm run check` XANH.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 10 M5 — Tầng 1–4, vật phẩm mở tầng, đính chính D2–D5 (tag `m-10-m5`)
- Loại: Thêm / Sửa lỗi (P0: treo game khi tính giờ chín ở Vườn Trăng)
- Mô tả: tầng 4 Vườn Trăng Lơ Lửng (đêm lớn nhanh 25%, Đom Đóm Sao ×2); mở tầng 2–4 cần Sợi Mây Kết + Giọt Sương Trời (rơi 2% khi thu hoạch, quà bất ngờ); 6 → 10 ô xếp 2 hàng so le (D5); nút Chim qua features.json (D2); thông báo xếp hàng (D3); bỏ tên tầng trùng, tầng 5 cấp 19 (D4); 33 biểu tượng thật từ 7_bieu-tuong, hết biểu tượng tạm; npm run check.
- File/Module: `content/base/{floors,config,surprises,features,tutorials,materials}.json`, `src/systems/{growth,floors}.ts`, `src/render/scene.ts`, `src/ui/{toast,dom,potPanels,hint}.ts`, `tools/{check.ts,make-floors-10.py}`, `tools/art/build.py`
- Ảnh hưởng save: Không đổi phiên bản. Save có "tầng 4 sinh tự động" thành Vườn Trăng, giữ chậu và cây; tầng đã mở rộng giữ đủ ô (có test).
- Kiểm thử: `npm run check` XANH (typecheck, test, validate-content, build, mô phỏng 30 ngày); chỉ số kinh tế ngoài khoảng là cảnh báo, chỉnh ở M9.
- Trạng thái nghiệm thu: Chờ

### [2026-11-17] Chậu dựng bằng Blender — Đồ họa
- Loại: Thêm
- Mô tả: Xưởng chậu Blender (`tools/potgen`), atlas 50 cấp Chậu Phượng Hoàng và 50 dòng chậu cấp 50; đề xuất định nghĩa 51 chậu (`content/proposals/pots_blender.json`, chưa nạp).
- File/Module: `assets/art/pots_*.webp/.json`, `tools/potgen/`, `content/proposals/`, `docs/reviews/2026-11-17-directive-03-chau-blender.md`
- Ảnh hưởng save: Không
- Kiểm thử: atlas kiểm tra đặt ô (ảnh `docs/reports/2026-11-17-chau-blender/kiem-tra-o-chau.jpg`); chưa nối vào mã game — xem chỉ thị 03
- Trạng thái nghiệm thu: Chờ developer nối vào game

### [2026-11-16] Tái thiết kế v2 theo đối chiếu Khu Vườn Trên Mây — giai đoạn 1–4
- Loại: Thêm / Sửa lỗi / Thay đổi
- Mô tả: kiểm toán + bảng đối chiếu; tài liệu REDESIGN_V2; tầng 6→10 chậu có ô Thêm chậu; sao tầng; bộ chậu + bậc ngoại hình (hào quang, đốm sáng); vòng sáng thu hoạch; khay hạt kéo-thả; Nhiệm Vụ Hôm Nay; thăm vườn hàng xóm BOT và giúp tưới/bắt bọ; sửa game đứng hình khi hoạt ảnh chạy trên vật thể đã huỷ; tên tầng chưa mở không còn bị HUD đè; câu lệnh đồ họa §11.7.
- File/Module: content/base/{floors,pots,potsets,missions,neighbors,config,manifest}.json; src/core/{content,state,game}.ts; src/systems/{floors,missions,visit,modifiers}.ts; src/persistence/{migrations,reconcile}.ts; src/render/{scene,slotView,garden,tween}.ts; src/ui/{gardenPanels,hud,worldPanels,text}.ts; src/app/{controller,demo}.ts; tools/shots.ts; docs/REDESIGN_V2.md; docs/research/; docs/reports/2026-11-16-tai-thiet-ke-v2.md
- Ảnh hưởng save: Có (6 → 7, migration giữ nguyên 10 ô cũ, sao 0, nhiệm vụ/lượt giúp trống)
- Kiểm thử: `npm test` 81/81; `npm run test:browser` 7/7 (Chrome swiftshader); ảnh chụp `tools/shots.ts` trong docs/reports/tai-thiet-ke-v2/. Chưa thử iPad thật.
- Trạng thái nghiệm thu: Chờ

### [2026-11-16] Nhiều tầng mây + chậu có buff — mở rộng giai đoạn 1, phần 1 (quyết định chủ dự án)
- Loại: Thêm
- Mô tả: 3 tầng mây có đặc tính môi trường, vuốt dọc theo cây leo, tầng kế tiếp hiện mờ kèm điều kiện, mở tầng có hoạt ảnh (camera lướt, tầng nảy lên, chậu hiện lần lượt, pháo vàng); 7 loại chậu / 5 độ hiếm với 5 chỉ số và hệ ưa thích; Lò Gốm Bà Mây (mua chậu), kho chậu, đổi chậu từ Sạp Hạt Giống hoặc Bàn Thợ Gốm. Chậu và tầng chưa có ảnh riêng dùng ảnh có sẵn đổi màu (chờ đồ họa đợt 2).
- File/Module: `content/base/{config,floors,pots}.json`, `src/core/{content,game,state}.ts`, `src/systems/{growth,modifiers}.ts`, `src/persistence/{migrations,reconcile,serializer}.ts`, `src/render/{assets,scene,slotView}.ts`, `src/ui/{panel,panels,potPanels,hud,hint,text}.ts`, `src/app/controller.ts`, `src/styles.css`, `tests/`
- Ảnh hưởng save: Có — saveVersion 4 → 5 (`potStock`), có migration và test
- Kiểm thử: `npm test` 60/60; `npm run test:browser` 5/5 (thêm: vuốt lên, mở tầng, mua chậu, đặt chậu qua giao diện). Chưa chạy trên Safari iPad.
- Trạng thái nghiệm thu: Chờ

### [2026-11-16] Vỏ ứng dụng, phần vẽ PixiJS, giao diện cổ tích, công cụ dev, bản thử — Giai đoạn 0 + 1
- Loại: Thêm
- Mô tả: 10 chậu mỗi tầng, góc chính diện + cây leo cổ thụ; ảnh đợt 1 (Leonardo) + hậu kỳ; PWA chạy offline; lưu theo vòng đời iPad; Sạp Hạt Giống, Bàn Thợ Gốm, Rương Mây, Cài Đặt theo DESIGN_SYSTEM; kéo tay qua hàng chậu; công cụ dev `?dev=1`; bản thử GitHub Pages có "BẢN THỬ · commit".
- File/Module: `src/app`, `src/render`, `src/ui`, `src/main.ts`, `src/styles.css`, `index.html`, `vite.config.ts`, `public/`, `assets/`, `tools/process_art.py`, `tests/browser/`, `.github/workflows/`, `content/base/floors.json`
- Ảnh hưởng save: Không (định dạng vẫn saveVersion 4; số chậu tăng chỉ áp dụng cho game mới)
- Kiểm thử: `npm test` 53/53; `npm run test:browser` 4/4 (vòng chơi, IndexedDB, đóng tab, offline) trên Chrome máy chủ; CI build được nhánh `gh-pages`. Chưa chạy trên Safari iPad.
- Trạng thái nghiệm thu: Chờ — báo cáo `docs/reports/2026-11-16-ban-thu-giai-doan-1.md`

### [2026-11-16] Sửa lỗi theo biên bản CTO số 01 (R1–R6) — Giai đoạn 0
- Loại: Sửa lỗi (R1, R2: P1 · R3–R6: P2) + Thay đổi tài liệu
- Mô tả:
  - R1: Cúc Bông Gòn miễn phí; gói nội dung bắt buộc có cây miễn phí mở từ cấp khởi đầu.
  - R2: Bọ Mây theo thời gian sinh trưởng (1 con / 1.800 giây, tối đa 4/vụ), đậu đến khi bắt hoặc thu hoạch; chỉnh giá Cúc 2→1, Cà Chua 4→7, Dâu Tây 22→32; công cụ bảng cân bằng.
  - R3: tưới không còn làm mất bọ (cơ chế từ R2, có test).
  - R4: thời gian game = đồng hồ + `clockOffsetMs`; chỉnh giờ về không làm game đứng im.
  - R5: đối chiếu save với nội dung khi đọc/nhập; chặn cây thu nhiều lần dưới 4 giai đoạn.
  - R6: `.gitignore`, Art Style Guide mục 4 và 9, `tools/validate-content.ts`; thay `PROJECT_RULES.md` 1.2 và `GAME_ROADMAP.md`.
  - Lưu `docs/DESIGN_SYSTEM.md`, `content/ui/design-tokens.json`; Art Style Guide mục 8 theo phong cách cổ tích.
- File/Module: `content/base/{crops,bugs}.json`, `src/core/{content,clock,game,state}.ts`, `src/systems/growth.ts`, `src/persistence/{migrations,serializer,saveManager,reconcile}.ts`, `tools/`, `tests/`, `docs/`
- Ảnh hưởng save: Có — saveVersion 1 → 4 (2: `caughtBugs`; 3: `clockOffsetMs`; 4: `seedCost`), có migration và test từng bước
- Kiểm thử: `tsx --test tests/*.test.ts` → 53/53 đạt; `tsc --noEmit -p .` → không lỗi. Test R1, R2(a), R4 đã được kiểm chứng là trượt với mã/dữ liệu cũ.
- Trạng thái nghiệm thu: Chờ — báo cáo `docs/reports/2026-11-16-sua-loi-bien-ban-01.md`

### [2026-11-16] Lõi mô phỏng, dữ liệu lát cắt dọc, lưu trữ — Giai đoạn 0
- Loại: Thêm
- Mô tả: Gói nội dung JSON (1 tầng, 4 chậu, 6 cây, 1 Bọ Mây, 5 cấp chậu); lõi mô phỏng không phụ thuộc phần vẽ (gieo, tưới, bắt bọ, thu hoạch, bán, nâng chậu, kho, lên cấp); RNG có hạt giống; chống lùi giờ; save có saveVersion + checksum, migration, 2 khe xoay vòng, xuất/nhập, IndexedDB store. Chưa có phần vẽ, Service Worker, công cụ dev — xem báo cáo.
- File/Module: `content/base/`, `src/core/`, `src/systems/`, `src/persistence/`, `tests/`
- Ảnh hưởng save: Có — định dạng đầu tiên, saveVersion 1 (chưa có save cũ cần migration)
- Kiểm thử: `tsx --test tests/*.test.ts` → 35/35 đạt; `tsc --noEmit -p .` → không lỗi. Chưa chạy trên Safari iPadOS.
- Trạng thái nghiệm thu: Chờ — chưa đủ điều kiện mục A (thiếu bằng chứng iPad). Báo cáo: `docs/reports/2026-11-16-giai-doan-0-tien-do.md`

### [2026-11-16] Thiết lập bộ quy tắc dự án — Giai đoạn 0
- Loại: Thêm
- Mô tả: Ban hành bộ tài liệu quản trị dự án: `PROJECT_RULES.md`, `GAME_ROADMAP.md`, `QUALITY_STANDARDS.md`, `CHANGELOG.md`, `ACCEPTANCE_CHECKLIST.md`.
- File/Module: thư mục gốc repository
- Ảnh hưởng save: Không
- Kiểm thử: Không áp dụng (tài liệu)
- Trạng thái nghiệm thu: Đạt — CTO ban hành
