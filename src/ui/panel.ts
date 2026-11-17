// Base window: dark wood frame, paper face, ribbon title, round close knob (DESIGN_SYSTEM 5–6).

import { h } from './dom.ts';
import { TOKENS } from './tokens.ts';

/** A window: dark wood frame, paper face, ribbon title, round close knob. */
export abstract class Panel {
  readonly el: HTMLElement;
  protected readonly body = h('div', { class: 'win-body scroll' });
  onClose: (() => void) | null = null;
  private closed = false;

  constructor(title: string, testId: string, extraClass = '') {
    const close = h('button', { class: 'knob close', 'aria-label': 'Đóng', onclick: () => this.close() });
    const win = h('div', { class: `win ${extraClass}`, role: 'dialog', 'aria-label': title, 'data-test': testId }, h('div', { class: 'ribbon' }, h('h2', {}, title)), close, this.body);
    this.el = h('div', { class: 'veil' }, win);
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  abstract render(): void;

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.el.classList.add('closing');
    setTimeout(() => this.el.remove(), TOKENS.motion.windowClose.ms);
    this.onClose?.();
  }
}
