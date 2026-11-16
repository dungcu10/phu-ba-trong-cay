// Settings: sound and manual backup (export/import). Import always asks for confirmation.

import { backupFileName, deliverTextFile, pickTextFile } from '../app/backup.ts';
import type { GameSession } from '../app/session.ts';
import type { Sfx } from '../app/sfx.ts';
import { clear, h } from './dom.ts';
import { Panel } from './panel.ts';
import type { Toasts } from './toast.ts';

declare const __APP_VERSION__: string;
declare const __COMMIT__: string;

export class SettingsPanel extends Panel {
  constructor(
    private readonly session: GameSession,
    private readonly sfx: Sfx,
    private readonly toasts: Toasts,
    private readonly saveSound: (on: boolean) => void,
  ) {
    super('Cài Đặt', 'settings-panel', 'win-confirm');
    this.render();
  }

  render(): void {
    clear(this.body);
    const sound = h(
      'button',
      {
        class: 'candy plain',
        onclick: () => {
          this.sfx.enabled = !this.sfx.enabled;
          this.saveSound(this.sfx.enabled);
          this.render();
        },
      },
      this.sfx.enabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt',
    );
    this.body.append(
      h('div', { class: 'settings-row' }, sound),
      h('p', { class: 'lead' }, 'Sao lưu'),
      h('p', { class: 'note' }, 'Game tự lưu trên máy. Thỉnh thoảng nên xuất bản sao lưu và cất vào Tệp hoặc iCloud.'),
      h(
        'div',
        { class: 'settings-row' },
        h('button', { class: 'candy gold', 'data-test': 'export-save', onclick: () => void this.exportSave() }, 'Xuất sao lưu'),
        h('button', { class: 'candy plain', 'data-test': 'import-save', onclick: () => void this.importSave() }, 'Nhập sao lưu'),
      ),
      this.upgradeBox,
      h('p', { class: 'note' }, `Phiên bản ${__APP_VERSION__} · ${__COMMIT__}`),
    );
    void this.renderUpgradeBackups();
  }

  private readonly upgradeBox = h('div', { class: 'upgrade-backups', 'data-test': 'upgrade-backups' });

  /** Copies of the save made automatically before a game update changed its format. */
  private async renderUpgradeBackups(): Promise<void> {
    const list = await this.session.upgradeBackups();
    clear(this.upgradeBox);
    if (list.length === 0) return;
    this.upgradeBox.append(h('p', { class: 'lead' }, 'Bản sao trước khi cập nhật'), h('p', { class: 'note' }, 'Game tự cất nguyên vẹn bản lưu cũ trước khi nâng cấp định dạng. Có thể tải về hoặc khôi phục.'));
    for (const b of [...list].reverse()) {
      const when = new Date(b.copiedAt).toLocaleString('vi-VN');
      this.upgradeBox.append(
        h(
          'div',
          { class: 'settings-row' },
          h('span', { class: 'note' }, `Định dạng ${b.fromVersion} · cất lúc ${when}`),
          h('button', { class: 'candy plain small', 'data-test': `download-${b.key}`, onclick: () => void this.downloadBackup(b.key, b.fromVersion) }, 'Tải về'),
          h('button', { class: 'candy gold small', 'data-test': `restore-${b.key}`, onclick: () => void this.restoreBackup(b.key) }, 'Khôi phục'),
        ),
      );
    }
  }

  private async downloadBackup(key: string, version: number): Promise<void> {
    const text = await this.session.upgradeBackupText(key);
    if (text) await deliverTextFile(`phu-ba-truoc-cap-nhat-v${version}.json`, text);
  }

  private async restoreBackup(key: string): Promise<void> {
    const text = await this.session.upgradeBackupText(key);
    if (!text) return;
    let parsed;
    try {
      parsed = this.session.parseBackup(text);
    } catch (e) {
      this.toasts.show(`Không đọc được bản sao: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return;
    }
    const next = parsed.state;
    const ok = await confirmDialog(
      'Khôi phục bản trước khi cập nhật?',
      `Bản sao: cấp ${next.player.level}, ${next.player.coins} xu. Tiến trình hiện tại được thay bằng bản này (bản hiện tại vẫn giữ làm dự phòng).`,
      'Khôi phục và mở lại',
    );
    if (!ok) return;
    await this.session.replaceStoredSave(next);
    location.reload();
  }

  private async exportSave(): Promise<void> {
    await this.session.saveNow();
    await deliverTextFile(backupFileName(this.session.now()), this.session.exportText());
  }

  private async importSave(): Promise<void> {
    const text = await pickTextFile();
    if (text === null) return;
    let parsed;
    try {
      parsed = this.session.parseBackup(text);
    } catch (e) {
      this.toasts.show(`File không hợp lệ: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return;
    }
    const next = parsed.state;
    const ok = await confirmDialog(
      'Nhập bản sao lưu?',
      `Bản sao lưu: cấp ${next.player.level}, ${next.player.coins} xu. Tiến trình hiện tại được thay bằng bản này (bản hiện tại vẫn giữ làm dự phòng).`,
      'Nhập và mở lại',
    );
    if (!ok) return;
    await this.session.replaceStoredSave(next);
    location.reload();
  }
}

/** In-game confirmation (never a browser alert/confirm dialog). */
export function confirmDialog(title: string, message: string, okLabel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      el.remove();
      resolve(v);
    };
    const el = h(
      'div',
      { class: 'veil' },
      h(
        'div',
        { class: 'win win-confirm', role: 'alertdialog', 'aria-label': title },
        h('div', { class: 'ribbon' }, h('h2', {}, title)),
        h('p', { class: 'note' }, message),
        h(
          'div',
          { class: 'settings-row' },
          h('button', { class: 'candy plain', onclick: () => done(false) }, 'Hủy'),
          h('button', { class: `candy ${danger ? 'danger' : 'primary'}`, 'data-test': 'confirm-ok', onclick: () => done(true) }, okLabel),
        ),
      ),
    );
    (document.getElementById('ui') ?? document.body).append(el);
  });
}
