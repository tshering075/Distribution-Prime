/**
 * Short chime when an order becomes approved (admin attention).
 * Uses Web Audio API — no audio file required. Fails silently if blocked.
 */
export function playOrderApprovedChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    const playTone = (freq, start, dur, gainVal) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gainVal, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    playTone(784, now, 0.12, 0.11);
    playTone(988, now + 0.1, 0.14, 0.1);
    playTone(1318, now + 0.22, 0.2, 0.09);

    ctx.resume?.().catch(() => {});
  } catch (e) {
    console.warn("playOrderApprovedChime:", e);
  }
}
