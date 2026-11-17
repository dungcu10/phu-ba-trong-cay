// R2 (CTO review 01): every crop has a reason to be chosen. Guards the balance table so adding
// or retuning a crop cannot silently break it. Play styles and "fitting style" are defined in
// tools/balance.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceTable, bestForCoins, fittingStyle, PLAY_STYLES } from '../tools/balance.ts';
import { loadBase } from './helpers.ts';

const content = await loadBase();
const table = balanceTable(content);

test('(a) mỗi kiểu chơi có cây nhiều xu nhất khác nhau', () => {
  const best = PLAY_STYLES.map((s) => bestForCoins(table[s.id]!).crop.id);
  assert.equal(new Set(best).size, PLAY_STYLES.length, `cây tốt nhất: ${best.join(', ')}`);
});

test('(b) ghé 15 phút và 2 giờ: cây cấp cao hơn cho XP/giờ không thấp hơn cây cấp 1', () => {
  for (const id of ['regular', 'casual']) {
    const rows = table[id]!;
    const starters = rows.filter((r) => r.crop.unlockLevel === 1);
    const floor = Math.max(...starters.map((r) => r.xpPerHour));
    for (const r of rows) {
      if (r.crop.unlockLevel > 1) assert.ok(r.xpPerHour >= floor, `${id}: ${r.crop.name.vi} ${r.xpPerHour} XP/giờ < ${floor}`);
    }
  }
});

test('(c) bọ/giờ của các cây, mỗi cây trong kiểu chơi phù hợp với nó, chênh nhau không quá 3 lần', () => {
  const rates = content.cropList.map((c) => {
    const style = fittingStyle(table, c.id);
    return { name: c.name.vi, rate: table[style.id]!.find((r) => r.crop.id === c.id)!.bugsPerHour };
  });
  const max = Math.max(...rates.map((r) => r.rate));
  const min = Math.min(...rates.map((r) => r.rate));
  assert.ok(min > 0 && max / min <= 3, JSON.stringify(rates));
});
