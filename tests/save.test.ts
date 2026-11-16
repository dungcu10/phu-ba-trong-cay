import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/core/game.ts';
import { SAVE_VERSION } from '../src/core/state.ts';
import { checksumOf, deserialize, serialize, SAVE_FORMAT, SaveFormatError } from '../src/persistence/serializer.ts';
import { migrate, MigrationError } from '../src/persistence/migrations.ts';
import { SaveManager } from '../src/persistence/saveManager.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { DAISY, loadBase, MIN, newGame, T0 } from './helpers.ts';

const content = await loadBase();

function playedState() {
  const s = newGame(content);
  dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0);
  dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 1 }, T0);
  dispatch(content, s, { type: 'harvest', floor: 0, slot: 0 }, T0 + 2 * MIN);
  return s;
}

test('ghi rồi đọc lại cho đúng y nguyên trạng thái', () => {
  const s = playedState();
  const { state, savedAt, migratedFrom } = deserialize(serialize(s, T0 + 3 * MIN));
  assert.deepEqual(state, s);
  assert.equal(savedAt, T0 + 3 * MIN);
  assert.equal(migratedFrom, null);
  assert.equal(state.saveVersion, SAVE_VERSION);
});

test('save bị sửa hoặc cắt ngang thì bị phát hiện', () => {
  const text = serialize(playedState(), T0);
  assert.throws(() => deserialize(text.replace('"coins":', '"coins":9')), SaveFormatError);
  assert.throws(() => deserialize(text.slice(0, text.length / 2)), SaveFormatError);
  assert.throws(() => deserialize('{"format":"khac"}'), SaveFormatError);
});

test('save từ phiên bản mới hơn bị từ chối, không bị ghi đè', () => {
  const s = playedState();
  const data = JSON.stringify({ ...s, saveVersion: SAVE_VERSION + 1 });
  const text = JSON.stringify({ format: SAVE_FORMAT, saveVersion: SAVE_VERSION + 1, savedAt: T0, checksum: checksumOf(data), data: JSON.parse(data) });
  assert.throws(() => deserialize(text), /phiên bản mới hơn/);
});

test('migration chạy tuần tự từng bước và báo lỗi khi thiếu bước', () => {
  const steps = {
    1: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
    2: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
  };
  assert.deepEqual(migrate({ x: 0, saveVersion: 1 }, 1, steps, 3), { x: 0, a: 1, b: 2, saveVersion: 3 });
  assert.throws(() => migrate({ saveVersion: 1 }, 1, { 1: steps[1] }, 3), MigrationError);
});

test('2 khe xoay vòng: mỗi lần lưu ghi sang khe còn lại', async () => {
  const store = new MemoryStore();
  const mgr = new SaveManager(store, content);
  const s = playedState();
  assert.equal(await mgr.save(s, T0), 'slot-a');
  assert.equal(await mgr.save(s, T0 + 1), 'slot-b');
  assert.equal(await mgr.save(s, T0 + 2), 'slot-a');
});

test('khe mới nhất bị hỏng thì khôi phục từ khe trước', async () => {
  const store = new MemoryStore();
  const mgr = new SaveManager(store, content);
  const s = playedState();
  await mgr.save(s, T0);
  s.player.coins += 500;
  const newer = await mgr.save(s, T0 + 1000);
  store.data.set(newer, store.data.get(newer)!.slice(0, 50));

  const loaded = await new SaveManager(store, content).load();
  assert.equal(loaded.kind, 'loaded');
  if (loaded.kind !== 'loaded') return;
  assert.equal(loaded.recoveredFromBackup, true);
  assert.equal(loaded.state.player.coins, s.player.coins - 500);
});

test('lưu tiếp sau khi khôi phục sẽ ghi đè khe hỏng, không đè khe tốt', async () => {
  const store = new MemoryStore();
  const s = playedState();
  const first = new SaveManager(store, content);
  const good = await first.save(s, T0);
  const bad = await first.save(s, T0 + 1);
  store.data.set(bad, 'hỏng');
  const mgr = new SaveManager(store, content);
  await mgr.load();
  assert.equal(await mgr.save(s, T0 + 2), bad);
  assert.ok(deserialize(store.data.get(good)!));
});

test('cả hai khe hỏng thì báo không đọc được, không tự tạo game mới', async () => {
  const store = new MemoryStore();
  store.data.set('slot-a', 'x');
  store.data.set('slot-b', 'y');
  const r = await new SaveManager(store, content).load();
  assert.equal(r.kind, 'unreadable');
  assert.equal(store.data.get('slot-a'), 'x');
});

test('chưa có save thì báo trống', async () => {
  assert.deepEqual(await new SaveManager(new MemoryStore(), content).load(), { kind: 'empty' });
});

test('đồng hồ lùi thì savedAt vẫn tăng, bản mới vẫn được chọn khi tải', async () => {
  const store = new MemoryStore();
  const mgr = new SaveManager(store, content);
  const s = playedState();
  await mgr.save(s, T0 + 10_000);
  s.player.coins = 777;
  await mgr.save(s, T0);
  const r = await new SaveManager(store, content).load();
  assert.ok(r.kind === 'loaded' && r.state.player.coins === 777);
});

test('xuất và nhập file sao lưu, kiểm tra hợp lệ', () => {
  const mgr = new SaveManager(new MemoryStore(), content);
  const s = playedState();
  const text = mgr.exportText(s, T0);
  assert.deepEqual(mgr.parseImport(text).state, s);
  assert.throws(() => mgr.parseImport(text.replace('"seed":', '"seed":1')), SaveFormatError);
});

/** A version-1 save, in the exact shape written before R2 (caughtBugStages). */
function v1SaveText(): string {
  const s = newGame(content);
  dispatch(content, s, { type: 'plant', cropId: DAISY, floor: 0, slot: 0 }, T0);
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>;
  raw.saveVersion = 1;
  delete raw.clockOffsetMs;
  const p = raw.floors[0].slots[0].planting;
  delete p.caughtBugs;
  p.caughtBugStages = [2, 3];
  const data = JSON.stringify(raw);
  return `{"format":"${SAVE_FORMAT}","saveVersion":1,"savedAt":${T0},"checksum":"${checksumOf(data)}","data":${data}}`;
}

test('migration 1 → 2 → 3: caughtBugStages đổi thành caughtBugs, thêm clockOffsetMs, cây vẫn còn', () => {
  const { state, migratedFrom } = deserialize(v1SaveText());
  assert.equal(migratedFrom, 1);
  assert.ok(state.saveVersion >= 2);
  const p = state.floors[0]!.slots[0]!.planting!;
  assert.equal(p.cropId, DAISY);
  assert.deepEqual(p.caughtBugs, {});
  assert.equal('caughtBugStages' in p, false);
  assert.equal(state.clockOffsetMs, 0);
  assert.ok(dispatch(content, state, { type: 'harvest', floor: 0, slot: 0 }, T0 + 2 * MIN).ok);
});

test('migration 2 → 3: thêm clockOffsetMs = 0, giữ nguyên phần còn lại', () => {
  const s = newGame(content);
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete raw.clockOffsetMs;
  raw.saveVersion = 2;
  const out = migrate(raw, 2) as Record<string, unknown>;
  assert.equal(out.clockOffsetMs, 0);
  assert.equal(out.saveVersion, SAVE_VERSION);
  assert.deepEqual({ ...out, clockOffsetMs: undefined, saveVersion: undefined }, { ...raw, clockOffsetMs: undefined, saveVersion: undefined });
});
