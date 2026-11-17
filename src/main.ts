// Boot: content → saved game (never overwritten on read errors) → PixiJS view → HTML UI.

import { makeDemo } from './app/demo.ts';
import './styles.css';
import './theme-fantasy.css';

import { systemClock, type Clock } from './core/clock.ts';
import { createNewGame } from './core/state.ts';
import { SaveManager, SLOT_KEYS } from './persistence/saveManager.ts';
import { IndexedDbStore } from './persistence/store.ts';
import { loadWorld10 } from './render/world10.ts';
import { Art } from './render/assets.ts';
import { GameView, type RendererPreference } from './render/scene.ts';
import { h } from './ui/dom.ts';
import { applyTokensToCss } from './ui/tokens.ts';
import { backupFileName, deliverTextFile, pickTextFile } from './app/backup.ts';
import { loadBundledContent } from './app/contentSource.ts';
import { Controller } from './app/controller.ts';
import { devClock, devEnabled, installDevTools } from './app/dev.ts';
import { installGestureGuards } from './app/gestures.ts';
import { installLifecycle, requestPersistentStorage } from './app/lifecycle.ts';
import { registerServiceWorker } from './app/serviceWorker.ts';
import { GameSession } from './app/session.ts';
import { Sfx } from './app/sfx.ts';

declare const __COMMIT__: string;
declare const __TRIAL__: boolean;

const SOUND_KEY = 'pbtc-sound';

function fatal(title: string, detail: string, actions: HTMLElement[] = []): void {
  document.getElementById('loading')?.remove();
  document.body.append(
    h('div', { class: 'veil fatal' }, h('div', { class: 'win win-confirm', role: 'alertdialog' }, h('div', { class: 'ribbon' }, h('h2', {}, title)), h('p', { class: 'note' }, detail), h('div', { class: 'settings-row' }, ...actions))),
  );
}

async function boot(): Promise<void> {
  applyTokensToCss();
  installGestureGuards();
  if (__TRIAL__) document.body.append(h('div', { class: 'trial-badge', 'data-test': 'trial-badge' }, `BẢN THỬ · ${__COMMIT__}`));

  const content = await loadBundledContent();
  const dev = devEnabled();
  const clock: Clock = dev ? devClock() : systemClock;
  const store = new IndexedDbStore();
  const saves = new SaveManager(store, content);

  const loaded = await saves.load();
  if (loaded.kind === 'unreadable') {
    // Never replace the player's data with a new game: offer to keep a copy or import a backup.
    const raw = await Promise.all(SLOT_KEYS.map((k) => store.get(k)));
    fatal('Không đọc được dữ liệu đã lưu', `Dữ liệu trên máy bị hỏng (${loaded.errors.join('; ')}). Game chưa xóa gì. Hãy tải bản hỏng về để gửi hỗ trợ, hoặc nhập một bản sao lưu.`, [
      h('button', { class: 'candy plain', onclick: () => void deliverTextFile('du-lieu-hong.txt', raw.map((r) => r ?? '').join('\n---\n')) }, 'Tải bản hỏng về'),
      h('button', {
        class: 'candy primary',
        onclick: async () => {
          const text = await pickTextFile();
          if (!text) return;
          try {
            const { state } = saves.parseImport(text);
            await saves.save(state, clock.now());
            location.reload();
          } catch (e) {
            alertInline(e instanceof Error ? e.message : String(e));
          }
        },
      }, 'Nhập bản sao lưu'),
    ]);
    return;
  }
  const state = loaded.kind === 'loaded' ? loaded.state : createNewGame(content, clock.now(), clock.now() ^ Math.floor(Math.random() * 0x7fffffff));
  const session = new GameSession(content, state, clock, saves);
  if (loaded.kind === 'empty') await session.saveNow(true);

  // Directive 05 step 3: the retired catalog pots' atlas (29.5 MB of GPU memory) is only loaded when
  // the save still owns one of those pots. The dev demo that places them loads it on demand.
  const ownsCatalogPot = Object.values(state.pots).some((p) => content.pots.get(p.potId)?.sprite.startsWith('pots/catalog/'));
  const art = await Art.load(ownsCatalogPot ? [] : ['pots_catalog']);
  // Chỉ thị 10: the approved world art (vine, cloud rings, pedestals, bugs, birds, Xu Xu); floors load lazily.
  await loadWorld10(art);
  const missing = art.missingFor(content);
  if (missing.length > 0) throw new Error(`Thiếu hình cho nội dung: ${missing.join(', ')}`);

  // Giao diện fantasy: make sure the faces used by the canvas text are loaded before drawing.
  await Promise.all(['500 16px "Be Vietnam Pro"', '700 16px "Be Vietnam Pro"', '700 16px "Cormorant Garamond"'].map((f) => document.fonts.load(f))).catch(() => undefined);
  await document.fonts.ready;
  const preference: RendererPreference = new URLSearchParams(location.search).get('renderer') === 'webgl' ? 'webgl' : 'webgpu';
  const host = document.getElementById('game')!;
  const view = await GameView.create(host, session, art, preference);
  watchGpuLoss(view, session);

  const sfx = new Sfx();
  sfx.enabled = readSetting(SOUND_KEY) !== 'off';
  sfx.armOnFirstTouch();
  const overlay = document.getElementById('ui')!;
  const controller = new Controller(session, view, art, sfx, overlay, (on) => writeSetting(SOUND_KEY, on ? 'on' : 'off'));

  installLifecycle(session, () => controller.resync());
  void requestPersistentStorage();
  if (loaded.kind === 'loaded' && loaded.recoveredFromBackup) controller.toasts.show('Bản lưu mới nhất bị lỗi — đã khôi phục bản lưu trước đó.', 'info', 5000);
  if (loaded.kind === 'loaded' && loaded.warnings.length > 0) controller.toasts.show(`Đã chỉnh dữ liệu cho khớp phiên bản mới: ${loaded.warnings.join('; ')}`, 'info', 6000);
  if (dev && 'advance' in clock) {
    installDevTools({
      session,
      view,
      clock: clock as ReturnType<typeof devClock>,
      overlay,
      resync: () => controller.resync(),
      resetSaves: async () => {
        await session.stopSaving();
        for (const k of SLOT_KEYS) await store.delete(k);
      },
      benchScene: () => {
        const w = window as unknown as { __pbtc?: { demo?: (s: string) => boolean } };
        w.__pbtc?.demo?.('signature'); // directive 04: one floor of 10 signature pots
        setTimeout(() => w.__pbtc?.demo?.('floor0'), 1200);
      },
      textureBytes: () => art.textureBytes(),
    });
  }
  registerServiceWorker((apply) =>
    controller.toasts.show('Có bản mới của game.', 'info', 0, {
      label: 'Cập nhật',
      run: async () => {
        await session.saveNow(true);
        apply();
      },
    }),
  );
  document.getElementById('loading')?.remove();
  window.addEventListener('beforeunload', () => void session.saveNow());
  // Exposed for the automated browser tests only.
  const runDemo = dev && 'advance' in clock ? makeDemo(session, view, controller, clock as ReturnType<typeof devClock>) : undefined;
  const demo = runDemo
    ? (step: string): boolean => {
        // The directive 03 demo places retired catalog pots: bring their atlas in, then redraw.
        if (step === 'blender' && art.notLoaded.has('pots_catalog')) void art.loadSheet('pots_catalog').then(() => controller.resync());
        return runDemo(step);
      }
    : undefined;
  (window as unknown as { __pbtc?: unknown }).__pbtc = { session, view, backupFileName, demo };
}

/** WebGPU device loss cannot be recovered in place: save, then reload (no black screen). */
function watchGpuLoss(view: GameView, session: GameSession): void {
  const r = view.app.renderer as unknown as { gpu?: { device?: { lost: Promise<unknown> } } };
  void r.gpu?.device?.lost.then(async () => {
    await session.saveNow(true);
    location.reload();
  });
}

function alertInline(message: string): void {
  document.querySelector('.fatal .note')!.textContent = `File không hợp lệ: ${message}`;
}

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Settings are a convenience; the game works without them.
  }
}

boot().catch((e: unknown) => {
  fatal('Không mở được game', e instanceof Error ? e.message : String(e), [h('button', { class: 'candy primary', onclick: () => location.reload() }, 'Thử lại')]);
});
