/**
 * Sounds for distributor in-app notifications (Web Audio API).
 */
import { playOrderApprovedChime } from "./orderApprovedSound";
import {
  playOrderSubmittedNotifyChime,
  playSalesDataRefreshChime,
  playTargetAchievedBell,
} from "./newOrderAlertSound";

let audioUnlocked = false;

/** Call after first user gesture so later alerts can play without autoplay block. */
export function unlockNotificationAudio() {
  if (audioUnlocked || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctx.resume?.().then(() => {
      audioUnlocked = true;
    }).catch(() => {});
    if (ctx.state === "running") audioUnlocked = true;
  } catch {
    /* ignore */
  }
}

function playTone(ctx, freq, start, dur, vol, type = "sine") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Distinct “delivered” chime (three rising notes). */
export function playOrderDeliveredChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    playTone(ctx, 587, now, 0.14, 0.1);
    playTone(ctx, 880, now + 0.16, 0.16, 0.11);
    playTone(ctx, 1174, now + 0.34, 0.22, 0.1);
    ctx.resume?.().catch(() => {});
  } catch (e) {
    console.warn("playOrderDeliveredChime:", e);
  }
}

function playGenericErrorTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    playTone(ctx, 220, now, 0.2, 0.1, "triangle");
    playTone(ctx, 185, now + 0.22, 0.18, 0.08, "triangle");
    ctx.resume?.().catch(() => {});
  } catch (e) {
    console.warn("playGenericErrorTone:", e);
  }
}

function playGenericInfoTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    playTone(ctx, 523, now, 0.12, 0.07);
    ctx.resume?.().catch(() => {});
  } catch (e) {
    console.warn("playGenericInfoTone:", e);
  }
}

/**
 * @param {"success"|"error"|"info"|"warning"} type
 * @param {"approved"|"delivered"|"target"|"submitted"|"refresh"|null} [variant]
 */
export function playDistributorNotificationSound(type = "info", variant = null) {
  unlockNotificationAudio();
  try {
    if (variant === "approved") {
      playOrderApprovedChime();
      return;
    }
    if (variant === "delivered") {
      playOrderDeliveredChime();
      return;
    }
    if (variant === "target") {
      playTargetAchievedBell();
      return;
    }
    if (variant === "submitted") {
      playOrderSubmittedNotifyChime();
      return;
    }
    if (variant === "refresh") {
      playSalesDataRefreshChime();
      return;
    }
    if (type === "success") {
      playOrderApprovedChime();
      return;
    }
    if (type === "error") {
      playGenericErrorTone();
      return;
    }
    playGenericInfoTone();
  } catch (e) {
    console.warn("playDistributorNotificationSound:", e);
  }
}
