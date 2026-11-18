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

### [2026-11-18] CTO — 11 TỔNG N4 phần 1: giá Làng, Huy Chương ra chậu, bot xây làng
- `village.json`: xu nâng nhà = coins + coinsU × U, coinsU theo cấp nhà 1 / 2 / 4 / 8 (cả 8 nhà). Huy Chương Độ Cao bật `potRarity` (Hiếm / Sử Thi / Sử Thi / Huyền Thoại).
- Bù số chậu chữ ký (16 → 15): chậu Hiếm đổi 30 Đất Sét + 1 Ấn; đúc Sử Thi 30 bạc + 10 đồng + 8 ngọc mài; Huyền Thoại 45 bụi vàng + 10 ngọc thô + 12 ngọc mài.
- Bot mô phỏng: mỗi ngày nâng nhà rẻ nhất có đủ vật liệu và gấp 2 xu, nhận điểm danh. Mốc tiến bộ đếm thêm nhà lên cấp và Huy Chương.
- `birds.json › bots.growingShare` 0,45 → 0,38 (người chơi dùng bọ xây nhà, BOT 36,7 so với 30,5).
- Kết quả: nhà tiêu ~344 nghìn xu / 30 ngày; Sạp 32%, kho 19%. Cổng XANH, typecheck sạch, 235/235 test (test 150 ms của BOT thỉnh thoảng 158 ms trên máy CTO).
- Còn cảnh báo: ngày 27, 29 có 0 mốc tiến bộ.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 11 TỔNG N1 + N4 (phần 1) — Ảnh làng; Làng Phú Bà: 8 nhà, nâng nhà, Cấp Làng, Huy Chương Độ Cao, điểm danh 7 ngày; save 13 (tag `m-11-n4a`)
- Loại: Thêm
- Mô tả:
  - **N1 ảnh** (`tools/art/build_village.py`, chạy lại được; chỉ tách nền, cắt, phóng to): 5 tấm trời 1600 px (Lanczos; nen3, nen4 làm mờ 0,8 px; mép dưới các tấm trời trộn smoothstep 12%), 8 nhà (Real-ESRGAN, lỗ giấy trắng giữa giàn giáo/lồng chim được tách), Cáo/Rồng/Sẻ Mầm × đứng, chạy, ngủ, vui, biển gỗ, giàn giáo, cần câu, Xu Xu thợ xây và câu cá. Mèo Mây Con dùng lại bản đã cắt (`world/pet/cloud-cat`).
  - **Làng** (nút nhà ở thanh trên, có dấu "!" khi nhà nào có việc): cửa sổ Làng Phú Bà với 8 nhà theo ô đất, bong bóng báo trên mái (điểm danh/nhiệm vụ xong, đơn đủ hàng, đủ đồ nâng chậu, chim đói/sắp hết thuê, Sạp còn chỗ, máy nghỉ, gió đầy, mồi câu miễn phí), nút "Vào" mở đúng chức năng, Bến Câu Cá, biển gỗ "Dinh Phú Bà — sắp xây". Nhà chưa mở hiện mờ kèm "Mở ở cấp X".
  - **Nâng nhà** (từ cấp 5): 5 phút → 4 giờ, chạy khi tắt game, nhà vẫn dùng được (giàn giáo + Xu Xu cầm búa), 1 ô nâng cấp (Cấp Làng 15 thêm ô thứ 2). Nguyên liệu lấy từ hệ khác (§ D2): Ấn Công Trạng (Đình), Sợi Mây + hàng chế biến (Trạm), khoáng (Lò), sâu bọ (Tháp Chim, Xưởng), hàng chế biến (Chợ), Giọt Sương + cá (Cổng). Hiệu ứng mỗi cấp: +1 nhiệm vụ ngày, +1 ô đơn và +5% đơn hiếm, −5% giá chậu, +1 cành đậu và −10% giá thuê chim, +1 ô Sạp, +1 khe hàng chờ Xưởng, +5 Năng Lượng Gió tối đa. Cấp 3 có vầng sáng, cấp 5 có hào quang (vẽ bằng CSS).
  - **Cấp Làng** = tổng cấp 8 nhà: mốc 10 (−10% thời gian nâng), 15 (ô nâng thứ 2), 20, 30, 40 (dữ liệu sẵn; +1 lượt nhờ góp và +5% EXP đơn sẽ nối khi làm phần đơn hàng).
  - **Huy Chương Độ Cao** lần đầu mở tầng 5/10/15/20: ngọc + Sợi Mây + Giọt Sương. **Điểm danh 7 ngày**: nghỉ một ngày không mất chuỗi.
- Số liệu: `content/base/village.json` (mới). Xu nâng nhà có trường `coinsU` (đang 0). Chậu chữ ký của Huy Chương để ở `_proposedPotRarity` (bật thì chỉ số "Chậu chữ ký ngày 30" lên 16 > 15).
- File/Module: src/systems/village.ts, src/systems/villageAlerts.ts, src/ui/villagePanel.ts (mới); state.ts (`buildings`, `village`; **SAVE_VERSION 13**), migrations.ts (12 → 13), reconcile.ts, game.ts (upgradeHouse, claimCheckIn; sự kiện houseUpgradeStarted/houseUpgraded/medalAwarded/checkedIn), missions.ts, orders.ts, workshop.ts, sea.ts, birds.ts (hiệu ứng nhà), hud.ts, lineIcons.ts, controller.ts, world10.ts (nạp atlas houses/pets/village), styles.css, tools/art/build.py (`build_sheet` thêm `cut_kw`, `grid`), tests/village11.test.ts (7 test, có migration 12 → 13).
- Ảnh hưởng save: **Có — lên đời 13**, migration 12 → 13 thêm `buildings` và `village` trống; save cũ mở bình thường; Huy Chương cho tầng đã mở được trao (kèm thưởng) ở lần tick đầu.
- Quyết định tự chọn: (1) làng tạm là một cửa sổ (nút nhà ở thanh trên) trong khi làm cảnh làng dưới tầng 1 (N2–N3); (2) Đình nâng bằng Ấn Công Trạng (game chưa có món "Điểm sự kiện"); Nhà Thú Cưng tạm dùng Hạt Kê/Đất Mây cho tới khi có Huy Hiệu; (3) bong bóng Chợ báo "Sạp còn chỗ bày hàng" (hàng bán xong được trả xu ngay, không có trạng thái "đã bán"); bong bóng Xưởng báo "máy đang nghỉ" (hàng xong tự vào kho).

### [2026-11-18] CTO — M8: bật giới hạn câu cá và giá trang trí theo cấp
- `fishing.json › castsPerDay` 0 → 15. `market.json › levelPricing.decorU` 0 → 0,5 (trang trí là cộng thưởng vĩnh viễn nên đắt hơn đề xuất 0,2).
- Bot mô phỏng mua và đặt Đèn Lồng / Pha Lê vào khe trống khi có gấp 3 giá.
- Kiểm M8 (nhiệm vụ mới, hàng Chợ Mây, Xu Xu): cổng vẫn XANH; nhiệm vụ trả ~1,67 triệu xu / 30 ngày.
- Test giả định số 0 trong nội dung gốc: `tests/fishing10.test.ts` (đặt lại số lần câu trong vòng 400 lần), `tests/m8.test.ts` (so giá cũ bằng bản decorU = 0).
- Cổng XANH, typecheck sạch, 228/228 test.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 10 M8 — Xu Xu, nhiệm vụ cho hệ mới, hàng mới ở Chợ Mây; castsPerDay, decorU (tag `m-10-m8`)
- Loại: Thêm
- Mô tả:
  - **Xu Xu ở góc màn hình** (§ 3.11): ban ngày vẫy tay, ban đêm ngủ; chạm thì nói một câu (cứ 3 lần thì nhắc tính năng sắp mở ở cấp nào); mỗi 60 phút chạm được 1 quà nhỏ (1 Hạt Kê Mây), có dấu "!" khi quà sẵn. Cửa sổ "Mở khóa: …" có Xu Xu ngạc nhiên và chia lời hướng dẫn thành 2–3 bước. Số liệu `content/base/xuxu.json`.
  - **Nhiệm vụ** (§ 3.13): 4 nhiệm vụ ngày mới (cho chim ăn, làm hàng ở Xưởng, thổi mây, câu cá — mỗi cái mở theo cấp của hệ đó), 6 nhiệm vụ tuần, 6 thành tựu, 1 hành trình "Dọn sạch Biển Mây". 9 trigger mới: feedBird, makeGoods, blowCloud, openSeaChest, clearSea, catchFish, castPot, starPot, huntBazaar.
  - **Chợ Mây** (§ 3.13): Phú Bà bày thêm hàng chế biến (khi cấp mở máy), Sợi Mây, Giọt Sương, khoáng, mồi câu, bọ Thường đến Hiếm — không bao giờ bọ Rất hiếm, không chim. Giá tham chiếu bọ bằng đúng giá thương lái. Núm `neighbors.json › market.wares` (weight 0,3, goodsWeight 0,5, minLevel từng món).
  - **CTO yêu cầu:** `fishing.json › castsPerDay` (0 = không giới hạn; lỗi `casts_used`) và `market.json › levelPricing.decorU` (0; đề xuất 0,2) — giá trang trí = giá gốc + decorU × U(cấp).
- Sửa trong lúc làm: hành trình "Dọn sạch Biển Mây" lúc đầu có mốc cách đều + thưởng tăng 5%/mốc nên bot mô phỏng 365 ngày ôm ~300 ngọc/ngày (test của CTO bắt được); đã đổi sang mốc nhân đôi, thưởng không tăng.
- File/Module: src/systems/xuxu.ts (mới), hud.ts, questPanels.ts, controller.ts, styles.css, missions.ts, quests.ts, questdefs.ts, neighbors.ts, fishing.ts, decor.ts, coinSinks.ts, gardenPanels.ts, content.ts, state.ts (`xuxu?`, `fishing.castDay?/castsToday?`), reconcile.ts, tools/make-quests.py, content/base/{missions,neighbors,fishing,market,xuxu,quests}.json, tests/m8.test.ts (5 test), tests/quests.test.ts.
- Ảnh hưởng save: Không (trường mới tuỳ chọn).
- Quyết định tự chọn: (1) nhịp mở khóa giữ theo `features.json` hiện có (một số cấp lệch bảng § 5, ví dụ Xưởng cấp 6) vì CTO đã cân theo mô phỏng; nút tính năng chưa mở vẫn ẩn, Xu Xu nhắc "Lên cấp X là mở Y"; (2) BOT dùng Biển Mây/câu cá/đúc chậu: chưa làm, để vào chỉ thị 11 khi làm lại BOT.

### [2026-11-18] CTO — M7 câu cá: chặn lỗ in tiền, bot đi câu, đo Bọ Rất hiếm trên 4 seed
- Lỗ: 1 Mồi Thường = 2 Bạc Hà Mây (~14 xu) mà 1 lần câu trả TB ~197 xu (gấp 14 lần), kèm bọ Hiếm/Rất hiếm không giới hạn. `fishing.json`: Mồi Thường 6 Bạc Hà Mây; xu đổi cá 20 / 50 / 130 / 400 / 1.300 (trước 60 / 150 / 400 / 1.200 / 4.000). TB ~65 xu cho mồi ~42 xu.
- Bot mô phỏng câu tối đa 10 mồi/ngày (mồi miễn phí + chế), 70% kéo được; cá Thường đổi xu, cá hiếm hơn lấy lựa chọn cuối; nhận quà Sổ Cá.
- Chỉ số "Bọ Rất hiếm mỗi ngày" lấy trung bình 4 seed (42, 7, 99, 1234): 1 seed chỉ thấy vài con nên dao động 0,13–0,38 với cùng số liệu. Ve Ngọc ×1,2. Đo được 0,23.
- Cổng XANH (14/14 chỉ số chặn đạt; Sạp 34% nay cũng đạt), typecheck sạch, 223/223 test.
- Còn: giá trang trí (`decor.json` 2.500 xu cố định) không tăng theo cấp; chưa có giới hạn số lần câu mỗi ngày.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 10 M7 phần 3 — Câu cá, Trang trí tầng (tag `m-10-m7c`)
- Loại: Thêm
- Mô tả:
  - **Câu cá** (mở cấp 14): tab "Câu cá" trong cửa sổ Biển Mây (`openFishing()`, để Bến Câu Cá của làng ở chỉ thị 11 gọi lại). Mỗi ngày 1 Mồi Thường miễn phí; chế Mồi Thường từ 2 Lá Bạc Hà Mây, Mồi Thơm từ 1 Hũ Mứt (Mồi Thơm dễ gặp cá hiếm). Thả câu → phao nhấp nhô 2–6 giây → phao rung, chạm trong 2,5 giây → giữ để căng dây, giữ vạch trong vùng xanh 3–6 giây (vùng hẹp dần và cá giật mạnh hơn theo độ hiếm) cho đầy thanh. 5 loài cá theo 5 độ hiếm (Cá Mây Hồng, Cá Bông Mây, Cá Trăng Bạc, Cá Kim Vân, Cá Long Vân; hình có sẵn). Cá vào Túi Nguyên Liệu, đổi được xu, vật phẩm (Giọt Sương, Ngọc Thô…) hoặc bọ Hiếm/Rất hiếm. **Sổ Cá**: mỗi con câu được cộng điểm, 5 mốc thưởng (ngọc, Mồi Thơm, Ngọc Thô). Cá nào cắn câu được định sẵn theo seed + số lần thả; kết quả trò chơi gửi bằng lệnh `reelFish`. Đóng cửa sổ giữa chừng thì lần mở sau vào thẳng phần kéo dây.
  - **Trang trí tầng** (mở cấp 9): bảng gỗ của mỗi tầng có thẻ "Trang trí tầng" với 2 khe; mua Đèn Lồng Mây (+2% kinh nghiệm) hoặc Pha Lê Mây (+2% sản lượng) 2.500 xu, đặt vào khe, gỡ xuống thì trả về túi. Mỗi tầng cộng tối đa 6% mỗi loại, vẫn dưới trần tổng `bonusCaps`.
  - Test mới `tests/itemArt.test.ts`: mọi món phải có hình trong atlas — bắt lỗi "Không mở được game" (thiếu hình) ngay ở `npm run check` thay vì trên iPad.
- Số liệu: `content/base/fishing.json`, `content/base/decor.json` (mới). Xu đổi cá là nguồn xu mới, số khởi điểm thấp; CTO chỉnh.
- File/Module: src/systems/fishing.ts, src/systems/decor.ts, src/ui/fishingView.ts (mới); seaPanel.ts (2 tab), gardenPanels.ts (thẻ trang trí), modifiers.ts (decorBonus), game.ts (8 lệnh mới), content.ts (món cá kind `fish`), state.ts (`fishing.casts?`, `fishing.hooked?`), reconcile.ts, assets.ts + icons.ts (hình cá), controller.ts, styles.css, tools/make-quests.py (tính năng `decor`, `fishing` + hướng dẫn), tests/fishing10.test.ts (5 test).
- Ảnh hưởng save: Không (trường mới tuỳ chọn; save cũ mở bình thường).
- Quyết định tự chọn: (1) Pha Lê cộng **sản lượng** thay vì "+2% xu khi thu hoạch" vì thu hoạch không trả xu trực tiếp — thêm nông sản là thêm xu; (2) "Rau Thảo" chưa có trong game, dùng Lá Bạc Hà Mây (cây thảo mộc cấp 3); (3) câu cá là tab trong Biển Mây thay vì nút riêng, vì thanh bên đã đủ 8 nút và chỉ thị 11 chuyển câu cá vào làng; (4) trò kéo dây làm dễ cho trẻ: vạch bắt đầu trong vùng xanh, ra ngoài vùng thì thanh tụt chậm bằng nửa tốc độ đầy.

### [2026-11-18] CTO — M7 + B7: cân Biển Mây, Đúc Chậu, mảnh/sao chậu qua mô phỏng
- Bot mô phỏng: mỗi lần ghé tiêu hết Năng Lượng Gió ở Biển Mây; mỗi ngày đúc 1 chậu rẻ nhất chưa có khi đủ khoáng, ghép mảnh thành chậu, dùng mảnh lên sao.
- `sea.json`: Năng Lượng Gió hồi 1 điểm / 60 phút (trước 6 phút: bot dọn ~5 bản đồ/ngày, ngày 30 thừa 600 đồng, 500 bụi vàng). Bụi vàng ở ô mây 3 → 1,5.
- `casting.json` vật liệu: Hiếm 12 đồng + 6 đá + 2 ngọc mài; Sử Thi 26 bạc + 8 đồng + 8 ngọc mài; Huyền Thoại 30 bụi vàng + 8 ngọc thô + 10 ngọc mài. Ngày 30: 13 chậu Hiếm, 7 Sử Thi, 1 Huyền Thoại (trước: 16 Sử Thi đúc).
- `surprises.json`: giftChanceMax 0,08 → 0,075; giftChanceMin giữ 0 (bật 0,015 làm cây ngắn có bọ/giờ lệch quá 3 lần so với cây dài, test balance (c) đỏ). Quà TB 14,2/ngày.
- `birds.json › bots.growingShare` trả lại 0,45: chậu đúc có chỉ số bọ nên người chơi lại được ~43 bọ/ngày.
- `tests/sea10.test.ts`: đọc regenMinutes từ sea.json thay vì 6 phút viết cứng.
- Cổng XANH, typecheck sạch, 217/217 test.
- Trạng thái nghiệm thu: Chờ

### [2026-11-18] Chỉ thị 12 TỔNG B7 phần code — Mảnh chậu, ghép chậu, sao chậu (tag `m-12-b7-code`)
- Loại: Thêm
- Mô tả:
  - Mỗi loại chậu có **Mảnh** riêng (món trong Túi Nguyên Liệu, hình là chính ảnh chậu cắt vỡ bằng CSS, không vẽ mới).
  - **Chậu trùng thành mảnh:** nhận chậu đã có cùng loại từ Chợ Mây (Sạp Săn Hàng), Rương Biển Mây, sự kiện, nhiệm vụ thì tự đổi thành 10 mảnh; có thông báo. Mua ở Lò Gốm, đúc chậu, đổi chậu luôn ra chậu nguyên.
  - **Sao chậu ★0 → ★5:** nút ở cửa sổ chậu, tốn mảnh cùng loại (10/20/30/40/50). Mỗi sao cộng `casting.starStatBonus` (4%) chỉ số chính; chậu có sao thì sáng hơn trong vườn (★1 có hào quang, ★3 có hạt sáng bay quanh — dùng hiệu ứng code sẵn có).
  - **Ghép chậu:** đủ 10 mảnh một loại thì bấm "Ghép chậu" ở Túi Nguyên Liệu ra 1 chậu nguyên.
  - Số liệu ở `content/base/pot-stars.json` (mới): maxStars, duplicateShards, combineShards, starShards, convertSources. CTO chỉnh số.
- File/Module: src/systems/potStars.ts (mới), content.ts (món mảnh, PotStarRules), game.ts (lệnh starUpPot, combineShards; sự kiện potStarred, potCombined, potToShards; sự kiện và nhiệm vụ đi qua obtainPot), bazaar.ts, sea.ts, render/garden.ts, render/assets.ts (bỏ mảnh khỏi danh sách hình bắt buộc), ui/icons.ts, ui/potSystemPanels.ts, ui/panels.ts, controller.ts, styles.css, tests/potStars12.test.ts (4 test).
- Ảnh hưởng save: Không (dùng `PotInstance.stars` đã có; mảnh là món trong `inventory`).
- Quyết định tự chọn: (1) chậu người chơi tự chọn (Lò Gốm, đúc, đổi Ấn, ghép mảnh) luôn ra chậu nguyên, chỉ nguồn may mắn mới đổi chậu trùng thành mảnh — để không mất tiền mua chậu thứ hai cho ô khác; (2) Lò Gốm thôi bán chậu chữ ký/Sử Thi là phần số liệu của CTO (`pots.json`), mày không đụng; (3) chưa thêm mảnh vào bảng thưởng Chợ/Biển Mây — chờ CTO quyết tỉ lệ.

### [2026-11-18] Chỉ thị 12 TỔNG A2 — Tách 2 kho, Bán nhanh; surprises.giftChanceMin (tag `m-12-a2`)
- Loại: Thêm
- Mô tả:
  - Rương Mây có 2 tab, mỗi tab đếm riêng: **Kho Nông Sản** (nông sản + hàng chế biến; có sức chứa, nâng bằng xu như cũ) và **Túi Nguyên Liệu** (sâu bọ, khoáng, Sợi Mây, Giọt Sương, Hạt Kê, mồi câu, vật liệu chậu, đồ trang trí; **không giới hạn**). Mọi loại món mới (cá, Huy Hiệu, Mảnh Trứng Rồng…) tự vào Túi trừ khi là nông sản/hàng chế biến.
  - **Bán nhanh** ở tab Kho Nông Sản: bán mọi món thừa so với đơn hàng đang mở (giữ lại đúng phần đơn còn cần), hiện trước số xu nhận được. Khi kho đầy, khung báo đỏ "Kho Nông Sản đầy!". Lời báo kho đầy (lỗi và gợi ý) chỉ nói về Kho Nông Sản và chỉ tới nút Bán nhanh. Lệnh mới `quickSell`.
  - `surprises.json` thêm `giftChanceMin` (mặc định 0): sàn tỉ lệ quà mỗi lần thu hoạch, để cây ngắn ngày 1–6 vẫn có quà. CTO chỉnh số.
- File/Module: src/systems/storage.ts (mới), src/ui/panels.ts (StoragePanel 2 tab), game.ts (quickSell, quickSold, nothing_to_sell), controller.ts, hint.ts, text.ts, styles.css, surprises.ts, content.ts, content/base/surprises.json, tests/storage12.test.ts (3 test).
- Ảnh hưởng save: **Không cần migration, SAVE_VERSION giữ 12.** Save vẫn giữ một bảng món; kho của mỗi món suy ra từ loại món (đã như vậy từ trước: bọ và vật liệu không tính chỗ kho). Vì không chuyển dữ liệu nên không thể mất hay đặt sai món nào, save cũ mở bình thường.
- Quyết định tự chọn: (1) không tách thành 2 bảng trong save — tách theo loại món cho cùng kết quả mà không phải sửa hơn 60 chỗ đọc `inventory` (gồm file của CTO như tools/progression.ts) và không có rủi ro mất món khi nâng đời save; (2) "thừa" chỉ tính so với đơn khinh khí cầu đang mở, chưa giữ phần cho công thức Xưởng.

### [2026-11-18] CTO — A1 / B1.3: quà bất ngờ 10–15 lần mỗi ngày
- `surprises.json`: giftChancePer10Min 0,04 → 0,015, giftChanceMax 0,25 → 0,08; trọng số quà xu 5 → 1, bọ 3 → 4, vật phẩm 3 → 4 (bớt gói xu lặt vặt). Quà/ngày: trước 2–84, nay TB 12,7 (ngày 7–30). Thêm chỉ số chặn "Quà bất ngờ mỗi ngày" 10–15. Ngày 1–6 còn ít quà (0–6) vì cây ngắn.
- Chậu chữ ký Hiếm đổi 26 Đất Sét + 1 Ấn (trước 22): chậu ngày 30 về 14.
- File của luồng thực thi (chỉ chỉnh số, báo lại): `birds.json › bots.growingShare` 0,45 → 0,28, vì bọ của người chơi giảm (trước ~25% bọ đến từ quà) nên BOT phải hạ theo để giữ ±20%. `tests/world.test.ts`: test quà đọc số từ surprises.json thay vì số 0,25 viết cứng.
- Cổng XANH, typecheck sạch, 204/204 test.
- Trạng thái nghiệm thu: Chờ
### [2026-11-18] Chỉ thị 10 M7 phần 2 — Biển Mây Bí Ẩn (tag `m-10-m7b`)
- Loại: Thêm
- Mô tả: mở ở cấp 8, nút "Biển Mây" ở thanh bên trái (có hướng dẫn lần đầu). Lưới 6×8 cụm mây; chạm một cụm thì Xu Xu thổi tan, tốn 1 Năng Lượng Gió (tối đa 30, hồi 1 điểm / 6 phút kể cả khi tắt game, mỗi ngày tặng thêm 10 tới 40). Dưới mây: trống, khoáng (Đá Mây, Mảnh Đồng, Mảnh Bạc, Vàng Vụn, Ngọc Thô), Sợi Mây, Giọt Sương, bọ Hiếm (ghi vào Sổ Sâu Bọ), 2–3 rương 2×2 (thổi tan đủ 4 ô mới mở; 2 lượt thưởng + 3% ra chậu đúc). Dọn hết bản đồ: thưởng lớn và mở bản đồ mới. Xu Xu vẫy tay khi thổi, ngạc nhiên khi mở rương, vui khi dọn xong, ngủ khi hết gió. Bản đồ tất định từ seed + ngày lập + số thứ tự.
- Hình: cụm mây cắt từ vòng mây và mặt dưới tầng 1, 2, 4 đã duyệt (`tools/art/make-sea-clouds.py` → `assets/art/sea_clouds.webp`, 29 cụm, viền mềm bằng code), xoay, lật, co giãn ngẫu nhiên theo ô. Không vẽ mới.
- File/Module: content/base/sea.json (mới, manifest), src/systems/sea.ts, src/ui/seaPanel.ts, game.ts (lệnh blowCloud, sự kiện cloudBlown; updateWorld tính gió), content.ts, hud.ts, controller.ts, styles.css, theme-fantasy.css (nút thanh bên thấp hơn 8px cho vừa 8 nút), tools/make-quests.py (tính năng `sea` + `tut.sea`), tests/sea10.test.ts (6 test).
- Ảnh hưởng save: Không (dùng `seaMap`, `energy` đã có từ save 12).
- Quyết định tự chọn: (1) bản đồ chưa dọn xong được giữ qua ngày, không xoá khi sang ngày mới (không phạt khi vắng mặt, L5); bản đồ mới lấy seed theo ngày nó được lập; (2) chạm được mọi cụm mây, không bắt đào theo đường; (3) rương là khối 2×2 ô; (4) nút vào đặt ở thanh bên thay vì gốc cây leo, vì chỉ thị 11 chuyển lối vào sang Cổng Biển Mây trong làng, cửa sổ mở bằng `openSea()` để làng gọi lại; (5) thưởng ô, rương, dọn bản đồ chỉ là vật liệu và bọ, không có xu (để không thêm nguồn xu khi Xu/U đang cao), số khởi điểm để CTO chỉnh. Nhiệm vụ cho Biển Mây và BOT dùng Biển Mây làm ở M8.


### [2026-11-18] CTO — B2 + A3: bật Sạp Săn Hàng và giá theo cấp, cân qua mô phỏng
- `market.json › levelPricing` bật theo số đề xuất: mở tầng 0,5U, mở rộng tầng 0,1U, sao máy 0,3U, ô máy 0,2U, đúc chậu 0,3/0,8/2U.
- Chậu chữ ký trên Sạp (ô Sử Thi) 40 → 80 ngọc: 40 ngọc làm chậu chữ ký ngày 30 lên 18 (trần 15).
- Bot mô phỏng: mỗi lần ghé mua mọi ô Hiếm trở lên và món đơn đang cần, mua chậu bằng ngọc khi còn 20 ngọc, đặt lại tối đa 2 lần khi giá ≤ 5% xu đang có. Mở tầng / mở rộng / sao máy dùng giá theo cấp.
- Kết quả: xu tiêu vào nâng kho 59% → 22%; Sạp 36% (đặt lại 6,5%, mua 29%); xu giữ 0,05–1,14 ngày thu nhập. Thêm cảnh báo "Phần xu tiêu ở Sạp" 20–35%.
- Test của luồng thực thi giả định hệ số 0 trong nội dung gốc; đã sửa cho đọc giá theo cấp: `tests/bazaar12.test.ts`, `tests/floors-pots.test.ts`, `tests/redesign.test.ts`.
- Cổng XANH, typecheck sạch, 204/204 test.
- Trạng thái nghiệm thu: Chờ
### [2026-11-18] Sửa: bản thử không lên vì test hiệu năng trên máy CI
- Loại: Sửa
- Mô tả: từ 17/11 22:00 bản thử không cập nhật (dừng ở 30c66dc), vì 2 test hiệu năng trượt trên máy GitHub (2 nhân, chạy mọi file test cùng lúc, chậm 2–4×): 241 ms > 150 và 619 ms > 400. Trên máy dev vẫn 110–170 ms. Nay hai test lấy lần nhanh nhất trong 3 sau 1 lần chạy nóng, và trên CI ngưỡng ×3 (`PERF_SLACK` trong tests/helpers.ts). Mục tiêu iPad giữ nguyên trong tên test.
- File/Module: tests/helpers.ts, tests/market.test.ts, tests/botBirds11.test.ts.
- Ảnh hưởng save: Không.

### [2026-11-18] Chỉ thị 12 TỔNG B2 + A3 — Chỗ tiêu xu, phần code (tag `m-12-a3b2-code`)
- Loại: Thêm
- Mô tả:
  - **B2 Sạp Săn Hàng** (Chợ Mây › tab "Săn hàng hiếm", mở cấp 6): 8 ô do Phú Bà bày, độ hiếm 60/26/10/3,5/0,5%, mỗi ô mua 1 lần, xu trả về Phú Bà bày hàng. Tự làm mới miễn phí mỗi 4 giờ (theo giờ địa phương). **Đặt lại** tốn `U(cấp) × 0,15 × 1,5^n`, n về 0 sang ngày mới. **Vận May**: mỗi lần đặt lại không ra Hiếm (Sử Thi) thì +1, đủ 10 (40) thì lần sau chắc có ô Hiếm (Sử Thi); trúng thì về 0; hai thanh hiện trên sạp. Ô Khá 50% là bọ/vật liệu đang thiếu cho lần nâng chậu kế tiếp. Ô Sử Thi bán chậu chữ ký nguyên, ô Huyền Thoại bán chậu Huyền Thoại — trả **ngọc** (giữ quy tắc chậu chữ ký không bán bằng xu). Giá ô xu = U(cấp) × priceU, không thấp hơn giá bán lại × markup (không có vòng mua–bán ra lãi). Ô Sử Thi/Huyền Thoại rung, có tia sáng, có âm; mua món Huyền Thoại thì có thư báo. Tất định từ seed + bộ đếm.
  - **A3 giá theo cấp**: mở tầng, mở rộng tầng, đúc chậu (theo bậc hiếm), nâng sao máy, mua thêm ô máy cộng thêm `hệ số × U(cấp người chơi)` xu. Hệ số trong `market.json › levelPricing`, **đang để 0 (giữ giá cũ)**; số đề xuất ở `_proposed`. Nâng nhà/Cấp Làng thêm khi làm chỉ thị 11.
- Ghi chú cho CTO: bot mô phỏng (`tools/progression.ts`) chưa đi Sạp Săn Hàng nên `Xu/U` chưa đổi. Để chỉ số chạy: gọi lệnh `rerollBazaar` / `buyBazaar {slot}`; khi bật hệ số A3 thì truyền cấp vào `expandCost(def, floor, content, level)`, `nextStarCost(content, machine, m, level)`, `floorUnlockCost(content, def, level)` (hiện bot đọc `def.unlockCost` nên sẽ thử mở tầng khi chưa đủ xu — lệnh trả `not_enough_coins`, không hỏng).
- File/Module: content/base/market.json (mới, manifest), src/systems/bazaar.ts, src/systems/coinSinks.ts (mới), floors.ts, workshop.ts, casting.ts, game.ts (lệnh rerollBazaar/buyBazaar, sự kiện bazaarRerolled/bazaarRefreshed/bazaarBought, updateWorld làm mới sạp), state.ts (`bazaar?`), reconcile.ts, src/ui/worldPanels.ts, controller.ts, styles.css, tests/bazaar12.test.ts (9 test).
- Sửa nhỏ file CTO (chỉ thêm khai báo): `tools/progression.ts` thiếu `coinFlow` trong kiểu trả về của `simulateProgression` nên main (cd0ed47) trượt typecheck; đã thêm `coinFlow: Record<string, number>`, không đổi logic.
- Ảnh hưởng save: Không (trường `bazaar` tuỳ chọn, save cũ mở bình thường; bảng hỏng thì bỏ và bày lại).
- Quyết định tự chọn: (1) sạp săn là tab thứ ba "Săn hàng hiếm" trong Chợ Mây thay vì chèn vào tab "Đi chợ" cho gọn trên iPad; (2) Vận May có hai bộ đếm riêng (Hiếm, Sử Thi) — nếu dùng một bộ đếm thì trúng Hiếm sẽ xoá tiến độ Sử Thi và mốc 40 không bao giờ tới; (3) làm mới miễn phí không tính Vận May, chỉ lần đặt lại trả xu mới tính; (4) chưa bán Ngọc Mây (tiền tệ) trên sạp để không tạo đường đổi xu → ngọc; mảnh chậu, Huy Hiệu, Mảnh Trứng Rồng thêm khi có vật phẩm; (5) giá ngọc cho chậu Sử Thi/Huyền Thoại tạm 40/120, CTO chỉnh.


### [2026-11-18] CTO — A3: đo xu đúng theo chỉ thị, tìm ra chỗ tiêu xu thật
- Sửa chỉ số: "Xu/U" lấy U là thu nhập 1 GIỜ, trong khi 12 TỔNG A3 đòi xu giữ 1–5 lần thu nhập 1 NGÀY. Chỉ số mới "Xu đang giữ / thu nhập 1 ngày" (ngày 3–30): 0,27–2,12, bật chặn tối đa 5.
- Bot mô phỏng ghi `coinFlow` (xu vào/ra theo lệnh) và `income` mỗi ngày.
- Phát hiện: 59% xu tiêu vào nâng kho (bot nâng kho khi dư xu, nhiệm vụ thưởng việc nâng kho). Thử cho bot chỉ nâng kho khi gần đầy thì xu phình 10 triệu ở ngày 60 (22 ngày thu nhập). Kho đang là chỗ tiêu xu chính và chán. Thêm cảnh báo "Phần xu tiêu vào nâng kho" ≤ 40%.
- Mốc tiến bộ: đếm thêm lên cấp, chậu đúc, sao máy, quà Sổ Tay. Vẫn có ngày 0–1 mốc ở ngày 25–30.
- Cổng XANH, 191/191 test.
- Trạng thái nghiệm thu: Chờ
### [2026-11-18] Chỉ thị 10 M7 phần 1 — Đúc Chậu (tag `m-10-m7a`)
- Loại: Thêm
- Mô tả: Lò Gốm có nút "Đúc Chậu" (mở từ cấp 12): đúc chậu nhóm crafted bằng xu + vật liệu (đồng, đá mây, ngọc mài, bạc, bụi vàng, ngọc thô) theo bậc hiếm. Mỗi lần đúc có 10% "đúc hoàn hảo" → chậu +1 sao; mỗi sao +4% chỉ số chậu. Kết quả xác định từ seed. Bảng hiện nguyên liệu có/cần và nguồn rơi.
- File/Module: content/base/casting.json (mới), src/systems/casting.ts, src/ui/castingPanel.ts, src/systems/pots.ts (sao), src/core/game.ts (lệnh castPot), src/persistence/reconcile.ts (kẹp sao 0–5), tests/casting10.test.ts.
- Ảnh hưởng save: Không (PotInstance.stars là trường tuỳ chọn; save cũ mở bình thường).
- Quyết định tự chọn: giá xu và vật liệu mỗi bậc chỉ là số khởi điểm, CTO chỉnh qua mô phỏng (A3).

### [2026-11-18] CTO — Bot mô phỏng dùng chỗ tiêu bọ mới (B6)
- Bot chạy Xưởng mỗi lần ghé (ưu tiên hàng đơn đang cần), cuối ngày bán bọ dư quá 40 con mỗi loại cho thương lái.
- Bọ tồn ngày 30: 22,6 → 1,4 ngày bắt; ngày 60 giữ ~250 con. Bật chặn chỉ số này.
- Cổng XANH, 191/191 test.
- Còn: Xu/U 2,8–57,6 (ngày 30 ôm ~700 nghìn xu). Bán bọ lấy xu làm xu càng dư; cần chỗ tiêu xu lặp lại.
- Trạng thái nghiệm thu: Chờ

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
