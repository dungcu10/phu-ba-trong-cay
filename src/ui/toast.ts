// Short messages at the top of the screen (errors, level up, recovered save, update ready).

import { h } from './dom.ts';

export type ToastKind = 'info' | 'error' | 'success' | 'level';

export class Toasts {
  readonly el = h('div', { class: 'toasts', 'aria-live': 'polite' });

  show(message: string, kind: ToastKind = 'info', durationMs = 2600, action?: { label: string; run: () => void }): void {
    const t = h('div', { class: `toast ${kind}` }, h('span', {}, message));
    if (action) {
      t.append(
        h('button', {
          class: 'small-btn',
          onclick: () => {
            t.remove();
            action.run();
          },
        }, action.label),
      );
    }
    // Same message twice in a row (e.g. tapping fast) shows once.
    const last = this.el.lastElementChild;
    if (last?.textContent === t.textContent) last.remove();
    this.el.append(t);
    // At most two at once so they never cover the floor signs (nâng cấp v3 đợt 1).
    while (this.el.children.length > 2) this.el.firstElementChild?.remove();
    if (!action) setTimeout(() => t.classList.add('out'), durationMs);
    if (!action) setTimeout(() => t.remove(), durationMs + 300);
  }
}
