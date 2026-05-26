import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_KEY = "coke_pwa_install_banner_dismissed";
const SKIP_GATE_KEY = "coke_pwa_skip_install_gate";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPwaInstallBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** User chose “Continue in browser” on the install screen. */
export function skipInstallGate() {
  try {
    localStorage.setItem(SKIP_GATE_KEY, "1");
    dismissPwaInstallBanner();
  } catch {
    /* ignore */
  }
}

export function shouldShowInstallGate() {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplayMode()) return false;
  try {
    if (localStorage.getItem(SKIP_GATE_KEY) === "1") return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

/** WhatsApp, Facebook, Instagram in-app browsers cannot install PWAs reliably. */
export function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|MicroMessenger/i.test(ua);
}

/**
 * Chrome / Edge / Samsung Internet install prompt + iOS “Add to Home Screen” detection.
 */
export function usePwaInstall() {
  const deferredRef = useRef(null);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplayMode);
  const [isIos, setIsIos] = useState(isIosDevice);
  const [inAppBrowser, setInAppBrowser] = useState(isInAppBrowser);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [promptTimedOut, setPromptTimedOut] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode());
    setIsIos(isIosDevice());
    setInAppBrowser(isInAppBrowser());

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredRef.current = event;
      setCanNativeInstall(true);
      setPromptTimedOut(false);
    };

    const onInstalled = () => {
      deferredRef.current = null;
      setCanNativeInstall(false);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      if (!deferredRef.current) setPromptTimedOut(true);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredRef.current;
    if (!event) return { outcome: "unavailable" };
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") {
        deferredRef.current = null;
        setCanNativeInstall(false);
      }
      return { outcome };
    } catch {
      return { outcome: "error" };
    }
  }, []);

  const dismissBanner = useCallback(() => {
    dismissPwaInstallBanner();
    setDismissed(true);
  }, []);

  const showIosGuide = isIos && !isStandalone;
  const showBanner =
    !isStandalone && !dismissed && (canNativeInstall || showIosGuide);

  return {
    canNativeInstall,
    isStandalone,
    isIos,
    inAppBrowser,
    showIosGuide,
    showBanner,
    promptTimedOut,
    promptInstall,
    dismissBanner,
  };
}
