// Giao diện Fantasy cao cấp (chỉ thị 06/07): one set of thin line icons for the HUD menus,
// ivory strokes inside night-glass rings. Colour comes from `currentColor`.

const PATHS = {
  missions: '<path d="M7 3h10v18l-5-3.5L7 21z"/><path d="M10 8h4M10 11.5h4"/>',
  orders: '<path d="M12 2a7 7 0 0 0-7 7c0 4 4 7 5 9h4c1-2 5-5 5-9a7 7 0 0 0-7-7z"/><path d="M10 18v3h4v-3M12 2c-2 2-3 4.5-3 7s1 5 3 9c2-4 3-6.5 3-9s-1-5-3-7z"/>',
  stall: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M5 12v8h14v-8"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  journal: '<path d="M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0z"/><path d="M20 5c-3-1.5-5.5-1.5-8 0v15c2.5-1.5 5-1.5 8 0z"/>',
  seeds: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 4-3 7-8 7z"/><path d="M12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5M3 13h18M11 12h2v3h-2z"/>',
  kiln: '<path d="M8 4h8M9 4c0 2-3 3-3 7a6 6 0 0 0 12 0c0-4-3-5-3-7"/><path d="M7.5 13h9"/>',
  letter: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  gear: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  moon: '<path d="M15 3a8 8 0 1 0 6 13A9 9 0 0 1 15 3z"/>',
} as const;

export type LineIconName = keyof typeof PATHS;

export function lineIcon(name: LineIconName, size = 26): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('line-icon');
  svg.innerHTML = PATHS[name];
  return svg;
}
