#!/usr/bin/env python3
"""Sinh content/base/workshop.json (chỉ thị 10 § 3.5 Xưởng Bọ; chỉ thị 11 G: mở ở cấp 6;
bổ sung A6.3: công thức theo cây). Chạy lại khi crops.json có cây mới — chỉ đọc crops.json.

- Mỗi công thức gắn với một cây cụ thể (A6.3). Cây trong bảng mà chưa có trong game thì bỏ qua;
  nếu máy chưa có công thức nào ở cấp mở máy, thêm cây cùng hệ đã mở trước đó để máy dùng được ngay.
- Giá hàng chế biến = 1,5 × tổng giá bán nông sản đầu vào (ràng buộc § 3.5: không quá 1,6 lần).
- Thời gian = thời gian lớn của cây đầu vào, kẹp trong [5 phút, 4 giờ].
- workerBugs: mỗi mẻ tốn bấy nhiêu con bọ thợ của máy (chỗ tiêu bọ lặp lại, B6; CTO chỉnh số).
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'content' / 'base'
crops = {c['id']: c for c in json.loads((BASE / 'crops.json').read_text(encoding='utf-8'))}
VALUE = 1.5

MACHINES = [
    # id, name, worker bug, unlock level, icon, good name stem, family, qty, A6.3 crops (slug), extra input
    ('dryer', 'Máy Sấy Hoa', 'base:bug.ladybird', 6, 'dried-flowers', 'Hoa Sấy', 'flower', 3,
     ['cloud-rose', 'golden-gerbera', 'sun-sunflower'], None),
    ('jam-pot', 'Nồi Mứt', 'base:bug.jade-beetle', 7, 'jam', 'Hũ Mứt', 'fruit', 4,
     ['cloud-strawberry', 'sky-apple', 'heaven-peach'], None),
    ('juicer', 'Máy Ép Nước', 'base:bug.dew-hopper', 10, 'juice', 'Chai Nước Ép', 'herb', 3,
     ['cloud-bokchoy', 'sky-carrot'], ('fruit', 1)),
]


def crop(slug):
    return crops.get(f'base:crop.{slug}')


def short(name):
    """'Hoa Đồng Tiền Vàng' → 'Đồng Tiền Vàng' (drop a leading family word for the good's name)."""
    for w in ('Hoa ', 'Bông ', 'Lá ', 'Quả '):
        if name.startswith(w):
            return name[len(w):]
    return name


machines, goods = [], []
for mid, name, worker, level, icon, stem, family, qty, wanted, extra in MACHINES:
    picks = [crop(s) for s in wanted if crop(s)]
    if not any(c['unlockLevel'] <= level for c in picks):
        # Fallback so the machine works the day it opens: the newest crop of the family by then,
        # except the 1-minute tutorial crop when there is anything else.
        older = sorted([c for c in crops.values() if c['family'] == family and c['unlockLevel'] <= level],
                       key=lambda c: c['unlockLevel'])
        older = [c for c in older if c['growSeconds'] > 60] or older
        if older:
            picks = [older[-1]] + picks
    side = None
    if extra:
        fam, n = extra
        cheap = sorted([c for c in crops.values() if c['family'] == fam], key=lambda c: c['sellPrice'])
        side = (cheap[0], n) if cheap else None
    recipes = []
    for c in picks:
        slug = c['id'].split('.', 1)[1]
        inputs = {c['produce']['id']: qty}
        value = c['sellPrice'] * qty
        minutes = c['growSeconds'] / 60
        if side:
            inputs[side[0]['produce']['id']] = side[1]
            value += side[0]['sellPrice'] * side[1]
        good = f'base:good.{icon}.{slug}'
        goods.append({'id': good, 'name': {'vi': f"{stem} {short(c['produce']['name']['vi'])}"},
                      'icon': f'art:icon/{icon}', 'sellPrice': round(value * VALUE), 'machine': f'base:machine.{mid}'})
        recipes.append({'id': f'base:recipe.{mid}.{slug}', 'inputs': inputs, 'output': good,
                        'minutes': int(min(240, max(5, round(minutes)))), 'workerBugs': 1})
    machines.append({'id': f'base:machine.{mid}', 'name': {'vi': name}, 'worker': worker, 'unlockLevel': level,
                     'recipes': recipes})

# Máy Mài Ngọc (cấp 16): khoáng sản (Biển Mây, § 3.7) → Ngọc Mây. Khoáng không bán được nên
# ràng buộc 1,6 lần không áp dụng; Ngọc Mây dùng đúc chậu và cho Rồng (chỉ thị 11).
machines.append({'id': 'base:machine.gem-grinder', 'name': {'vi': 'Máy Mài Ngọc'}, 'worker': 'base:bug.gold-scarab',
                 'unlockLevel': 16, 'recipes': [
                     {'id': 'base:recipe.gem-grinder.stone', 'inputs': {'base:mat.cloud-stone': 3}, 'output': 'base:mat.cut-gem', 'minutes': 60, 'workerBugs': 1},
                     {'id': 'base:recipe.gem-grinder.jade', 'inputs': {'base:mat.raw-jade': 1, 'base:mat.cloud-stone': 1}, 'output': 'base:mat.cut-gem', 'minutes': 40, 'workerBugs': 1},
                 ] + [
                     # A6.3: khoáng cộng Hoa Trăng Non hoặc Cỏ Sao Băng (Kỳ Hoa) → Ngọc Mây.
                     {'id': f'base:recipe.gem-grinder.{slug}', 'inputs': {'base:mat.cloud-stone': 2, crop(slug)['produce']['id']: 1},
                      'output': 'base:mat.cut-gem', 'minutes': 30, 'workerBugs': 1}
                     for slug in ('crescent-flower', 'shooting-star-grass') if crop(slug)
                 ]})

rules = {
    'slotsStart': 2,
    'slotsMax': 4,
    # Coins for queue slot 3 and slot 4 (per machine).
    'slotCost': [1500, 5000],
    # Stars 2..5: coins + the machine's worker bug (§ 3.5: nâng sao bằng sâu bọ và xu).
    'stars': [{'coins': 1000, 'bugs': 5}, {'coins': 3000, 'bugs': 12}, {'coins': 8000, 'bugs': 25}, {'coins': 20000, 'bugs': 50}],
    # Each star: 5% faster, +5% coins and XP on orders carrying that machine's goods.
    'starSpeed': 0.05,
    'starOrderBonus': 0.05,
    'valueCap': 1.6,
}
out = {'machines': machines, 'goods': goods, 'rules': rules}
(BASE / 'workshop.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for m in machines:
    print(m['name']['vi'], [r['id'].rsplit('.', 1)[1] for r in m['recipes']])
print('goods', [(g['name']['vi'], g['sellPrice']) for g in goods])
