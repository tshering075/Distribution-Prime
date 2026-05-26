/**
 * Shipping dashboard: sounds + browser notifications (parity with admin/distributor).
 */
import { playNewOrderIncomingAlert } from "./newOrderAlertSound";
import { playOrderApprovedChime } from "./orderApprovedSound";
import {
  playDistributorNotificationSound,
  playOrderDeliveredChime,
  unlockNotificationAudio,
} from "./distributorNotificationSound";
import { getTargetReminderNotificationIconUrl } from "./targetReminder";

let audioUnlocked = false;

export function unlockShippingNotificationAudio() {
  if (audioUnlocked) return;
  unlockNotificationAudio();
  audioUnlocked = true;
}

/**
 * @param {"success"|"error"|"info"|"warning"} type
 * @param {"incoming"|"approved"|"delivered"|"upload"|null} [variant]
 */
export function playShippingNotificationSound(type = "info", variant = null) {
  unlockShippingNotificationAudio();
  try {
    if (variant === "incoming") {
      playNewOrderIncomingAlert();
      return;
    }
    if (variant === "approved") {
      playOrderApprovedChime();
      return;
    }
    if (variant === "delivered") {
      playOrderDeliveredChime();
      return;
    }
    if (variant === "upload" || type === "success") {
      playOrderApprovedChime();
      return;
    }
    if (type === "error") {
      playDistributorNotificationSound("error");
      return;
    }
    if (type === "warning" || type === "info") {
      playDistributorNotificationSound("info");
    }
  } catch (e) {
    console.warn("playShippingNotificationSound:", e);
  }
}

/**
 * @param {string} title
 * @param {string} body
 * @param {string} [tag]
 */
export async function postShippingBrowserNotification(title, body, tag = "coke-shipping") {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    const iconUrl = getTargetReminderNotificationIconUrl();
    const show = () => new Notification(title, { body, icon: iconUrl, tag });
    if (Notification.permission === "granted") {
      show();
    } else if (Notification.permission === "default") {
      const p = await Notification.requestPermission();
      if (p === "granted") show();
    }
  } catch (e) {
    console.warn("postShippingBrowserNotification:", e);
  }
}
