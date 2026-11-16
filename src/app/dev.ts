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
  /** Builds the benchmark scene (2 floors × 10 level-50 pots, growing plants). Saving must be stopped first. */
  benchScene: () => void;
  textureBytes: () => Record<string, number>;
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
  let bench: number[] | null = null;
  let lastStamp = 0;
  view.onFrame = (dt) => {
    // Real time between frames (the ticker's own delta is capped at 100 ms, which hides stalls).
    const stamp = performance.now();
    if (bench && lastStamp > 0) bench.push(stamp - lastStamp);
    lastStamp = stamp;
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
    btn('Đo hiệu năng', async () => {
      // REVIEW 02 #3: measured on the device itself, no console needed. The player's save is never
      // touched: saving stops before the test scene is built, and the game reloads afterwards.
      const ok = await confirmDialog(
        'Đo hiệu năng?',
        'Game tạm dừng lưu, dựng 2 tầng × 10 chậu cấp 50 có cây đang lớn, đo 10 giây rồi hiện kết quả. Tiến trình thật của bạn không thay đổi; bấm "Mở lại game" để quay về.',
        'Bắt đầu đo',
      );
      if (!ok) return;
      await session.saveNow();
      await session.stopSaving();
      opts.benchScene();
      await new Promise((r) => setTimeout(r, 2000)); // warm-up: textures uploaded, camera settled
      bench = [];
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 10_000));
      const dts = bench;
      bench = null;
      const secs = (performance.now() - t0) / 1000;
      const sorted = [...dts].sort((a, b) => b - a);
      const worst1 = sorted.slice(0, Math.max(1, Math.round(sorted.length / 100)));
      const low1 = 1000 / (worst1.reduce((a, b) => a + b, 0) / worst1.length);
      const tex = opts.textureBytes();
      const mb = (b: number) => (b / 1048576).toFixed(1);
      const total = Object.values(tex).reduce((a, b) => a + b, 0);
      const result = {
        renderer: view.rendererName,
        screen: `${Math.round(view.app.screen.width)}×${Math.round(view.app.screen.height)} @${view.app.renderer.resolution}x`,
        fpsAvg: Math.round((dts.length / secs) * 10) / 10,
        fpsMin: Math.round((1000 / (sorted[0] ?? 16.7)) * 10) / 10,
        fpsLow1: Math.round(low1 * 10) / 10,
        frames: dts.length,
        textureMB: Object.fromEntries(Object.entries(tex).map(([k, v]) => [k, Number(mb(v))])),
        textureTotalMB: Number(mb(total)),
        ua: navigator.userAgent,
      };
      const box = h(
        'div',
        { class: 'bench-result', 'data-test': 'bench-result' },
        h('strong', {}, 'Kết quả đo (10 giây)'),
        h('span', {}, `FPS trung bình: ${result.fpsAvg} · thấp nhất: ${result.fpsMin} · 1% thấp: ${result.fpsLow1}`),
        h('span', {}, `Texture: ${result.textureTotalMB} MB (${Object.entries(result.textureMB).map(([k, v]) => `${k} ${v}`).join(', ')})`),
        h('span', {}, `${result.renderer} · ${result.screen}`),
        h('pre', {}, JSON.stringify(result)),
        h('button', { class: 'dev-btn', onclick: () => location.reload() }, 'Mở lại game'),
      );
      opts.overlay.append(box);
      (window as unknown as { __pbtcBench?: unknown }).__pbtcBench = result;
    }),
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
