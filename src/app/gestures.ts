// Blocks browser gestures that fight a game on iPad: page pinch-zoom, double-tap zoom,
// rubber-band scrolling, long-press text selection and callouts (QUALITY_STANDARDS 2).
// Elements with class "scroll" (panel lists) keep their own vertical scrolling.

export function installGestureGuards(doc: Document = document): void {
  const prevent = (e: Event) => e.preventDefault();
  doc.addEventListener('gesturestart', prevent, { passive: false });
  doc.addEventListener('gesturechange', prevent, { passive: false });
  doc.addEventListener('dblclick', prevent, { passive: false });
  doc.addEventListener('contextmenu', prevent);
  doc.addEventListener('selectstart', (e) => {
    const t = e.target as Element | null;
    if (!t?.closest?.('input, textarea')) e.preventDefault();
  });
  doc.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      const t = e.target as Element | null;
      if (!t?.closest?.('.scroll')) e.preventDefault();
    },
    { passive: false },
  );
}
