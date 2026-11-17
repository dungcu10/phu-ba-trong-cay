// Chỉ thị 10 § 3.5: Xưởng Bọ window. One card per machine: its worker bug (approved art, a working
// bob in CSS), the recipes with what the player has of each input, the queue with its countdowns,
// and the star / extra-slot buttons. Reads state, sends commands only. Opened by openWorkshop()
// (chỉ thị 11: the village house will call the same function).

import type { GameSession } from '../app/session.ts';
import { jobInputs, machineState, nextSlotCost, nextStarCost, jobMs } from '../systems/workshop.ts';
import { itemIcon } from './icons.ts';
import { clear, h } from './dom.ts';
import { Panel } from './panel.ts';
import { shake } from './potPanels.ts';
import { formatMinutes, formatNumber } from './text.ts';
import { coin } from './worldPanels.ts';

export interface WorkshopActions {
  startJob(recipeId: string): void;
  upgradeMachine(machineId: string): void;
  buyMachineSlot(machineId: string): void;
}

export class WorkshopPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly actions: WorkshopActions,
  ) {
    super('Xưởng Bọ', 'workshop-panel', 'win-wide');
    this.render();
  }

  render(): void {
    clear(this.body);
    const { content, state } = this.session;
    if (!content.machines) return;
    const now = this.session.now();
    const list = h('div', { class: 'bird-list workshop' });
    for (const machine of content.machines.values()) {
      const open = state.player.level >= machine.unlockLevel;
      const worker = itemIcon(content, machine.worker, 64);
      worker.classList.add('worker-bob');
      if (!open) {
        list.append(h('div', { class: 'page bird-card unknown', 'data-test': `machine-${machine.id}` }, worker, h('strong', {}, machine.name.vi), h('span', { class: 'pack-info' }, `Mở ở cấp ${machine.unlockLevel}`)));
        continue;
      }
      const m = state.workshop[machine.id] ?? machineState(content, structuredClone(state), machine.id);
      const busy = m.queue.length > 0 && m.queue[0]!.endsAt > now;
      if (!busy) worker.classList.add('idle');
      const recipes = h('div', { class: 'recipes' });
      for (const r of machine.recipes) {
        const take = jobInputs(machine, r);
        const enough = Object.entries(take).every(([id, q]) => (state.inventory[id] ?? 0) >= q);
        const ok = enough && m.queue.length < m.slots;
        const btn = h('button', { class: `candy ${ok ? 'primary' : 'blocked'} small`, 'data-test': `start-${r.id}`, onclick: () => (ok ? this.actions.startJob(r.id) : shake(btn)) }, 'Làm');
        recipes.append(
          h(
            'div',
            { class: 'recipe' },
            h('span', { class: 'recipe-in' }, ...Object.entries(take).map(([id, q]) => h('span', { class: `order-line${(state.inventory[id] ?? 0) >= q ? ' done' : ''}` }, itemIcon(content, id, 28), h('span', { class: 'qty-tag' }, `${Math.min(state.inventory[id] ?? 0, q)}/${q}`)))),
            h('span', { class: 'recipe-arrow' }, '→'),
            h('span', { class: 'recipe-out', title: content.items.get(r.output)?.name.vi ?? '' }, itemIcon(content, r.output, 34), h('span', { class: 'pack-info' }, formatMinutes(jobMs(content, r, m.stars)))),
            btn,
          ),
        );
      }
      const queue = h('div', { class: 'bird-floors' });
      for (let i = 0; i < m.slots; i++) {
        const job = m.queue[i];
        if (!job) {
          queue.append(h('span', { class: 'chip' }, 'Trống'));
          continue;
        }
        const out = content.recipes?.get(job.recipe)?.recipe.output ?? '';
        const left = job.endsAt - now;
        queue.append(h('span', { class: `chip${left <= 0 ? ' on' : ''}` }, itemIcon(content, out, 20), left <= 0 ? 'Xong (chờ kho trống)' : formatMinutes(left)));
      }
      const star = nextStarCost(content, machine, m, state.player.level);
      const slot = nextSlotCost(content, m, state.player.level);
      const starBtn =
        star &&
        h(
          'button',
          { class: 'candy plain small', 'data-test': `star-${machine.id}`, onclick: () => this.actions.upgradeMachine(machine.id) },
          coin(16),
          `${formatNumber(star.coins)} + `,
          ...Object.entries(star.items).map(([id, q]) => h('span', {}, itemIcon(content, id, 18), `${q}`)),
          ' · Nâng sao',
        );
      const slotBtn = slot !== null && h('button', { class: 'candy plain small', 'data-test': `slot-${machine.id}`, onclick: () => this.actions.buyMachineSlot(machine.id) }, coin(16), `${formatNumber(slot)} · Thêm khe`);
      list.append(
        h(
          'div',
          { class: 'page bird-card', 'data-test': `machine-${machine.id}` },
          worker,
          h('strong', {}, `${machine.name.vi} ${'★'.repeat(m.stars)}${'☆'.repeat(5 - m.stars)}`),
          recipes,
          h('span', { class: 'pack-info' }, `Hàng chờ ${m.queue.length}/${m.slots}`),
          queue,
          h('span', { class: 'note-actions' }, starBtn, slotBtn),
        ),
      );
    }
    this.body.append(h('p', { class: 'lead' }, 'Bọ thợ chế biến nông sản thành hàng giá cao, cả khi bạn tắt game. Làm xong, hàng tự vào Rương Mây.'), list);
  }
}
