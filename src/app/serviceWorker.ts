// Registers the Service Worker (offline play) and offers to switch to a new version.

export function registerServiceWorker(onUpdateReady: (apply: () => void) => void): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offer = (worker: ServiceWorker) =>
        onUpdateReady(() => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
    })
    .catch(() => {
      // Without a Service Worker the game still runs online; offline play is then unavailable.
    });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
