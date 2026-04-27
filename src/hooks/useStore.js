/**
 * useStore — persisted settings via Electron IPC only.
 *
 * No WS dependency here. Persistence is always local to the
 * Electron process. Browser mode falls back to localStorage.
 *
 * The single load happens once on mount after electronAPI is confirmed.
 * ready flips true only after that load completes.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const hasElectron = () => Boolean(window.electronAPI?.store);

const lsGet = (key) => {
  try {
    return JSON.parse(localStorage.getItem("helix:" + key));
  } catch {
    return null;
  }
};
const lsSet = (key, val) => {
  try {
    localStorage.setItem("helix:" + key, JSON.stringify(val));
  } catch {}
};

const DEFAULTS = {
  lastFolder: null,
  theme: "dark",
  sectionCollapsed: { header: false, procedure: false, waypoints: false },
  kpiHistory: [],
  lastFilePath: null,
  lastCIFPFilePath: null,
  maxTabs: 5,
  autoOpenExternal: false,
};

export const useStore = () => {
  const [ready, setReady] = useState(false);
  const [storeData, setStoreData] = useState(DEFAULTS);
  const loadedRef = useRef(false);

  // ── Single load on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      if (hasElectron()) {
        const all = await window.electronAPI.store.getAll();
        setStoreData((prev) => ({ ...prev, ...all }));
      } else {
        const data = {};
        for (const key of Object.keys(DEFAULTS)) {
          const v = lsGet(key);
          if (v !== null) data[key] = v;
        }
        setStoreData((prev) => ({ ...prev, ...data }));
      }
      setReady(true);
    };

    load();
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(async (key, val) => {
    setStoreData((prev) => ({ ...prev, [key]: val }));
    if (hasElectron()) {
      await window.electronAPI.store.set(key, val);
    } else {
      lsSet(key, val);
    }
  }, []);

  // ── Typed setters ────────────────────────────────────────────────────────
  const setTheme = (v) => persist("theme", v);
  const setLastFolder = (v) => persist("lastFolder", v);
  const setLastFilePath = (v) => persist("lastFilePath", v);
  const setLastCIFPFilePath = (v) => persist("lastCIFPFilePath", v);
  const setMaxTabs = (n) => persist("maxTabs", Math.max(1, Math.min(10, n)));
  const setAutoOpenExternal = (v) => persist("autoOpenExternal", Boolean(v));

  const setSectionCollapsed = (section, collapsed) => {
    const next = {
      ...(storeData.sectionCollapsed ?? {}),
      [section]: collapsed,
    };
    persist("sectionCollapsed", next);
  };

  const pushKpi = async (snapshot) => {
    if (hasElectron()) {
      await window.electronAPI.store.pushKpi(snapshot);
      const updated = await window.electronAPI.store.get("kpiHistory");
      setStoreData((prev) => ({ ...prev, kpiHistory: updated }));
    } else {
      const history = [
        ...(storeData.kpiHistory ?? []),
        { ts: Date.now(), ...snapshot },
      ];
      if (history.length > 500) history.splice(0, history.length - 500);
      persist("kpiHistory", history);
    }
  };

  return {
    ready,
    theme: storeData.theme ?? "dark",
    lastFolder: storeData.lastFolder ?? null,
    lastFilePath: storeData.lastFilePath ?? null,
    lastCIFPFilePath: storeData.lastCIFPFilePath ?? null,
    sectionCollapsed: storeData.sectionCollapsed ?? DEFAULTS.sectionCollapsed,
    kpiHistory: storeData.kpiHistory ?? [],
    maxTabs: storeData.maxTabs ?? 5,
    autoOpenExternal: storeData.autoOpenExternal ?? false,
    setTheme,
    setLastFolder,
    setLastFilePath,
    setLastCIFPFilePath,
    setSectionCollapsed,
    setMaxTabs,
    setAutoOpenExternal,
    pushKpi,
    persist,
  };
};
