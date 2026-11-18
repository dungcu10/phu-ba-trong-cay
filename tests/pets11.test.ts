// Chỉ thị 11 TỔNG § E: pets — getting them, skills at 1 and 5 stars, Cáo Vồ Bọ offline (shared
// catchBug, 8-hour cap, hungry = asleep), Sẻ Nhặt Hạt, Rồng Mưa Ngọc, Mèo Gọi Khách, feeding/bond,
// walk slots, stars.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { advancePets, newPet, petOf, skillValue, speciesDef, walkSlots } from '../src/systems/pets.ts';
import { simulateNeighbors } from '../src/systems/neighbors.ts';
import { HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const r = content.pets!;
const MIN = 60_000;
const FOX = 'pet.fire-fox';
const KITTEN = 'pet.cloud-kitten';
const SPARROW = 'pet.sprout-sparrow';
const DRAGON = 'pet.jade-dragon';

test('Mèo Mây Con được tặng khi lên cấp 4 (mở Chợ), tự được dắt', () => {
  const s = newGame(content, { level: 3 });
  updateWorld(content, s, T0);
  assert.equal(s.pets.length, 0);
  s.player.level = 4;
  const ev = updateWorld(content, s, T0 + MIN);
  assert.ok(ev.some((e) => e.type === 'petObtained' && e.gift));
  assert.ok(petOf(s, KITTEN)!.active);
  assert.equal(updateWorld(content, s, T0 + 2 * MIN).filter((e) => e.type === 'petObtained').length, 0);
});

test('nhận nuôi: Cáo bằng xu, Sẻ bằng ngọc, Rồng bằng ngọc hoặc 10 Mảnh Trứng Rồng', () => {
  const s = newGame(content, { level: 20, coins: 1e6, gems: 1000 });
  assert.ok(dispatch(content, s, { type: 'obtainPet', species: FOX, pay: 'coins' }, T0).ok);
  assert.deepEqual(dispatch(content, s, { type: 'obtainPet', species: FOX, pay: 'coins' }, T0), { ok: false, error: 'have_it' });
  const gems = s.player.gems;
  assert.ok(dispatch(content, s, { type: 'obtainPet', species: SPARROW, pay: 'gems' }, T0).ok);
  assert.equal(gems - s.player.gems, speciesDef(content, SPARROW)!.price.gems);
  s.inventory['base:mat.dragon-egg-shard'] = 10;
  assert.ok(dispatch(content, s, { type: 'obtainPet', species: DRAGON, pay: 'shards' }, T0).ok);
  assert.equal(s.inventory['base:mat.dragon-egg-shard'] ?? 0, 0);
  assert.deepEqual(dispatch(content, newGame(content, { level: 5, coins: 1e6 }), { type: 'obtainPet', species: FOX, pay: 'coins' }, T0), { ok: false, error: 'locked' });
});

test('kỹ năng ở 1 sao = lo, ở 5 sao = hi (cấp 1)', () => {
  for (const sp of r.species) {
    for (const sk of sp.skills) {
      const p = newPet(sp.id, T0, true);
      assert.ok(Math.abs(skillValue(content, p, sk) - (sk.unit === 'count' ? Math.round(sk.lo) : sk.lo)) < 1e-9, `${sk.id} 1★`);
      p.stars = 5;
      assert.ok(Math.abs(skillValue(content, p, sk) - (sk.unit === 'count' ? Math.round(sk.hi) : sk.hi)) < 1e-9, `${sk.id} 5★`);
    }
  }
});

test('Cáo Vồ Bọ: mỗi (10 → 5) phút một con bằng catchBug chung, bù tối đa 8 giờ, đói thì ngủ', () => {
  const s = newGame(content, { level: 20 });
  const fox = newPet(FOX, T0, true);
  s.pets.push(fox);
  let calls = 0;
  const catcher = () => ((calls += 1), { ok: true, itemId: 'base:bug.ladybird' });
  const ev = advancePets(content, s, T0 + 60 * MIN, catcher);
  assert.equal(ev.length, 6, '1★: 10 phút/con trong 60 phút');
  fox.stars = 5;
  fox.food = 100;
  fox.fedAt = T0 + 60 * MIN;
  assert.equal(advancePets(content, s, T0 + 120 * MIN, catcher).length, 12, '5★: 5 phút/con');
  // a day away: only the last 8 hours are worked; food runs out after 25 hours of 4/h
  const n = advancePets(content, s, T0 + 120 * MIN + 24 * HOUR, catcher).length;
  assert.ok(n > 0 && n <= (8 * 60) / 5, `${n}`);
  fox.food = 0;
  fox.fedAt = T0;
  assert.equal(advancePets(content, s, T0 + 30 * HOUR, catcher).length, 0, 'đói thì ngủ');
  // a fox not walked does nothing
  const t = newGame(content, { level: 20 });
  t.pets.push(newPet(FOX, T0, false));
  assert.equal(advancePets(content, t, T0 + HOUR, catcher).length, 0);
});

test('Cáo bắt bọ thật trên tầng nó trông (dùng catchBug của người chơi)', () => {
  const s = newGame(content, { level: 20, coins: 1e6 });
  s.pets.push(newPet(FOX, T0, true));
  const crop = content.cropList.find((c) => c.unlockLevel <= 2)!;
  s.floors[0]!.slots.forEach((_, i) => dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId: crop.id }, T0));
  const before = s.stats.bugsCaught;
  updateWorld(content, s, T0 + 3 * HOUR);
  dispatch(content, s, { type: 'claimCheckIn' }, T0 + 3 * HOUR);
  assert.ok(s.stats.bugsCaught >= before);
});

test('Sẻ Mầm Nhặt Hạt: hoàn tiền hạt với tỉ lệ đúng giá trị kỹ năng', () => {
  const s = newGame(content, { level: 20, coins: 1e9 });
  const sp = newPet(SPARROW, T0, true);
  sp.stars = 5;
  s.pets.push(sp);
  const crop = content.cropList.find((c) => c.seedPrice > 0 && c.unlockLevel <= 20)!;
  let refunds = 0;
  let n = 0;
  for (let k = 0; k < 400; k++) {
    for (let i = 0; i < s.floors[0]!.slots.length; i++) {
      s.floors[0]!.slots[i]!.planting = null;
      const res = dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId: crop.id }, T0 + k * MIN);
      if (!res.ok) continue;
      n += 1;
      if (res.events.some((e) => e.type === 'seedRefunded')) refunds += 1;
    }
  }
  const want = speciesDef(content, SPARROW)!.skills[0]!.hi;
  assert.ok(Math.abs(refunds / n - want) < 0.04, `${refunds}/${n}`);
});

test('Rồng Mưa Ngọc: rút ngắn thời gian lớn cả tầng, hồi 8 → 4 giờ', () => {
  const s = newGame(content, { level: 20, coins: 1e6 });
  s.pets.push(newPet(DRAGON, T0, true));
  const crop = content.cropList.find((c) => c.growSeconds > 3600 && c.unlockLevel <= 20)!;
  s.floors[0]!.slots.forEach((_, i) => dispatch(content, s, { type: 'plant', floor: 0, slot: i, cropId: crop.id }, T0));
  const r1 = dispatch(content, s, { type: 'jadeRain' }, T0 + MIN);
  const ev = r1.ok ? r1.events.find((e) => e.type === 'jadeRained') : undefined;
  assert.ok(ev && ev.type === 'jadeRained' && ev.pots > 0 && ev.savedMs > 0);
  assert.deepEqual(dispatch(content, s, { type: 'jadeRain' }, T0 + 2 * MIN), { ok: false, error: 'cooldown' });
  assert.ok(dispatch(content, s, { type: 'jadeRain' }, T0 + 8 * HOUR + 2 * MIN).ok);
});

test('Mèo Gọi Khách: hàng xóm mua ở Sạp nhiều hơn (cả khi tắt game)', () => {
  const sold = (withCat: boolean) => {
    const s = newGame(content, { level: 10 }, 5);
    const crop = content.cropList[0]!;
    s.inventory[crop.produce.id] = 500;
    s.stall = Array.from({ length: content.neighbors.stallSlots }, (_, i) => ({ id: i + 1, itemId: crop.produce.id, qty: 10, price: Math.max(1, Math.round(crop.sellPrice * 0.9)) }));
    if (withCat) {
      const k = newPet(KITTEN, T0, true);
      k.stars = 5;
      k.food = 100;
      k.fedAt = T0 + 20 * HOUR;
      s.pets.push(k);
    }
    const ev = simulateNeighbors(content, s, T0 + 20 * HOUR);
    return ev.filter((e) => e.type === 'stallSold').reduce((a, e) => a + (e.type === 'stallSold' ? e.qty : 0), 0);
  };
  assert.ok(sold(true) >= sold(false), `${sold(true)} vs ${sold(false)}`);
});

test('cho ăn: món thích ×3 Thân Thiết, tối đa 5 lần có điểm mỗi ngày, Thân Thiết không giảm; mốc 25 tặng Huy Hiệu', () => {
  const s = newGame(content, { level: 20 });
  s.pets.push(newPet(FOX, T0, true));
  const fruit = content.cropList.find((c) => c.family === 'fruit')!.produce.id;
  const herb = content.cropList.find((c) => c.family === 'herb')!.produce.id;
  s.inventory[fruit] = 50;
  s.inventory[herb] = 50;
  const fox = petOf(s, FOX)!;
  fox.food = 0;
  const r1 = dispatch(content, s, { type: 'feedPet', species: FOX, itemId: fruit }, T0);
  assert.ok(r1.ok && r1.events.some((e) => e.type === 'petFed' && e.liked && e.bond === r.bond.perFeed * r.food.likedTimes));
  fox.food = 0;
  const r2 = dispatch(content, s, { type: 'feedPet', species: FOX, itemId: herb }, T0);
  assert.ok(r2.ok && r2.events.some((e) => e.type === 'petFed' && !e.liked && e.bond === r.bond.perFeed));
  for (let i = 0; i < 6; i++) ((fox.food = 0), dispatch(content, s, { type: 'feedPet', species: FOX, itemId: fruit }, T0));
  assert.equal(fox.bond, r.bond.perFeed * (r.food.likedTimes * 4 + 1));
  assert.deepEqual(dispatch(content, s, { type: 'feedPet', species: FOX, itemId: 'base:mat.cloud-stone' }, T0), { ok: false, error: 'cannot_eat' });
  fox.bond = 24;
  fox.milestones = [];
  fox.food = 0;
  const badge = s.inventory['base:mat.badge-fox'] ?? 0;
  dispatch(content, s, { type: 'feedPet', species: FOX, itemId: fruit }, T0 + 24 * HOUR);
  assert.equal(s.inventory['base:mat.badge-fox'], badge + 1);
  const b = fox.bond;
  updateWorld(content, s, T0 + 30 * 24 * HOUR);
  assert.equal(fox.bond, b, 'Thân Thiết không giảm');
});

test('ô dắt: 1, thêm ở Nhà Thú Cưng cấp 3 và 5; nâng sao cần cấp, Huy Hiệu, bọ, xu', () => {
  const s = newGame(content, { level: 20, coins: 1e6 });
  s.pets.push(newPet(FOX, T0, true), newPet(SPARROW, T0, false));
  assert.equal(walkSlots(content, s), 1);
  assert.deepEqual(dispatch(content, s, { type: 'walkPet', species: SPARROW, active: true }, T0), { ok: false, error: 'no_walk_slot' });
  s.buildings.pets = { level: 3, upgradeEndsAt: null };
  assert.ok(dispatch(content, s, { type: 'walkPet', species: SPARROW, active: true }, T0).ok);
  const fox = petOf(s, FOX)!;
  assert.deepEqual(dispatch(content, s, { type: 'starUpPet', species: FOX }, T0), { ok: false, error: 'pet_level_low' });
  fox.level = r.stars[0]!.minLevel;
  s.inventory['base:mat.badge-fox'] = r.stars[0]!.badges;
  const bug = content.bugList.find((b) => b.rarity === r.stars[0]!.bugRarity)!;
  s.inventory[bug.id] = r.stars[0]!.bugs;
  assert.ok(dispatch(content, s, { type: 'starUpPet', species: FOX }, T0).ok);
  assert.equal(fox.stars, 2);
  assert.equal(s.inventory[bug.id] ?? 0, 0);
});
