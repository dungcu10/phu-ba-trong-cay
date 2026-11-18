// Chỉ thị 11 TỔNG § E3: việc vặt thú cưng — bảng mỗi ngày, sai bé đi, về khi vắng mặt (đúng giờ),
// hợp nghề thưởng thêm, bé đi vắng thì kỹ năng thụ động nghỉ, đổi việc có giới hạn, nhận một lần.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, updateWorld } from '../src/core/game.ts';
import { petOf, petWorking } from '../src/systems/pets.ts';
import { HOUR, loadBase, newGame, T0 } from './helpers.ts';

const content = await loadBase();
const er = content.pets!.errands!;
const KITTEN = 'pet.cloud-kitten';
const FOX = 'pet.fire-fox';

function withPets() {
  const s = newGame(content, { level: 20, coins: 1e6, gems: 1000 });
  updateWorld(content, s, T0);
  assert.ok(dispatch(content, s, { type: 'obtainPet', species: FOX, pay: 'coins' }, T0).ok);
  updateWorld(content, s, T0 + 1000);
  return s;
}

test('bảng việc vặt có perDay việc, giữ nguyên trong ngày, làm mới qua ngày', () => {
  const s = withPets();
  assert.ok(s.errands.list.length >= er.perDay);
  const before = JSON.stringify(s.errands);
  updateWorld(content, s, T0 + 2 * HOUR);
  assert.equal(JSON.stringify(s.errands), before);
  updateWorld(content, s, T0 + 30 * HOUR);
  assert.notEqual(s.errands.day, JSON.parse(before).day);
});

test('sai bé đi: bé vắng nhà, kỹ năng nghỉ; về đúng giờ dù người chơi vắng mặt; nhận một lần', () => {
  const s = withPets();
  const t = T0 + 2000;
  const sent = dispatch(content, s, { type: 'sendErrand', index: 0, species: FOX }, t);
  assert.ok(sent.ok);
  const def = er.list.find((e) => e.id === s.errands.list[0]!.errand)!;
  const fox = petOf(s, FOX)!;
  fox.active = true;
  assert.equal(petWorking(content, fox, t + HOUR / 2), false);
  assert.deepEqual(dispatch(content, s, { type: 'sendErrand', index: 1, species: FOX }, t), { ok: false, error: 'pet_away' });
  assert.deepEqual(dispatch(content, s, { type: 'claimErrand', index: 0 }, t + 1000), { ok: false, error: 'not_back' });
  const back = t + def.hours * HOUR;
  const coins = s.player.coins;
  const got = dispatch(content, s, { type: 'claimErrand', index: 0 }, back + 5 * HOUR);
  assert.ok(got.ok);
  assert.ok(s.player.coins >= coins);
  assert.equal(fox.awayUntil, null);
  assert.ok(fox.xp > 0 || fox.level > 1);
  assert.deepEqual(dispatch(content, s, { type: 'claimErrand', index: 0 }, back + 6 * HOUR), { ok: false, error: 'already_claimed' });
});

test('bé hợp nghề mang về nhiều hơn bé không hợp nghề (cùng việc, cùng hạt giống)', () => {
  const def = er.list.find((e) => e.fit.includes(FOX) && !e.fit.includes(KITTEN) && (e.coinsU || e.items))!;
  assert.ok(def, 'cần một việc hợp Cáo mà không hợp Mèo');
  const total = (species: string) => {
    const s = withPets();
    s.errands.list[0]!.errand = def.id;
    assert.ok(dispatch(content, s, { type: 'sendErrand', index: 0, species }, T0 + 2000).ok);
    const r = dispatch(content, s, { type: 'claimErrand', index: 0 }, T0 + 2000 + def.hours * HOUR);
    assert.ok(r.ok);
    const e = r.events.find((x) => x.type === 'errandClaimed')!;
    assert.equal(e.type === 'errandClaimed' && e.fit, species === FOX);
    return e.type === 'errandClaimed' ? e.coins + Object.entries(e.items).filter(([id]) => !id.includes('badge')).reduce((a, [, q]) => a + q, 0) : 0;
  };
  assert.ok(total(FOX) > total(KITTEN));
});

test('đổi việc: chỉ freeRerolls lần mỗi ngày, không đổi việc đang làm', () => {
  const s = withPets();
  for (let i = 0; i < er.freeRerolls; i++) assert.ok(dispatch(content, s, { type: 'rerollErrand', index: 1 }, T0 + 2000).ok);
  assert.deepEqual(dispatch(content, s, { type: 'rerollErrand', index: 1 }, T0 + 2000), { ok: false, error: 'no_reroll' });
  assert.ok(dispatch(content, s, { type: 'sendErrand', index: 0, species: FOX }, T0 + 2000).ok);
  s.errands.rerolls = 0;
  assert.deepEqual(dispatch(content, s, { type: 'rerollErrand', index: 0 }, T0 + 2000), { ok: false, error: 'bad_slot' });
});

test('việc đang làm qua ngày vẫn giữ để nhận', () => {
  const s = withPets();
  const def = er.list.find((e) => e.id === s.errands.list[0]!.errand)!;
  assert.ok(dispatch(content, s, { type: 'sendErrand', index: 0, species: FOX }, T0 + 2000).ok);
  updateWorld(content, s, T0 + 30 * HOUR);
  const i = s.errands.list.findIndex((e) => e.pet === FOX);
  assert.ok(i >= 0);
  assert.ok(dispatch(content, s, { type: 'claimErrand', index: i }, T0 + 2000 + Math.max(def.hours, 31) * HOUR).ok);
});
