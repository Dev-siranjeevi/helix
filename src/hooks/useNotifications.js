/**
 * useNotifications — wires up the "files-added-batch" IPC event,
 * plays a subtle notification sound, and manages the set of unviewed tab IDs.
 *
 * Sound: generated programmatically via Web Audio API (no audio file needed).
 * Two short ascending tones — gentle, not jarring.
 */
import { useState, useEffect, useCallback, useRef } from "react";

// ── Web Audio notification sound ──────────────────────────────────────────────
const playNotificationSound = (() => {
  let ctx = null;
  return () => {
    try {
      ctx = ctx ?? new (window.AudioContext ?? window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, now);

      // Two-tone chime: 880 Hz then 1108 Hz (A5 → C#6), 80 ms each
      [[880, 0], [1108, 0.1]].forEach(([freq, offset]) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);

        const t0 = now + offset;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.18, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);

        osc.start(t0);
        osc.stop(t0 + 0.13);
      });
    } catch (e) {
      // AudioContext blocked — silently ignore
    }
  };
})();

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useNotifications() {
  // Set of tab IDs that were auto-opened but not yet clicked by the user
  const [unviewedTabs, setUnviewedTabs] = useState(new Set());
  const unviewedRef = useRef(new Set());

  // Keep ref in sync for use in callbacks without stale closure
  const setUnviewed = useCallback((updater) => {
    setUnviewedTabs((prev) => {
      const next = updater(prev);
      unviewedRef.current = next;
      return next;
    });
  }, []);

  // ── Register IPC listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI?.on?.("files-added-batch", (_payload) => {
      playNotificationSound();
      // The actual tab IDs are added via markTabUnviewed called from App.jsx
      // when autoOpenFile runs — this just triggers the sound.
    });
    return () => { unsub?.(); };
  }, []);

  // ── Mark a tab as unviewed (called when auto-opened) ─────────────────────
  const markTabUnviewed = useCallback((tabId) => {
    setUnviewed((prev) => new Set([...prev, tabId]));
  }, [setUnviewed]);

  // ── Mark a tab as viewed (called when user clicks the tab) ───────────────
  const markTabViewed = useCallback((tabId) => {
    setUnviewed((prev) => {
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    window.electronAPI?.markTabViewed?.(tabId);
  }, [setUnviewed]);

  // ── Mark all tabs viewed (e.g. user closes all or focuses app) ───────────
  const markAllViewed = useCallback(() => {
    setUnviewed(() => new Set());
    window.electronAPI?.markAllViewed?.();
  }, [setUnviewed]);

  return { unviewedTabs, markTabUnviewed, markTabViewed, markAllViewed };
}
