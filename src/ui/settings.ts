// Settings: sound, manual backup (export/import). Import always asks for confirmation.

import { backupFileName, deliverTextFile, pickTextFile } from '../app/backup.ts';
import type { GameSession } from '../app/session.ts';
import type { Sfx } from '../app/sfx.ts';
import { clear, h } from './dom.ts';
import { Panel } from './panels.ts';
import type { Toasts } from './toast.ts';

declare const __APP_VERSION__: string;

export class SettingsPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly sfx: Sfx,
    private readonly toasts: Toasts,
    private readonly saveSound: (on: boolean) => void,
  ) {
    super('Cài đặt', 'settings-panel');
    this.render();
  }

  render(): void {
    clear(this.body);
    const sound = h(
      'button',
      {
        class: 'small-btn',
        onclick: () => {
          this.sfx.enabled = !this.sfx.enabled;
          this.saveSound(this.sfx.enabled);
          this.render();
        },
      },
      this.sfx.enabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt',
    );
    const exportBtn = h('button', { class: 'small-btn', 'data-test': 'export-save', onclick: () => void this.exportSave() }, 'Xuất bản sao lưu');
    const importBtn = h('button', { class: 'small-btn', 'data-test': 'import-save', onclick: () => void this.importSave() }, 'Nhập bản sao lưu');
    this.body.append(
      h('div', { class: 'settings-row' }, sound),
      h('p', { class: 'lead' }, 'Sao lưu'),
      h('p', { class: 'note' }, 'Game tự lưu trên máy. Nên xuất bản sao lưu thỉnh thoảng và cất vào Tệp hoặc iCloud.'),
      h('div', { class: 'settings-row' }, exportBtn, importBtn),
      h('p', { class: 'note version' }, `Phiên bản ${__APP_VERSION__}`),
    );
  }

  private async exportSave(): Promise<void> {
    await this.session.saveNow();
    await deliverTextFile(backupFileName(this.session.now()), this.session.exportText());
  }

  private async importSave(): Promise<void> {
    const text = await pickTextFile();
    if (text === null) return;
    let next;
    try {
      next = this.session.parseBackup(text);
    } catch (e) {
      this.toasts.show(`File không hợp lệ: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return;
    }
    const ok = await confirmDialog(
      'Nhập bản sao lưu?',
      `Bản sao lưu: cấp ${next.player.level}, ${next.player.coins} xu. Tiến trình hiện tại sẽ được thay bằng bản này (bản hiện tại vẫn được giữ làm dự phòng).`,
      'Nhập và tải lại',
    );
    if (!ok) return;
    await this.session.replaceStoredSave(next);
    location.reload();
  }
}

/** In-game confirmation (no browser alert/confirm dialogs). */
export function confirmDialog(title: string, message: string, okLabel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      el.remove();
      resolve(v);
    };
    const el = h(
      'div',
      { class: 'backdrop confirm' },
      h(
        'div',
        { class: 'sheet small', role: 'alertdialog', 'aria-label': title },
        h('h2', {}, title),
        h('p', { class: 'note' }, message),
        h(
          'div',
          { class: 'settings-row' },
          h('button', { class: 'small-btn', onclick: () => done(false) }, 'Hủy'),
          h('button', { class: `primary-btn${danger ? ' danger' : ''}`, 'data-test': 'confirm-ok', onclick: () => done(true) }, okLabel),
        ),
      ),
    );
    document.body.append(el);
  });
}
