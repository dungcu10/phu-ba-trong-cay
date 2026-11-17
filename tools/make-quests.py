# Sinh content/base/quests.json, features.json, tutorials.json (nâng cấp v3 đợt 2).
# Chạy: python3 tools/make-quests.py — sửa nội dung ở đây rồi chạy lại, không sửa tay JSON.
import json
D='base:crop.cotton-daisy'; T='base:crop.cherry-tomato'; M='base:crop.cloud-mint'; C='base:crop.sky-carrot'; S='base:crop.cloud-strawberry'; G='base:crop.golden-gerbera'
CLAY='base:mat.cloud-clay'; SEAL='base:mat.merit-seal'
def Q(id,track,name,reward,**kw):
    q={"id":id,"track":track,"name":{"vi":name}}
    if 'desc' in kw: q['desc']={"vi":kw.pop('desc')}
    q.update(kw); q['reward']=reward; return q
tracks=[
 {"id":"newbie","name":{"vi":"Tân thủ"},"skipAtLevel":6},
 {"id":"weekly","name":{"vi":"Tuần"},"reset":"week","pick":5},
 {"id":"monthly","name":{"vi":"Tháng"},"reset":"month","pick":4},
 {"id":"journey","name":{"vi":"Hành trình"}},
 {"id":"achievement","name":{"vi":"Thành tựu"}},
 {"id":"secret","name":{"vi":"Bí mật"}},
]
qs=[]
nb=[
 ("plant-daisy","Gieo hạt Cúc Bông Gòn","Chạm vào một chậu trống rồi chọn Cúc Bông Gòn (miễn phí).",dict(trigger="plant",filter={"cropId":D},target=1),{"coins":20,"xp":2}),
 ("harvest-3","Thu hoạch 3 lần","Cây chín có ngôi sao vàng. Chạm hoặc vuốt tay qua các chậu để thu.",dict(trigger="harvest",target=3),{"coins":20,"xp":3}),
 ("sell-5","Bán 5 nông sản","Mở Rương Mây, chọn nông sản rồi bấm Bán.",dict(trigger="sell",target=5),{"coins":30,"xp":3}),
 ("water-3","Tưới cây 3 lần","Cây khát hiện giọt nước. Chạm vào chậu để tưới, cây lớn nhanh hơn.",dict(trigger="water",target=3),{"coins":20,"xp":3}),
 ("level-2","Đạt cấp 2","Thu hoạch để có kinh nghiệm.",dict(measure="level",target=2),{"coins":30,"gems":1}),
 ("plant-tomato","Gieo 2 hạt Cà Chua Bi Ngọt","Cà chua thu được 2 lần mỗi lần gieo.",dict(trigger="plant",filter={"cropId":T},target=2),{"coinsHours":0.3,"xp":5}),
 ("order-1","Giao 1 đơn khinh khí cầu","Mở Đơn hàng: đủ nông sản thì bấm Giao hàng để nhận nhiều xu hơn bán.",dict(trigger="deliverOrder",target=1),{"coinsHours":0.3,"xp":8}),
 ("bug-2","Bắt 2 Bọ Mây","Bọ Mây đậu trên cây đang lớn. Chạm để bắt — bọ dùng để nâng cấp chậu.",dict(trigger="catchBug",target=2),{"coinsHours":0.2,"xp":5}),
 ("upgrade-pot","Nâng cấp một chậu","Chạm vào một chậu đang trống để mở Bàn Thợ Gốm, rồi bấm Nâng cấp.",dict(trigger="upgradePot",target=1),{"coinsHours":0.3,"items":{CLAY:2}}),
 ("tomato-10","Thu hoạch 10 lần Cà Chua Bi Ngọt","Cà chua mọc lại sau mỗi lần thu — không cần gieo lại ngay.",dict(trigger="harvest",filter={"cropId":T},target=10),{"coinsHours":0.3,"gems":1}),
 ("expand-1","Thêm một vị trí chậu","Chạm dấu + ở cuối tầng.",dict(trigger="expandFloor",target=1),{"coinsHours":0.4,"xp":10}),
 ("level-3","Đạt cấp 3","Cấp 3 mở Lò Gốm, Bảng Phú Bà và Lễ Hội.",dict(measure="level",target=3),{"coinsHours":0.3,"gems":1}),
 ("help-1","Giúp hàng xóm 1 lần","Mở Phú Bà, ghé vườn một hàng xóm, tưới hoặc bắt bọ giúp họ.",dict(trigger="helpNeighbor",target=1),{"coinsHours":0.4,"xp":10}),
 ("level-4","Đạt cấp 4","Cấp 4 mở Sạp Phú Bà.",dict(measure="level",target=4),{"coinsHours":0.3,"xp":5}),
 ("stall-1","Bày bán 1 món ở Sạp","Mở Sạp, chọn món và giá rồi Bày lên sạp — hàng xóm sẽ ghé mua.",dict(trigger="listStall",target=1),{"coinsHours":0.4,"gems":1}),
 ("level-5","Đạt cấp 5","Tầng mây thứ hai mở ở cấp 5.",dict(measure="level",target=5),{"coinsHours":0.5,"gems":2}),
 ("floor-2","Mở tầng mây thứ hai","Kéo lên dọc cây leo và chạm vào tầng mờ phía trên.",dict(measure="floors",target=2),{"coinsHours":1,"gems":3,"items":{CLAY:3}}),
]
prev=None
for i,(id,name,desc,kw,rew) in enumerate(nb):
    q=Q(f"newbie.{i+1:02d}-{id}","newbie",name,rew,desc=desc,**kw)
    if prev: q['requires']=[prev]
    qs.append(q); prev=q['id']
wk=[
 ("harvest","Thu hoạch nhiều lần",dict(trigger="harvest",target={"base":60,"perLevel":4}),{"coinsHours":2,"gems":1}),
 ("flowers","Thu hoạch cây họ Hoa",dict(trigger="harvest",filter={"family":"flower"},target={"base":20,"perLevel":1.5}),{"coinsHours":2,"gems":1}),
 ("fruits","Thu hoạch cây họ Quả",dict(trigger="harvest",filter={"family":"fruit"},target={"base":20,"perLevel":1.5}),{"coinsHours":2,"gems":1},2),
 ("herbs","Thu hoạch cây họ Rau Thảo",dict(trigger="harvest",filter={"family":"herb"},target={"base":15,"perLevel":1.2}),{"coinsHours":2,"gems":1},3),
 ("orders","Giao đơn khinh khí cầu",dict(trigger="deliverOrder",target={"base":10,"perLevel":0.3}),{"coinsHours":3,"gems":1},2),
 ("bugs","Bắt Bọ Mây",dict(trigger="catchBug",target={"base":25,"perLevel":1}),{"coinsHours":2,"items":{CLAY:3}}),
 ("help","Giúp hàng xóm",dict(trigger="helpNeighbor",target=12),{"coinsHours":2,"gems":1},3),
 ("upgrade","Nâng cấp chậu",dict(trigger="upgradePot",target=6),{"coinsHours":2,"items":{CLAY:4}},3),
 ("sell","Bán nông sản",dict(trigger="sell",target={"base":150,"perLevel":8}),{"coinsHours":2,"gems":1}),
 ("daily","Hoàn thành nhiệm vụ hằng ngày",dict(trigger="claimDaily",target=10),{"coinsHours":2,"items":{SEAL:1}}),
 ("stall","Hàng xóm mua ở Sạp",dict(trigger="stallSold",target=15),{"coinsHours":2,"gems":1},4),
 ("rain","Gọi Mưa Mây",dict(trigger="cloudRain",target=2),{"coinsHours":2,"gems":1},16),
 ("star","Lên sao một tầng",dict(trigger="starFloor",target=1),{"coinsHours":3,"gems":1},3),
 ("mutation","Thu hoạch quả Biến Dị",dict(trigger="mutation",target=1),{"coinsHours":2,"gems":1},2),
]
for row in wk:
    id,name,kw,rew=row[:4]; lv=row[4] if len(row)>4 else 1
    q=Q(f"weekly.{id}","weekly",name,rew,**kw)
    if lv>1: q['minLevel']=lv
    qs.append(q)
mo=[
 ("harvest","Mùa bội thu",dict(trigger="harvest",target={"base":400,"perLevel":20}),{"coinsHours":8,"gems":6}),
 ("orders","Phi đội khinh khí cầu",dict(trigger="deliverOrder",target={"base":40,"perLevel":1}),{"coinsHours":8,"gems":6},2),
 ("upgrade","Thợ gốm chăm chỉ",dict(trigger="upgradePot",target=25),{"coinsHours":6,"items":{CLAY:10}},3),
 ("help","Láng giềng tốt bụng",dict(trigger="helpNeighbor",target=45),{"coinsHours":6,"gems":5},3),
 ("expand","Mở rộng vườn",dict(trigger="expandFloor",target=2),{"coinsHours":8,"gems":5},3),
 ("daily","Bền bỉ mỗi ngày",dict(trigger="claimDaily",target=45),{"coinsHours":6,"items":{SEAL:3}}),
 ("buypot","Sưu tầm chậu mới",dict(trigger="buyPot",target=2),{"coinsHours":6,"gems":5},4),
 ("earn","Kiếm thật nhiều xu",dict(trigger="earnCoins",target={"base":20000,"perLevel":4000}),{"coinsHours":8,"gems":5}),
]
for row in mo:
    id,name,kw,rew=row[:4]; lv=row[4] if len(row)>4 else 1
    q=Q(f"monthly.{id}","monthly",name,rew,**kw)
    if lv>1: q['minLevel']=lv
    qs.append(q)
jr=[
 ("floors","Leo tầng mây","Mở thêm tầng mây.",dict(measure="floors",tiers={"base":2,"step":1,"rewardGrowth":1.03}),{"coinsHours":2,"gems":1}),
 ("level","Thăng cấp","Lên cấp.",dict(measure="level",tiers={"base":5,"step":5,"rewardGrowth":1.0}),{"coinsHours":2,"gems":1}),
 ("stars","Sao trên mây","Tổng số sao của các tầng.",dict(measure="stars",tiers={"base":3,"step":3,"rewardGrowth":1.0}),{"coinsHours":2,"gems":1}),
 ("potlevel","Bàn tay thợ gốm","Cấp cao nhất của một chậu.",dict(measure="maxPotLevel",tiers={"base":5,"step":5,"rewardGrowth":1.03}),{"coinsHours":2,"items":{CLAY:3}}),
 ("storage","Rương thêm rộng","Nâng Rương Mây.",dict(measure="storageTier",tiers={"base":1,"step":2,"rewardGrowth":1.0}),{"coinsHours":1,"gems":1}),
 ("upper","Vườn trên cao","Thu hoạch ở tầng thứ 3 trở lên.",dict(trigger="harvest",filter={"floorMin":2},tiers={"base":50,"growth":2.5,"rewardGrowth":1.05}),{"coinsHours":2,"gems":1}),
 ("gerbera","Vườn hoa vàng","Thu hoạch Hoa Đồng Tiền Vàng.",dict(trigger="harvest",filter={"cropId":G},tiers={"base":20,"growth":2.5,"rewardGrowth":1.05}),{"coinsHours":2,"gems":1}),
 ("strawberry","Dâu mây ngọt lịm","Thu hoạch Dâu Tây Mây.",dict(trigger="harvest",filter={"cropId":S},tiers={"base":20,"growth":2.5,"rewardGrowth":1.05}),{"coinsHours":2,"gems":1}),
]
for id,name,desc,kw,rew in jr:
    qs.append(Q(f"journey.{id}","journey",name,rew,desc=desc,**kw))
ach=[
 ("harvest","Nhà nông mây","harvest",50,{"coinsHours":1,"gems":1}),
 ("sell","Thương lái","sell",100,{"coinsHours":1,"gems":1}),
 ("orders","Bạn của khinh khí cầu","deliverOrder",10,{"coinsHours":1,"gems":1}),
 ("bugs","Người bắt bọ","catchBug",20,{"coinsHours":1,"gems":1}),
 ("help","Láng giềng vàng","helpNeighbor",5,{"coinsHours":1,"gems":1}),
 ("water","Người tưới mây","water",30,{"coinsHours":1,"gems":1}),
 ("stall","Chủ sạp","stallSold",10,{"coinsHours":1,"gems":1}),
 ("mutation","Săn Biến Dị","mutation",1,{"coinsHours":1,"gems":1}),
]
for id,name,trig,base,rew in ach:
    qs.append(Q(f"achievement.{id}","achievement",name,rew,trigger=trig,tiers={"base":base,"growth":3,"rewardGrowth":1.05}))
qs.append(Q("achievement.potlines","achievement","Nhà sưu tầm chậu",{"coinsHours":1,"gems":2},measure="potLines",tiers={"base":3,"step":3,"rewardGrowth":1.03}))
qs.append(Q("achievement.crops","achievement","Bách khoa cây trồng",{"coinsHours":1,"gems":2},measure="cropKinds",tiers={"targets":[2,4,6,9,12,15,18]}))
qs.append(Q("achievement.friend","achievement","Tri kỷ",{"coinsHours":1,"gems":2},measure="bestFriendship",tiers={"base":10,"growth":2}))
sec=[
 ("jade","Ngọc trong mây","Thu hoạch một quả Biến Dị Ngọc.",dict(trigger="mutation",filter={"mutation":"jade"},target=1),{"coinsHours":3,"gems":5}),
 ("night","Cú đêm","Thu hoạch 10 lần trong khoảng 0–4 giờ sáng.",dict(trigger="harvest",filter={"hours":[0,4]},target=10),{"coinsHours":2,"gems":4}),
 ("golden","Mưa vàng","Thu hoạch 10 quả Biến Dị Vàng.",dict(trigger="mutation",filter={"mutation":"golden"},target=10),{"coinsHours":3,"gems":5}),
 ("rain5","Thần mưa","Gọi Mưa Mây 5 lần.",dict(trigger="cloudRain",target=5),{"coinsHours":2,"gems":4}),
 ("legend","Báu vật huyền thoại","Mua một chậu Huyền Thoại.",dict(trigger="buyPot",filter={"rarity":"legendary"},target=1),{"coinsHours":3,"gems":5}),
 ("top","Trên tầng mây thứ mười","Mở tầng mây thứ 10.",dict(measure="floors",target=10),{"coinsHours":5,"gems":8}),
]
for id,name,desc,kw,rew in sec:
    qs.append(Q(f"secret.{id}","secret",name,rew,desc=desc,hidden=True,**kw))
json.dump({"tracks":tracks,"quests":qs},open('content/base/quests.json','w'),ensure_ascii=False,indent=2)
features=[
 {"id":"orders","name":{"vi":"Đơn khinh khí cầu"},"level":2,"tutorial":"tut.orders"},
 {"id":"journal","name":{"vi":"Sổ Tay"},"level":2,"tutorial":"tut.journal"},
 {"id":"shop","name":{"vi":"Lò Gốm"},"level":3,"tutorial":"tut.shop"},
 {"id":"neighbors","name":{"vi":"Phú Bà"},"level":3,"tutorial":"tut.neighbors"},
 {"id":"event","name":{"vi":"Lễ Hội"},"level":3,"tutorial":"tut.event"},
 {"id":"stall","name":{"vi":"Sạp"},"level":4,"tutorial":"tut.stall"},
 # Chỉ thị 10 § 3.3 + chỉ thị 11 đính chính D2: chim mở ở cấp 3 (Sẻ Mây).
 {"id":"birds","name":{"vi":"Chim Bắt Sâu"},"level":3,"tutorial":"tut.birds"},
]
json.dump(features,open('content/base/features.json','w'),ensure_ascii=False,indent=2)
tut=[
 {"id":"tut.orders","title":{"vi":"Mở khóa: Đơn khinh khí cầu"},"text":{"vi":"Khinh khí cầu của hàng xóm ghé đặt hàng. Giao đủ nông sản để nhận nhiều xu và kinh nghiệm hơn bán thường; đơn quý còn tặng Ngọc Mây."},"target":"open-orders"},
 {"id":"tut.journal","title":{"vi":"Mở khóa: Sổ Tay"},"text":{"vi":"Sổ Tay ghi mỗi loại cây bạn đã thu hoạch. Đủ mốc thì nhận Ngọc Mây."},"target":"open-journal"},
 {"id":"tut.shop","title":{"vi":"Mở khóa: Lò Gốm Bà Mây"},"text":{"vi":"Mua chậu mới: mỗi chậu có chỉ số riêng và lên được 50 cấp. Chậu hợp họ cây thì càng mạnh."},"target":"open-shop"},
 {"id":"tut.neighbors","title":{"vi":"Mở khóa: Bảng Phú Bà"},"text":{"vi":"Xem ai giàu nhất làng mây, ghé vườn hàng xóm tưới cây và bắt bọ giúp họ để nhận xu và tình thân."},"target":"open-neighbors"},
 {"id":"tut.event","title":{"vi":"Mở khóa: Lễ Hội"},"text":{"vi":"Lễ hội có hạn: chơi như thường để tích điểm, đạt mốc nhận quà độc quyền."},"target":"open-event"},
 {"id":"tut.birds","title":{"vi":"Mở khóa: Chim Bắt Sâu"},"text":{"vi":"Thuê Sẻ Mây đậu ở mép tầng: chim tự bắt bọ trên cây Hoa, cả khi bạn tắt game. Nhớ cho chim ăn Hạt Kê Mây, chim đói thì ngủ."},"target":"open-birds"},
 {"id":"tut.stall","title":{"vi":"Mở khóa: Sạp Phú Bà"},"text":{"vi":"Bày nông sản lên sạp với giá bạn chọn. Hàng xóm ghé mua theo sở thích — giá càng hời bán càng nhanh."},"target":"open-stall"},
]
json.dump(tut,open('content/base/tutorials.json','w'),ensure_ascii=False,indent=2)
print(len(qs))
