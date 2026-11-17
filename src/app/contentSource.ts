// The content pack is bundled into the app (and so cached by the Service Worker for offline play).

import { loadContentPack, type ContentPack } from '../core/content.ts';

const files = import.meta.glob('../../content/base/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export function loadBundledContent(): Promise<ContentPack> {
  return loadContentPack(async (relativePath) => {
    const value = files[`../../content/base/${relativePath}`];
    if (value === undefined) throw new Error(`Thiếu file nội dung ${relativePath}`);
    return structuredClone(value);
  });
}
