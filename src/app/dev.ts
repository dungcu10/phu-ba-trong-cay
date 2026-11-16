// Developer tools, only with ?dev=1 (ROADMAP giai đoạn 0): FPS meter, fast-forward time,
// safe save reset (a backup file is offered first, then a double confirmation).

import { Text } from 'pixi.js';
import { OffsetClock } from '../core/clock.ts';
import type { GameView } from '../render/scene.ts';
import { confirmDialog } from '../ui/settings.ts';
import { h } from '../ui/dom.ts';
import { TOKENS } from '../ui/tokens.ts';
import { backupFileName, deliverTextFile } from './backup.ts';
import type { GameSession } from './session.ts';

const OFFSET_KEY = 'pbtc-dev-offset-ms';

export function devEnabled(): boolean {
  return new URLSearchParams(location.search).has('dev');
}

/** Real clock plus a fast-forward offset that survives reloads (dev only). */
export function devClock(): OffsetClock {
  const clock = new OffsetClock({ now: () => Date.now() });
  const saved = Number(localStorageGet(OFFSET_KEY) ?? 0);
  if (Number.isFinite(saved) && saved > 0) clock.advance(saved);
  return clock;
}

function localStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the offset then lasts for this visit only.
  }
}

export function installDevTools(opts: {
  session: GameSession;
  view: GameView;
  clock: OffsetClock;
  overlay: HTMLElement;
  resync: () => void;
  resetSaves: () => Promise<void>;
}): void {
  const { session, view, clock } = opts;

  // FPS meter drawn in PixiJS (no DOM writes from the render loop). Average and 1% low over ~2 s.
  const fpsText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 13, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } }, resolution: 2 });
  fpsText.anchor.set(0.5, 1);
  const placeFps = () => fpsText.position.set(view.app.screen.width / 2, view.app.screen.height - 8);
  placeFps();
  view.app.renderer.on("resize", placeFps);
  view.app.stage.addChild(fpsText);
  const samples = new Float32Array(120);
  let n = 0;
  let filled = false;
  view.onFrame = (dt) => {
    samples[n] = dt;
    n = (n + 1) % samples.length;
    if (n === 0) filled = true;
    if (n % 30 !== 0) return;
    const count = filled ? samples.length : n;
    let sum = 0;
    let worst = 0;
    for (let i = 0; i < count; i++) {
      sum += samples[i]!;
      worst = Math.max(worst, samples[i]!);
    }
    fpsText.text = `${view.rendererName} · ${(1000 / (sum / count)).toFixed(0)} FPS · max ${worst.toFixed(1)} ms`;
  };

  const skip = (ms: number) => {
    clock.advance(ms);
    localStorageSet(OFFSET_KEY, String(Number(localStorageGet(OFFSET_KEY) ?? 0) + ms));
    opts.resync();
  };
  const btn = (label: string, run: () => void) => h('button', { class: 'dev-btn', onclick: run }, label);
  const panel = h(
    'div',
    { class: 'dev-panel', 'data-test': 'dev-panel' },
    h('span', {}, 'DEV'),
    btn('+1 phút', () => skip(60_000)),
    btn('+10 phút', () => skip(600_000)),
    btn('+1 giờ', () => skip(3_600_000)),
    btn('+8 giờ', () => skip(8 * 3_600_000)),
    btn('Reset save', async () => {
      await session.saveNow();
      await deliverTextFile(backupFileName(session.now()), session.exportText());
      const ok = await confirmDialog('Xóa toàn bộ dữ liệu?', 'Đã tạo bản sao lưu. Dữ liệu chơi trên máy này sẽ bị xóa và bắt đầu lại từ đầu.', 'Xóa và bắt đầu lại', true);
      if (!ok) return;
      await opts.resetSaves();
      localStorageSet(OFFSET_KEY, '0');
      location.reload();
    }),
  );
  panel.style.setProperty('--dev-gap', `${TOKENS.space[1]}px`);
  opts.overlay.append(panel);
}
