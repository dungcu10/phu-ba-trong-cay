// Hand-authored vector icons for the HUD and windows (UI chrome, not game art). Fairy-tale style:
// thick warm-wood outline, two-tone gradient fill, a soft white highlight, tiny drop shadow.
// Colours come from the design tokens. Each call returns a fresh <svg> with unique gradient ids.

import { TOKENS } from './tokens.ts';
import type { ContentPack } from '../core/content.ts';
import { itemFrame } from '../render/assets.ts';
import { icon } from './dom.ts';

const C = TOKENS.color;
const OUT = C.ui.wood;
let uid = 0;

type Grad = [string, string];
const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};
const g = (base: string): Grad => [shade(base, 0.35), shade(base, -0.18)];

/** Builds an SVG: `draw(fill)` returns the shapes; fill(name) gives the url of a named gradient. */
function svg(size: number, grads: Record<string, Grad>, draw: (f: (name: string) => string) => string): SVGSVGElement {
  const id = `i${++uid}`;
  const defs = Object.entries(grads)
    .map(([k, [a, b]]) => `<linearGradient id="${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`)
    .join('');
  const html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" class="svg-icon"><defs>${defs}<filter id="${id}sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="1.2" flood-color="${OUT}" flood-opacity="0.35"/></filter></defs><g filter="url(#${id}sh)" stroke="${OUT}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${draw((n) => `url(#${id}${n})`)}</g></svg>`;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content.firstElementChild as SVGSVGElement;
}

const shine = (x: number, y: number, rx: number, ry: number, rot = -20) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="0.55" stroke="none"/>`;

export const ICONS = {
  missions: (s: number) =>
    svg(s, { p: g(C.ui.paperDeep), r: g(C.brand.peach), w: g(C.ui.woodLight), seal: g(C.ui.danger) }, (f) =>
      `<rect x="14" y="10" width="36" height="44" rx="4" fill="${f('p')}"/>
       <rect x="9" y="6" width="46" height="9" rx="4.5" fill="${f('w')}"/>
       <rect x="9" y="49" width="46" height="9" rx="4.5" fill="${f('w')}"/>
       <path d="M21 23h22M21 30h22M21 37h14" stroke="${C.ui.woodLight}" stroke-width="3"/>
       <circle cx="42" cy="42" r="7" fill="${f('seal')}"/><path d="M39 42l2.5 2.5L46 39" stroke="#fff" stroke-width="2.5" fill="none"/>
       ${shine(18, 9, 6, 1.6, 0)}`),
  orders: (s: number) =>
    svg(s, { a: g(C.brand.peach), b: g(C.brand.cream), k: g(C.ui.woodLight) }, (f) =>
      `<path d="M32 4C17 4 10 15 10 25c0 10 9 18 15 23h14c6-5 15-13 15-23C54 15 47 4 32 4z" fill="${f('a')}"/>
       <path d="M32 4c-6 0-9 10-9 21s4 18 6 23h6c2-5 6-12 6-23S38 4 32 4z" fill="${f('b')}" stroke-width="2.5"/>
       <path d="M25 48l2 6M39 48l-2 6" stroke-width="2.5"/>
       <rect x="24" y="53" width="16" height="9" rx="2.5" fill="${f('k')}"/>
       ${shine(20, 15, 5, 3)}`),
  stall: (s: number) =>
    svg(s, { a: g(C.brand.peach), w: g(C.ui.woodLight), c: g(C.ui.paper), fr: g(C.brand.leaf), red: g(C.ui.danger) }, (f) =>
      `<rect x="12" y="28" width="40" height="28" rx="3" fill="${f('w')}"/>
       <rect x="16" y="34" width="32" height="10" rx="2" fill="${f('c')}" stroke-width="2.5"/>
       <circle cx="23" cy="34" r="5" fill="${f('red')}" stroke-width="2.5"/><circle cx="33" cy="33" r="5" fill="${f('fr')}" stroke-width="2.5"/><circle cx="42" cy="34" r="5" fill="${f('red')}" stroke-width="2.5"/>
       <path d="M6 26 12 10h40l6 16z" fill="${f('c')}"/>
       <path d="M17 10l-3 16M27 10l-1 16M37 10l1 16M47 10l3 16" stroke="${C.brand.peach}" stroke-width="5" stroke-linecap="butt"/>
       <path d="M6 26 12 10h40l6 16z" fill="none"/>
       <path d="M6 26c3 5 9 5 11 0 2 5 9 5 11 0 2 5 9 5 11 0 2 5 9 5 11 0 2 5 6 5 8 0" fill="${f('a')}" stroke-width="2.5"/>`),
  crown: (s: number) =>
    svg(s, { gold: g(C.brand.gold), gem: g(C.brand.jade), red: g(C.ui.danger) }, (f) =>
      `<path d="M8 46 6 18l14 12 12-20 12 20 14-12-2 28z" fill="${f('gold')}"/>
       <rect x="8" y="44" width="48" height="10" rx="3" fill="${f('gold')}"/>
       <circle cx="32" cy="32" r="5" fill="${f('red')}" stroke-width="2.5"/><circle cx="18" cy="49" r="3" fill="${f('gem')}" stroke-width="2"/><circle cx="46" cy="49" r="3" fill="${f('gem')}" stroke-width="2"/>
       <circle cx="6" cy="16" r="3.5" fill="${f('gold')}" stroke-width="2.5"/><circle cx="32" cy="8" r="3.5" fill="${f('gold')}" stroke-width="2.5"/><circle cx="58" cy="16" r="3.5" fill="${f('gold')}" stroke-width="2.5"/>
       ${shine(17, 28, 4, 2)}`),
  journal: (s: number) =>
    svg(s, { cov: g(C.brand.jade), pg: g(C.ui.paper), gold: g(C.brand.gold), leaf: g(C.brand.leaf) }, (f) =>
      `<rect x="14" y="8" width="40" height="50" rx="5" fill="${f('pg')}"/>
       <rect x="10" y="6" width="40" height="50" rx="5" fill="${f('cov')}"/>
       <rect x="10" y="6" width="8" height="50" rx="3" fill="${shade(C.brand.jade, -0.35)}" stroke-width="2.5"/>
       <path d="M34 20c-8 2-11 10-9 18 8-2 12-9 9-18z" fill="${f('leaf')}" stroke-width="2.5"/><path d="M26 37l7-12" stroke-width="2"/>
       <circle cx="34" cy="46" r="3" fill="${f('gold')}" stroke-width="2"/>
       ${shine(26, 11, 7, 1.8, 0)}`),
  letter: (s: number) =>
    svg(s, { p: g(C.ui.paper), seal: g(C.ui.danger) }, (f) =>
      `<rect x="6" y="14" width="52" height="38" rx="5" fill="${f('p')}"/>
       <path d="M8 17l24 19 24-19" fill="none"/>
       <path d="M32 33c-3-4-9-2-8 2 1 4 8 8 8 8s7-4 8-8c1-4-5-6-8-2z" fill="${f('seal')}" stroke-width="2.5"/>
       ${shine(16, 19, 6, 1.6, 0)}`),
  gear: (s: number) =>
    svg(s, { m: g(C.ui.woodLight), c: g(C.ui.paperDeep) }, (f) => {
      const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="27" y="4" width="10" height="12" rx="3" fill="${f('m')}" transform="rotate(${i * 45} 32 32)"/>`).join('');
      return `${teeth}<circle cx="32" cy="32" r="18" fill="${f('m')}"/><circle cx="32" cy="32" r="7" fill="${f('c')}"/>${shine(25, 22, 5, 2.5)}`;
    }),
  seeds: (s: number) =>
    svg(s, { bag: g('#D9B07A'), tie: g(C.ui.danger), leaf: g(C.brand.leaf) }, (f) =>
      `<path d="M18 22c-8 8-10 22-6 30 3 6 37 6 40 0 4-8 2-22-6-30z" fill="${f('bag')}"/>
       <path d="M20 22c4-4 20-4 24 0" fill="none"/>
       <rect x="19" y="18" width="26" height="7" rx="3.5" fill="${f('tie')}"/>
       <path d="M32 18c0-6 2-10 6-12M32 14c-5-1-9-4-10-9 6 0 9 3 10 9zM38 6c5-1 9 1 11 5-5 2-9 1-11-5z" fill="${f('leaf')}" stroke-width="2.5"/>
       <circle cx="27" cy="40" r="2.5" fill="${OUT}" stroke="none"/><circle cx="36" cy="44" r="2.5" fill="${OUT}" stroke="none"/><circle cx="33" cy="35" r="2.5" fill="${OUT}" stroke="none"/>
       ${shine(19, 34, 3, 6, 10)}`),
  chest: (s: number) =>
    svg(s, { w: g(C.ui.woodLight), gold: g(C.brand.gold), lid: g(shade(C.ui.woodLight, 0.1)) }, (f) =>
      `<rect x="8" y="30" width="48" height="26" rx="4" fill="${f('w')}"/>
       <path d="M8 30c0-14 10-20 24-20s24 6 24 20z" fill="${f('lid')}"/>
       <path d="M8 30h48" />
       <rect x="14" y="10" width="7" height="46" rx="2" fill="${f('gold')}" stroke-width="2.5"/><rect x="43" y="10" width="7" height="46" rx="2" fill="${f('gold')}" stroke-width="2.5"/>
       <rect x="26" y="26" width="12" height="14" rx="3" fill="${f('gold')}" stroke-width="2.5"/><circle cx="32" cy="33" r="2" fill="${OUT}" stroke="none"/>
       ${shine(30, 16, 8, 2.5, 0)}`),
  kiln: (s: number) =>
    svg(s, { pot: g('#D9774A'), rim: g(C.brand.jade), gold: g(C.brand.gold) }, (f) =>
      `<path d="M14 24c-4 10-2 24 8 30h20c10-6 12-20 8-30z" fill="${f('pot')}"/>
       <rect x="10" y="17" width="44" height="10" rx="5" fill="${f('rim')}"/>
       <path d="M20 38c4 4 20 4 24 0" fill="none" stroke="${C.brand.gold}" stroke-width="3"/>
       <circle cx="32" cy="44" r="4" fill="${f('gold')}" stroke-width="2.5"/>
       <path d="M24 13c2-4 0-6 2-9M32 13c2-4 0-6 2-9M40 13c2-4 0-6 2-9" stroke="${C.ui.woodLight}" stroke-width="2.5" fill="none" opacity="0.7"/>
       ${shine(19, 33, 3, 7, 10)}`),
  coin: (s: number) =>
    svg(s, { gold: g(C.brand.gold), in: g(shade(C.brand.gold, 0.2)) }, (f) =>
      `<circle cx="32" cy="32" r="26" fill="${f('gold')}" stroke="${C.ui.number}"/>
       <circle cx="32" cy="32" r="19" fill="${f('in')}" stroke="${C.ui.number}" stroke-width="2"/>
       <path d="M32 42V26M32 30c-4-5-10-4-11 0 5 3 9 3 11 0zM32 28c3-6 9-6 11-2-4 4-8 4-11 2z" stroke="${C.ui.number}" stroke-width="2.5" fill="${C.brand.leaf}"/>
       ${shine(22, 18, 7, 3)}`),
  gem: (s: number) =>
    svg(s, { j: g(C.brand.jade), d: g(shade(C.brand.jade, -0.2)) }, (f) =>
      `<path d="M16 10h32l10 14-26 32L6 24z" fill="${f('j')}" stroke="${shade(C.brand.jade, -0.55)}"/>
       <path d="M6 24h52M16 10l8 14 8-14 8 14 8-14M24 24l8 32 8-32" fill="none" stroke="${shade(C.brand.jade, -0.55)}" stroke-width="2"/>
       <path d="M24 24h16l-8 32z" fill="${f('d')}" stroke="none" opacity="0.6"/>
       ${shine(20, 16, 5, 2.4)}`),
  moon: (s: number) =>
    svg(s, { m: g(C.brand.gold), l: g(C.brand.jade), c: g(C.ui.paper) }, (f) =>
      `<path d="M38 6a26 26 0 1 0 20 38A22 22 0 1 1 38 6z" fill="${f('m')}"/>
       <path d="M14 52c4-6 10-8 16-6-2 6-10 9-16 6zM30 46c2-6 8-9 14-8-2 6-8 9-14 8z" fill="${f('l')}" stroke-width="2.5"/>
       <circle cx="50" cy="14" r="3" fill="${f('c')}" stroke-width="2"/><circle cx="56" cy="26" r="2" fill="${f('c')}" stroke-width="1.5"/>
       ${shine(24, 20, 4, 8, 20)}`),
  clay: (s: number) =>
    svg(s, { c: g('#C98A5E'), d: g('#A8693F') }, (f) =>
      `<path d="M10 44c0-12 10-22 22-22s22 10 22 22c0 6-10 10-22 10S10 50 10 44z" fill="${f('c')}"/>
       <path d="M18 40c4-6 10-9 14-9M30 46c6 0 12-2 15-6" fill="none" stroke="${shade('#C98A5E', -0.35)}" stroke-width="2.5"/>
       <path d="M40 18c4-4 10-4 12 0-3 2-8 3-12 0zM12 22c3-3 8-3 10 0-3 2-7 2-10 0z" fill="#fff" stroke-width="2" opacity="0.9"/>
       ${shine(24, 30, 6, 2.5)}`),
  'shard-red': (s: number) =>
    svg(s, { a: g('#E0704C'), b: g('#C2532F') }, (f) =>
      `<path d="M14 40 26 10l12 8-6 30z" fill="${f('a')}"/><path d="M34 52l6-24 14 6-4 22z" fill="${f('b')}"/>
       <path d="M20 30c3-2 6-2 9 0" fill="none" stroke="${C.brand.gold}" stroke-width="2.5"/>${shine(24, 18, 3, 6, 20)}`),
  'shard-bronze': (s: number) =>
    svg(s, { a: g('#C8933F'), b: g('#8E6A2C') }, (f) =>
      `<path d="M12 42 24 12l14 6-6 32z" fill="${f('a')}"/><path d="M34 52l8-26 12 8-6 20z" fill="${f('b')}"/>
       <path d="M18 32c4-3 8-3 12 0" fill="none" stroke="${C.brand.jade}" stroke-width="2.5"/>${shine(22, 20, 3, 6, 20)}`),
  seal: (s: number) =>
    svg(s, { b: g('#C8933F'), r: g(C.ui.danger), gold: g(C.brand.gold) }, (f) =>
      `<rect x="22" y="6" width="20" height="22" rx="6" fill="${f('b')}"/>
       <rect x="12" y="26" width="40" height="28" rx="6" fill="${f('gold')}"/>
       <rect x="18" y="32" width="28" height="16" rx="3" fill="${f('r')}" stroke-width="2.5"/>
       <path d="M24 40h16M32 35v10" stroke="#fff" stroke-width="2.5"/>${shine(28, 10, 4, 2, 0)}`),
  'moon-seed': (s: number) =>
    svg(s, { s: g('#F4EEDC'), m: g(C.brand.gold), l: g(C.brand.jade) }, (f) =>
      `<path d="M32 8c10 0 18 10 18 24S42 56 32 56 14 46 14 32 22 8 32 8z" fill="${f('s')}"/>
       <path d="M36 18a12 12 0 1 0 6 22 10 10 0 1 1-6-22z" fill="${f('m')}" stroke-width="2.5"/>
       <path d="M32 8c-2-4 2-6 6-4-1 3-3 4-6 4z" fill="${f('l')}" stroke-width="2"/>${shine(24, 20, 4, 7, 15)}`),
};

export type IconName = keyof typeof ICONS;

export function svgIcon(name: IconName, size: number): SVGSVGElement {
  return ICONS[name](size);
}

/** Icon of any item: vector art for materials ("svg:<name>"), atlas art for produce and bugs. */
export function itemIcon(content: ContentPack, itemId: string, size: number): Element {
  const mat = content.materials.get(itemId);
  if (mat?.icon.startsWith('svg:') && mat.icon.slice(4) in ICONS) return svgIcon(mat.icon.slice(4) as IconName, size);
  return icon(itemFrame(content, itemId), size);
}
