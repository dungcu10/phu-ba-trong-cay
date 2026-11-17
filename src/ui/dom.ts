// Tiny DOM helpers for the HTML overlay (HUD and panels). The overlay is only touched on
// game events and on a 1-second timer, never from the render loop.

import { atlasData, atlasUrls, extraAtlases, sheetOf, type SheetName } from '../render/assets.ts';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** An icon cut from the world atlas with CSS, so the HTML UI reuses the same image file. */
export function icon(frame: string, sizePt: number, sheetName?: SheetName): HTMLElement {
  const sheet = sheetName ?? sheetOf(frame);
  // Chỉ thị 10 art (bugs, birds, Xu Xu) lives in atlases added at run time.
  const extra = sheet ? undefined : extraAtlases.find((a) => a.data.frames[frame]);
  const data = sheet ? atlasData[sheet] : (extra?.data ?? atlasData.sprites);
  const url = sheet ? atlasUrls[sheet] : (extra?.url ?? atlasUrls.sprites);
  const f = data.frames[frame]?.frame;
  const el = h('span', { class: 'icon', 'aria-hidden': 'true' });
  if (!f) return el;
  const k = sizePt / Math.max(f.w, f.h);
  const meta = data.meta.size!;
  Object.assign(el.style, {
    width: `${sizePt}px`,
    height: `${sizePt}px`,
    backgroundImage: `url("${url}")`,
    backgroundSize: `${meta.w * k}px ${meta.h * k}px`,
    backgroundPosition: `${-f.x * k + (sizePt - f.w * k) / 2}px ${-f.y * k + (sizePt - f.h * k) / 2}px`,
  });
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.firstChild.remove();
}
