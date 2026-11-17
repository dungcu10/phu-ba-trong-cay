// Design tokens (docs/DESIGN_SYSTEM.md). Colours, sizes and durations come from
// content/ui/design-tokens.json only; CSS reads them as custom properties set here.

import tokens from '../../content/ui/design-tokens.json';

export const TOKENS = tokens;

/** "#F2B830" → 0xF2B830 for PixiJS. */
export function hex(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

function flatten(prefix: string, value: unknown, out: Record<string, string>): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(`${prefix}-${i}`, v, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(`${prefix}-${k}`, v, out);
  } else {
    out[prefix] = String(value);
  }
}

/** Exposes every token as a CSS custom property, e.g. --color-ui-paper, --motion-tap-ms. */
export function applyTokensToCss(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {};
  flatten('-', { color: tokens.color, font: tokens.font, radius: tokens.radius, touch: tokens.touch, frame: tokens.frame, motion: tokens.motion, space: tokens.space, layout: tokens.layout }, vars);
  for (const [name, value] of Object.entries(vars)) {
    const isNumber = /^-?\d+(\.\d+)?$/.test(value);
    const unit = !isNumber ? '' : /-ms$|Ms$/.test(name) ? 'ms' : /lineHeight|weight|ShareOfScreen|Share/.test(name) ? '' : 'px';
    root.style.setProperty(name, `${value}${unit}`);
  }
}
