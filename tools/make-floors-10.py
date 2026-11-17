#!/usr/bin/env python3
"""Chỉ thị 10 § 3.1 + chỉ thị 11 đính chính D4/D5: 4 hand-made floors, item costs, floor 4 traits.

Slots stay 6 to start and 10 at most (D5 cancels the "4 → 6" of chỉ thị 10); slot prices are the
existing coin prices. Generated floors start at floor 5, level 19 (C2: floor 4 at 16, +3 a floor).

Idempotent: run again any time; it rewrites content/base/floors.json and the floorGen block of
config.json from the table below. Starting values; the economy pass (M9) may tune them.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / 'content' / 'base'
THREAD = 'base:mat.cloud-thread'
DEW = 'base:mat.sky-dew'

# id: (unlock items, coin price of slots 7–10)
TABLE = {
    'base:floor.cloud-meadow': ({}, [120, 350, 800, 1800]),
    'base:floor.tea-mist': ({THREAD: 3, DEW: 2}, [1000, 2200, 4000, 7000]),
    'base:floor.golden-terrace': ({THREAD: 6, DEW: 4}, [3500, 7000, 12000, 20000]),
    'base:floor.moon-garden': ({THREAD: 10, DEW: 8}, [8000, 16000, 27000, 45000]),
}
MOON = {
    'id': 'base:floor.moon-garden',
    'name': {'vi': 'Vườn Trăng Lơ Lửng'},
    'unlockLevel': 16,
    'unlockCost': 25000,
    'startingPot': 'base:pot.terracotta',
    'sprite': 'floors/golden-terrace',
    'trait': None,
    'tint': '#D5DDF0',
    # Night (device time) growth +25%, Đom Đóm Sao twice as often.
    'nightSpeed': 0.25,
    'bugBoost': {'base:bug.star-firefly': 2},
    'stars': [
        {'level': 18, 'coins': 9000, 'items': {'base:item.golden-gerbera': 15}},
        {'level': 21, 'coins': 16000, 'items': {'base:item.cloud-strawberry': 25}},
        {'level': 25, 'coins': 30000, 'items': {'base:item.golden-gerbera': 30}},
    ],
}

floors_path = BASE / 'floors.json'
floors = json.loads(floors_path.read_text(encoding='utf-8'))
if not any(f['id'] == MOON['id'] for f in floors):
    floors.append(MOON)
for f in floors:
    items, costs = TABLE[f['id']]
    f['slotCount'] = 6
    f['maxSlots'] = 10
    f['expandCosts'] = costs
    f.pop('expandItems', None)
    if items:
        f['unlockItems'] = items
    else:
        f.pop('unlockItems', None)
floors_path.write_text(json.dumps(floors, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

config_path = BASE / 'config.json'
config = json.loads(config_path.read_text(encoding='utf-8'))
gen = config['floorGen']
# Generated floors start above floor 4 now (floor 5 at level 19), same 6 → 10 slots.
gen['names'] = [n for n in gen['names'] if n != 'Vườn Trăng Lơ Lửng']
gen['firstLevel'] = 19
gen['slotCount'] = 6
gen['maxSlots'] = 10
gen['expandFactors'] = [0.25, 0.5, 0.75, 1.0]
gen.pop('expandItems', None)
gen['unlockItems'] = {THREAD: 12, DEW: 10}
# Floor materials drop at harvest (§ 3.1: 2%).
config['floorMaterialDrop'] = {'chance': 0.02, 'items': [THREAD, DEW]}
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('floors:', [f['id'] for f in floors])
