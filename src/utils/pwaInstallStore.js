/** Shared store so every Install button uses the same deferred install prompt. */

let deferredPrompt = null;
let listenerReady = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function subscribePwaInstall(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/** Call once at app startup (before React) so we never miss beforeinstallprompt. */
export function initPwaInstallListener() {
  if (typeof window === "undefined" || listenerReady) return;
  listenerReady = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export async function triggerPwaInstall() {
  const event = deferredPrompt;
  if (!event) return { outcome: "unavailable" };
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      notify();
    }
    return { outcome };
  } catch {
    return { outcome: "error" };
  }
}
