// Short messages (errors, level up, recovered save, update ready).
// Chỉ thị 11 đính chính D3: at most 2 on screen, the rest wait in a queue (never dropped, never stacked
// on top of each other), compact one-line bands just above the bottom dock, clear of the floor signs.

import { h } from './dom.ts';

export type ToastKind = 'info' | 'error' | 'success' | 'level';

const MAX_VISIBLE = 2;
const FADE_MS = 300;

type Item = { message: string; kind: ToastKind; durationMs: number; action?: { label: string; run: () => void } };

export class Toasts {
  readonly el = h('div', { class: 'toasts', 'aria-live': 'polite' });
  private readonly queue: Item[] = [];

  show(message: string, kind: ToastKind = 'info', durationMs = 2600, action?: { label: string; run: () => void }): void {
    // Same message twice in a row (e.g. tapping fast) shows once.
    const shown = [...this.el.children].map((c) => c.firstElementChild?.textContent);
    if (shown.includes(message) || this.queue.some((q) => q.message === message)) return;
    this.queue.push({ message, kind, durationMs, action });
    this.pump();
  }

  /** Puts queued messages on screen while there is room. */
  private pump(): void {
    while (this.queue.length > 0 && this.el.querySelectorAll('.toast:not(.out)').length < MAX_VISIBLE) {
      const it = this.queue.shift()!;
      const t = h('div', { class: `toast ${it.kind}` }, h('span', {}, it.message));
      const done = () => {
        if (t.classList.contains('out')) return;
        t.classList.add('out');
        setTimeout(() => {
          t.remove();
          this.pump();
        }, FADE_MS);
      };
      if (it.action) {
        t.append(
          h('button', {
            class: 'small-btn',
            onclick: () => {
              done();
              it.action!.run();
            },
          }, it.action.label),
        );
        // A message with a button stays a while longer, then still makes room for the queue.
        setTimeout(done, Math.max(it.durationMs, 8000));
      } else {
        // Waiting in the queue does not eat into the time on screen; a long queue moves a bit faster.
        setTimeout(done, this.queue.length > 2 ? Math.min(it.durationMs, 1800) : it.durationMs);
      }
      this.el.append(t);
    }
  }
}
