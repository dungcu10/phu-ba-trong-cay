// Runs inside an OLD worktree: plays a short session with that version's own code and writes the
// save text with that version's own serializer (a real old-format save, no personal data).
import { writeFileSync } from 'node:fs';
const root = process.argv[2]!;
const out = process.argv[3]!;
const { loadBase, newGame, T0 } = await import(`${root}/tests/helpers.ts`);
const { dispatch } = await import(`${root}/src/core/game.ts`);
const { serialize } = await import(`${root}/src/persistence/serializer.ts`);
const content = await loadBase();
const s = newGame(content, { coins: 400 });
const MIN = 60_000;
let t = T0;
const daisy = content.cropList[0].id;
for (let round = 0; round < 6; round++) {
  for (let i = 0; i < 6; i++) dispatch(content, s, { type: 'plant', cropId: daisy, slot: i, floor: 0 } as never, t);
  t += 3 * MIN;
  for (let i = 0; i < 6; i++) dispatch(content, s, { type: 'harvest', slot: i, floor: 0 } as never, t);
}
const id = Object.keys(s.pots)[0];
dispatch(content, s, { type: 'upgradePot', potInstanceId: id } as never, t);
writeFileSync(out, serialize(s, t + MIN));
console.log(out, 'saveVersion', s.saveVersion, 'level', s.player.level, 'coins', s.player.coins, 'pots', Object.keys(s.pots).length);
