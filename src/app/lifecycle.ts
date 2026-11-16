// Saving around the app lifecycle. iOS can kill a background tab at any time and does not
// reliably fire beforeunload, so we save on visibilitychange (hidden) and pagehide.

import type { GameSession } from './session.ts';

export function installLifecycle(session: GameSession, onResume: () => void): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void session.saveNow();
    else onResume();
  });
  window.addEventListener('pagehide', () => void session.saveNow());
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) onResume();
  });
  setInterval(() => void session.saveNow(), session.periodicSaveMs);
}

/** Asks the browser not to evict our data under storage pressure. Result is informational. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
