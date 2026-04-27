/**
 * useUpdater — bridges the renderer to electron-updater via preload.
 *
 * Preload exposes:
 *   window.electronAPI.updater.check()
 *   window.electronAPI.updater.download()
 *   window.electronAPI.updater.install()
 *
 * Update status is pushed from main via the "update-status" channel,
 * subscribed through window.electronAPI.on().
 *
 * Auto-update preference is persisted via window.electronAPI.store.
 */
import { useState, useEffect, useCallback } from "react";

export function useUpdater() {
  const [phase,       setPhase]       = useState("idle");
  const [progress,    setProgress]    = useState(0);
  const [version,     setVersion]     = useState(null);
  const [error,       setError]       = useState(null);
  const [autoUpdate,  setAutoUpdate]  = useState(true);

  // Load persisted auto-update preference once
  useEffect(() => {
    window.electronAPI?.store?.get("autoUpdate").then((val) => {
      if (val !== undefined && val !== null) setAutoUpdate(Boolean(val));
    }).catch(() => {});
  }, []);

  // Listen for update-status events pushed from main process
  useEffect(() => {
    const unsub = window.electronAPI?.on?.("update-status", ({ status, payload }) => {
      switch (status) {
        case "checking":      setPhase("checking");                                            break;
        case "not-available": setPhase("not-available");                                       break;
        case "ready":         setPhase("ready");                                               break;
        case "available":     setPhase("available"); setVersion(payload?.version ?? null);     break;
        case "downloading":   setPhase("downloading"); setProgress(Math.round(payload?.percent ?? 0)); break;
        case "error":         setPhase("error");    setError(payload);                         break;
        default: break;
      }
    });
    return () => unsub?.();
  }, []);

  const check = useCallback(() => {
    setPhase("checking");
    setError(null);
    window.electronAPI?.updater?.check();
  }, []);

  const download = useCallback(() => window.electronAPI?.updater?.download(), []);
  const install  = useCallback(() => window.electronAPI?.updater?.install(),  []);
  const dismiss  = useCallback(() => { setPhase("idle"); setError(null); },   []);

  const toggleAutoUpdate = useCallback(async (enabled) => {
    await window.electronAPI?.store?.set("autoUpdate", enabled);
    setAutoUpdate(enabled);
  }, []);

  return { phase, progress, version, error, autoUpdate,
           check, download, install, dismiss, toggleAutoUpdate };
}
