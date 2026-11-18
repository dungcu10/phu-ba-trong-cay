// Chỉ thị 12 B1.2: Hẹn giờ — the list of what will be done and when (local clock), to plan the next visit.

import type { GameSession } from '../app/session.ts';
import { upcoming } from '../systems/timers.ts';
import { clear, h } from './dom.ts';
import { Panel } from './panel.ts';
import { formatClock } from './text.ts';

/** Local clock time ("14:30") of a game time. */
export function clockAt(session: GameSession, at: number): string {
  const real = at - session.state.clockOffsetMs;
  const d = new Date(real);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export class TimersPanel extends Panel {
  constructor(private readonly session: GameSession) {
    super('Hẹn giờ', 'timers-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    const now = this.session.now();
    const list = upcoming(content, state, now);
    this.body.append(h('p', { class: 'lead' }, 'Những việc sắp xong. Chọn giờ quay lại cho vừa nhé!'));
    if (list.length === 0) {
      this.body.append(h('p', { class: 'note' }, 'Không có gì đang chờ. Gieo hạt, gửi đơn hoặc nạp xưởng để có hẹn giờ.'));
      return;
    }
    const ul = h('div', { class: 'timer-list' });
    for (const t of list) ul.append(h('div', { class: `timer-row k-${t.kind}` }, h('strong', { class: 'timer-at' }, clockAt(this.session, t.at)), h('span', {}, t.text), h('span', { class: 'note' }, `còn ${formatClock(t.at - now)}`)));
    this.body.append(ul);
  }

  tick(): void {
    this.render();
  }
}
