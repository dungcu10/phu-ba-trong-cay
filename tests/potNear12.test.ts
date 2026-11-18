// Chỉ thị 12 B7.3 "Gần mốc": chậu còn 1–2 cấp nữa tới dáng mới (và các cấp đó đã mở).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearMilestone } from '../src/systems/pots.ts';
import { loadBase } from './helpers.ts';

const content = await loadBase();

test('gần mốc: báo đúng số cấp còn lại, chỉ khi còn 1–2 cấp và cấp đó đã mở', () => {
  const def = [...content.pots.values()].find((d) => d.looks.some((l) => l.from > 3 && l.from <= d.openTo))!;
  assert.ok(def, 'cần một chậu có mốc đổi dáng đã mở');
  const look = def.looks.find((l) => l.from > 3 && l.from <= def.openTo)!;
  const prev = def.looks.filter((l) => l.from < look.from).at(-1)!;
  assert.equal(nearMilestone(def, look.from - 1)?.left, 1);
  if (look.from - 2 >= prev.from) assert.equal(nearMilestone(def, look.from - 2)?.left, 2);
  if (look.from - 3 >= 1) assert.equal(nearMilestone(def, look.from - 3), null);
  assert.equal(nearMilestone(def, look.from - 1)?.look.from, look.from);
  // Past the last look, or a look beyond what is open: no hint.
  const last = def.looks.at(-1)!;
  assert.equal(nearMilestone(def, Math.max(last.from, def.levels.length)), null);
  const closed = [...content.pots.values()].find((d) => d.looks.some((l) => l.from > d.openTo));
  if (closed) {
    const l = closed.looks.find((x) => x.from > closed.openTo)!;
    if (l.from - 1 >= closed.looks.filter((x) => x.from <= closed.openTo).at(-1)!.from) assert.equal(nearMilestone(closed, l.from - 1)?.look.from === l.from, false);
  }
});
