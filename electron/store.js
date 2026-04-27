/**
 * store.js — electron-store v8 wrapper (CommonJS compatible).
 *
 * Persists to: %APPDATA%/helix/config.json (Windows)
 * electron-store v9+ is ESM-only — stay on v8.
 */

"use strict";

const Store = require("electron-store");

const store = new Store({
  name: "config",
  clearInvalidConfig: true, // auto-recover if config.json is corrupt
  defaults: {
    lastFolder: null,
    windowBounds: { width: 1280, height: 800, x: null, y: null },
    theme: "dark",
    sectionCollapsed: { header: false, procedure: false, waypoints: false },
    kpiHistory: [],
    lastFilePath: null,
    lastCIFPFilePath: null,
    maxTabs: 5,
    autoOpenExternal: false,
  },
});

// ── Read ──────────────────────────────────────────────────────────────────────
const getAll = () => store.store;
const get = (key) => store.get(key);

// ── Write ─────────────────────────────────────────────────────────────────────
const set = (key, val) => {
  if (val === null || val === undefined) {
    store.delete(key);
  } else {
    store.set(key, val);
  }
};

// ── KPI history — capped at 500 entries ──────────────────────────────────────
const pushKpi = (snapshot) => {
  const history = store.get("kpiHistory") ?? [];
  history.push({ ts: Date.now(), ...snapshot });
  if (history.length > 500) history.splice(0, history.length - 500);
  store.set("kpiHistory", history);
};

// ── Window bounds — saved on close ───────────────────────────────────────────
const saveWindowBounds = (win) => {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isMinimized())
    return;
  const [width, height] = win.getSize();
  const [x, y] = win.getPosition();
  store.set("windowBounds", { width, height, x, y });
};

module.exports = { store, getAll, get, set, pushKpi, saveWindowBounds };
