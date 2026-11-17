// Chỉ thị 07: a portrait for each Phú Bà, assembled from parts (skin, hair, outfit, accessory)
// picked by a hash of the id, so 40 neighbours never share a face and no image files are needed.

const SKIN = ['#F6D7B8', '#EEC39C', '#E2AE83', '#F9E1C8', '#D99F75'];
const HAIR = ['#2B1A12', '#4A2C1C', '#6B3F25', '#1C1C24', '#8A5A3B', '#C9A06A'];
const OUTFIT = ['#B8325A', '#7A3E8C', '#2F6FA8', '#1E7A6E', '#C46A1C', '#9C2B2B', '#3B4A8C', '#5E7A2A'];
const ACCENT = ['#F3D27E', '#FFFFFF', '#F7A8C4', '#8CCDFF', '#C3A6F2'];
const NS = 'http://www.w3.org/2000/svg';

function hash(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;

/** SVG markup of the portrait (exported for tests). */
export function avatarSvg(id: string): string {
  const k = hash(id);
  const skin = pick(SKIN, k);
  const hair = pick(HAIR, k >>> 3);
  const outfit = pick(OUTFIT, k >>> 6);
  const acc = pick(ACCENT, k >>> 9);
  const style = (k >>> 12) % 4; // hair style
  const extra = (k >>> 15) % 4; // accessory
  const hairBack = [
    '<path d="M9 22c0-11 5-16 11-16s11 5 11 16v8H9z"/>',
    '<path d="M8 18c0-9 5-13 12-13s12 4 12 13c0 6-2 12-3 14H11c-1-2-3-8-3-14z"/>',
    '<circle cx="20" cy="9" r="5"/><path d="M10 20c0-8 4-12 10-12s10 4 10 12v4H10z"/>',
    '<path d="M10 20c0-8 4-13 10-13s10 5 10 13l2 10H8z"/>',
  ][style];
  const hairFront = [
    '<path d="M11 17c2-5 6-7 9-7s7 2 9 7c-3-2-6-3-9-3s-6 1-9 3z"/>',
    '<path d="M11 16c3-4 6-6 9-6 4 0 7 3 9 7-4-1-7-3-9-5-2 2-5 3-9 4z"/>',
    '<path d="M12 16c2-4 5-6 8-6s6 2 8 6c-2-1-5-2-8-2s-6 1-8 2z"/>',
    '<path d="M11 17c1-5 5-8 9-8s8 3 9 8l-4-3-5 2-5-2z"/>',
  ][style];
  const accessory = [
    `<path d="M14 7l2-4 4 3 4-3 2 4" fill="none" stroke="${acc}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<circle cx="27" cy="11" r="3" fill="${acc}"/><circle cx="27" cy="11" r="1.2" fill="#FFFFFF" opacity=".7"/>`,
    `<circle cx="11.5" cy="22" r="1.4" fill="${acc}"/><circle cx="28.5" cy="22" r="1.4" fill="${acc}"/>`,
    `<path d="M14 33c2 2 4 3 6 3s4-1 6-3" fill="none" stroke="${acc}" stroke-width="1.6"/>`,
  ][extra];
  return (
    `<svg xmlns="${NS}" viewBox="0 0 40 40" aria-hidden="true">` +
    `<circle cx="20" cy="20" r="20" fill="#2B3150"/>` +
    `<g fill="${hair}">${hairBack}</g>` +
    `<path d="M6 40c1-8 6-12 14-12s13 4 14 12z" fill="${outfit}"/>` +
    `<path d="M17 28h6v3a3 3 0 0 1-6 0z" fill="${skin}"/>` +
    `<ellipse cx="20" cy="19" rx="8" ry="9" fill="${skin}"/>` +
    `<g fill="${hair}">${hairFront}</g>` +
    `<circle cx="17" cy="20" r="1" fill="#2B1A12"/><circle cx="23" cy="20" r="1" fill="#2B1A12"/>` +
    `<path d="M18 24c1 .8 3 .8 4 0" fill="none" stroke="#B5524F" stroke-width="1" stroke-linecap="round"/>` +
    accessory +
    `</svg>`
  );
}

/** A round portrait element for the Phú Bà board and the market. */
export function botAvatar(id: string, size: number): HTMLElement {
  const el = document.createElement('span');
  el.className = 'avatar';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = avatarSvg(id);
  return el;
}
