import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getDeferredInstallPrompt,
  subscribePwaInstall,
  triggerPwaInstall,
} from "../utils/pwaInstallStore";

const DISMISS_KEY = "coke_pwa_install_banner_dismissed";

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

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Chrome / Edge / Samsung Internet install prompt + iOS “Add to Home Screen” detection.
 */
export function usePwaInstall() {
  useSyncExternalStore(subscribePwaInstall, getDeferredInstallPrompt, () => null);

  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplayMode);
  const [isIos, setIsIos] = useState(isIosDevice);
  const [inAppBrowser, setInAppBrowser] = useState(isInAppBrowser);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode());
    setIsIos(isIosDevice());
    setInAppBrowser(isInAppBrowser());

    const onInstalled = () => setIsStandalone(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const canNativeInstall = Boolean(getDeferredInstallPrompt());
  const showIosGuide = isIos && !isStandalone;
  const showAndroidGuide = isAndroidDevice() && !isStandalone && !canNativeInstall;
  const showBanner =
    !isStandalone && !dismissed && (canNativeInstall || showIosGuide || showAndroidGuide);

  const promptInstall = useCallback(() => triggerPwaInstall(), []);

  const dismissBanner = useCallback(() => {
    dismissPwaInstallBanner();
    setDismissed(true);
  }, []);

  /** How the UI should handle an Install click when native prompt is unavailable. */
  const getInstallGuideMode = useCallback(() => {
    if (isStandalone) return null;
    if (inAppBrowser) return "in-app";
    if (canNativeInstall) return "native";
    if (showIosGuide) return "ios";
    if (showAndroidGuide) return "android";
    return "desktop";
  }, [canNativeInstall, inAppBrowser, isStandalone, showAndroidGuide, showIosGuide]);

  return {
    canNativeInstall,
    isStandalone,
    isIos,
    inAppBrowser,
    showIosGuide,
    showAndroidGuide,
    showBanner,
    promptInstall,
    dismissBanner,
    getInstallGuideMode,
  };
}
