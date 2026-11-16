// R5 (CTO review 01): saves are checked against the current content pack after loading.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContentError } from '../src/core/content.ts';
import { dispatch } from '../src/core/game.ts';
import { SAVE_VERSION, type GameState } from '../src/core/state.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { SaveManager } from '../src/persistence/saveManager.ts';
import { checksumOf, SAVE_FORMAT, SaveFormatError } from '../src/persistence/serializer.ts';
import { MemoryStore } from '../src/persistence/store.ts';
import { buildContentPack, BUG, loadBase, MIN, newGame, readRaw, T0, TOMATO } from './helpers.ts';

const content = await loadBase();

/** Wraps any (possibly broken) state object in a valid save envelope with a correct checksum. */
function envelope(data: unknown, version = SAVE_VERSION): string {
  const json = JSON.stringify(data);
  return `{"format":"${SAVE_FORMAT}","saveVersion":${version},"savedAt":${T0},"checksum":"${checksumOf(json)}","data":${json}}`;
}

function stateWithTomato(): GameState {
  const s = newGame(content, { level: 2 });
  assert.ok(dispatch(content, s, { type: 'plant', cropId: TOMATO, floor: 0, slot: 0 }, T0).ok);
  return s;
}

async function loadLocal(text: string, pack = content) {
  const store = new MemoryStore();
  store.data.set('slot-a', text);
  return new SaveManager(store, pack).load();
}

test('tái hiện R5: cropId không tồn tại + coins âm — save trong máy được sửa, game chạy được', async () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  s.floors[0].slots[0].planting.cropId = 'base:crop.khong-co';
  s.player.coins = -5;
  const r = await loadLocal(envelope(s));
  assert.equal(r.kind, 'loaded');
  if (r.kind !== 'loaded') return;
  assert.equal(r.state.floors[0]!.slots[0]!.planting, null);
  assert.equal(r.state.player.coins, 0 + content.crops.get(TOMATO)!.seedPrice, 'xu về 0 rồi hoàn tiền hạt');
  assert.ok(r.warnings.some((w) => w.includes('khong-co')));
  assert.ok(r.warnings.some((w) => w.includes('số xu')));
  for (const slot of r.state.floors[0]!.slots) cropStatus(content, r.state, slot, T0 + MIN);
});

test('tái hiện R5: file nhập có coins âm bị từ chối', () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  s.floors[0].slots[0].planting.cropId = 'base:crop.khong-co';
  s.player.coins = -5;
  const mgr = new SaveManager(new MemoryStore(), content);
  assert.throws(() => mgr.parseImport(envelope(s)), (e: unknown) => e instanceof SaveFormatError && /số xu/.test(e.message));
});

test('file nhập: cây đã bị gỡ (số liệu hợp lệ) được nhận, dọn chậu, hoàn tiền hạt, có cảnh báo', () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  s.floors[0].slots[0].planting.cropId = 'base:crop.khong-co';
  const coins = s.player.coins;
  const { state, warnings } = new SaveManager(new MemoryStore(), content).parseImport(envelope(s));
  assert.equal(state.floors[0]!.slots[0]!.planting, null);
  assert.equal(state.player.coins, coins + content.crops.get(TOMATO)!.seedPrice);
  assert.equal(warnings.length, 1);
});

test('NaN (JSON ghi thành null), cấp chậu vượt mức, số lượng lẻ: nhập thì từ chối, trong máy thì sửa', async () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  s.player.xp = null;
  s.pots['pot-1'].level = 99;
  s.inventory[BUG] = 2.5;
  const mgr = new SaveManager(new MemoryStore(), content);
  assert.throws(() => mgr.parseImport(envelope(s)), (e: unknown) => {
    const m = (e as Error).message;
    return e instanceof SaveFormatError && /kinh nghiệm/.test(m) && /cấp/.test(m) && /số lượng/.test(m);
  });
  const r = await loadLocal(envelope(s));
  assert.ok(r.kind === 'loaded');
  if (r.kind !== 'loaded') return;
  assert.equal(r.state.player.xp, 0);
  assert.equal(r.state.pots['pot-1']!.level, content.pots.get('base:pot.terracotta')!.levels.length);
  assert.equal(r.state.inventory[BUG], 2);
});

test('vật phẩm, loại chậu, loại bọ không còn tồn tại được dọn', async () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  s.inventory['base:item.da-bo'] = 4;
  s.pots['pot-2'].potId = 'base:pot.da-bo';
  s.floors[0].slots[0].planting.caughtBugs = { 'base:bug.da-bo': 3 };
  const r = await loadLocal(envelope(s));
  assert.ok(r.kind === 'loaded');
  if (r.kind !== 'loaded') return;
  assert.equal(r.state.inventory['base:item.da-bo'], undefined);
  assert.equal(r.state.pots['pot-2']!.potId, 'base:pot.terracotta');
  assert.deepEqual(r.state.floors[0]!.slots[0]!.planting!.caughtBugs, {});
});

test('game mở được và chơi tiếp với save có cây đã bị gỡ khỏi nội dung', async () => {
  const s = stateWithTomato();
  const raw = await readRaw();
  raw.crops = (raw.crops as Array<{ id: string }>).filter((c) => c.id !== TOMATO);
  const smaller = buildContentPack(raw);
  const r = await loadLocal(envelope(s), smaller);
  assert.ok(r.kind === 'loaded');
  if (r.kind !== 'loaded') return;
  const at = { floor: 0, slot: 0 };
  assert.equal(cropStatus(smaller, r.state, r.state.floors[0]!.slots[0]!, T0), null);
  assert.ok(dispatch(smaller, r.state, { type: 'plant', cropId: 'base:crop.cotton-daisy', ...at }, T0).ok);
  assert.ok(dispatch(smaller, r.state, { type: 'harvest', ...at }, T0 + 2 * MIN).ok);
});

test('save cũ (bản 3) thiếu seedCost: được điền giá hạt hiện tại', () => {
  const s = stateWithTomato() as unknown as Record<string, any>;
  delete s.floors[0].slots[0].planting.seedCost;
  s.saveVersion = 3;
  const { state } = new SaveManager(new MemoryStore(), content).parseImport(envelope(s, 3));
  assert.equal(state.floors[0]!.slots[0]!.planting!.seedCost, content.crops.get(TOMATO)!.seedPrice);
});

test('gói nội dung: cây thu nhiều lần mà dưới 4 giai đoạn bị từ chối', async () => {
  const raw = await readRaw();
  const tomato = (raw.crops as Array<Record<string, unknown>>).find((c) => c.id === TOMATO)!;
  tomato.stages = 3;
  assert.throws(() => buildContentPack(raw), (e: unknown) => e instanceof ContentError && e.problems.some((p) => p.includes('ít nhất 4 giai đoạn')));
});
