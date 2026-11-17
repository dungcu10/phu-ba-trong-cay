// REVIEW 02 #1: upgrading a real older-version save (written by that version's own code — see
// tests/fixtures/README.md) keeps the player's progress, and an untouched copy of the old save is
// stored before anything is written. The copy is never overwritten and can be restored.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SAVE_VERSION } from '../src/core/state.ts';
import { SaveManager, upgradeBackupKey } from '../src/persistence/saveManager.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { dispatch } from '../src/core/game.ts';
import { loadBase, MIN } from './helpers.ts';

const content = await loadBase();
const FIXTURES = [
  { file: 'save-v4-d7c9ded.json', version: 4, note: 'bản thử d7c9ded — đời save của chủ dự án' },
  { file: 'save-v7-27159a0.json', version: 7, note: 'bản 27159a0' },
  { file: 'save-v8-e17dd05.json', version: 8, note: 'bản thử e17dd05 (Chỉ thị 04)' },
];

for (const fx of FIXTURES) {
  test(`nâng cấp save đời ${fx.version} thật (${fx.note}): giữ tiến trình, cất bản gốc trước khi ghi`, async () => {
    const raw = await readFile(join(import.meta.dirname, 'fixtures', fx.file), 'utf8');
    const old = JSON.parse(raw) as { data: { saveVersion: number; player: { level: number; coins: number; xp: number }; pots: Record<string, unknown>; inventory: Record<string, number> } };
    assert.equal(old.data.saveVersion, fx.version);
    const store = new MemoryStore();
    await store.put('slot-a', raw);
    const saves = new SaveManager(store, content);
    const r = await saves.load();
    assert.equal(r.kind, 'loaded');
    if (r.kind !== 'loaded') return;
    assert.equal(r.migratedFrom, fx.version);
    assert.equal(r.state.saveVersion, SAVE_VERSION);
    assert.equal(r.state.player.level, old.data.player.level);
    assert.equal(r.state.player.coins, old.data.player.coins);
    assert.equal(r.state.player.xp, old.data.player.xp);
    assert.equal(Object.keys(r.state.pots).length, Object.keys(old.data.pots).length, 'không mất chậu');
    for (const [id, q] of Object.entries(old.data.inventory)) assert.equal(r.state.inventory[id], q, `giữ ${id}`);
    assert.deepEqual(r.state.upgrades, { storage: 0 }, 'save 9: Rương Mây bắt đầu ở bậc 0');

    // The untouched copy exists before any write, byte for byte.
    assert.equal(await store.get(upgradeBackupKey(fx.version)), raw);
    const list = await saves.upgradeBackups();
    assert.equal(list.length, 1);
    assert.equal(list[0]!.fromVersion, fx.version);

    // Playing and saving twice overwrites both slots, never the copy.
    assert.ok(dispatch(content, r.state, { type: 'tick' }, r.savedAt + MIN).ok);
    await saves.save(r.state, r.savedAt + 2 * MIN);
    await saves.save(r.state, r.savedAt + 3 * MIN);
    assert.notEqual(await store.get('slot-a'), raw);
    assert.equal(await store.get(upgradeBackupKey(fx.version)), raw);

    // A later load of the (now current) save makes no new copy.
    const again = await new SaveManager(store, content).load();
    assert.equal(again.kind, 'loaded');
    assert.equal((await saves.upgradeBackups()).length, 1);

    // Restoring goes through the normal import check and gives back the old progress.
    const restored = saves.parseImport((await saves.upgradeBackupText(upgradeBackupKey(fx.version)))!);
    assert.equal(restored.state.player.coins, old.data.player.coins);
  });
}

test('save đang ở đời hiện tại thì không tạo bản sao nâng cấp', async () => {
  const store = new MemoryStore();
  const saves = new SaveManager(store, content);
  const raw = await readFile(join(import.meta.dirname, 'fixtures', 'save-v7-27159a0.json'), 'utf8');
  await store.put('slot-a', raw);
  const r = await saves.load();
  assert.equal(r.kind, 'loaded');
  if (r.kind !== 'loaded') return;
  await saves.save(r.state, r.savedAt + MIN);
  const store2 = new MemoryStore();
  await store2.put('slot-a', (await store.get('slot-b'))!);
  const s2 = new SaveManager(store2, content);
  await s2.load();
  assert.deepEqual(await s2.upgradeBackups(), []);
});
