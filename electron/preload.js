/**
 * preload.js — contextBridge API surface.
 * Runs in isolated renderer context. Only explicitly listed channels
 * are exposed — no raw ipcRenderer access in the renderer.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Channels the renderer is allowed to listen on via electronAPI.on()
const VALID_EVENTS = new Set([
  "ari-file-added",
  "ari-file-changed",
  "sav-file-changed",
  "file-removed",
  "watcher-error",
  "files-added-batch",   // batched new-file notifications for badge / sound
  "update-status",       // auto-updater progress events
]);

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Folder / watcher ─────────────────────────────────────────────────────
  openFolderDialog: () => ipcRenderer.invoke("dialog:open-folder"),
  openFileDialog:   () => ipcRenderer.invoke("dialog:open-file"),
  scanFolder:  (folderPath) => ipcRenderer.invoke("folder:scan", { folderPath }),
  startWatcher:(folderPath) => ipcRenderer.invoke("watcher:start", { folderPath }),
  stopWatcher: ()           => ipcRenderer.invoke("watcher:stop"),

  // ── File operations ───────────────────────────────────────────────────────
  openFile:    (fp)       => ipcRenderer.invoke("file:open",   fp),
  decodeFile:  (fp)       => ipcRenderer.invoke("file:decode", fp),
  reloadFile:  (fp)       => ipcRenderer.invoke("file:reload", fp),
  writeFile:   (fp, data) => ipcRenderer.invoke("file:write",  fp, data),
  openFilePath:(fp)       => ipcRenderer.invoke("shell:open-path", fp),

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow:    () => ipcRenderer.send("window:close"),

  // ── PDF Tools (renderer-driven save) ────────────────────────────────────
  saveFile: (name, arrayBuffer) => ipcRenderer.invoke("pdf:save", name, arrayBuffer),

  // ── PDF Tools (IPC operations) ───────────────────────────────────────────
  pdf: {
    pageCount:       (fp)          => ipcRenderer.invoke("pdf:pageCount",       fp),
    merge:           (paths, name) => ipcRenderer.invoke("pdf:merge",           paths, name),
    split:           (opts)        => ipcRenderer.invoke("pdf:split",           opts),
    organise:        (opts)        => ipcRenderer.invoke("pdf:organise",        opts),
    rotate:          (opts)        => ipcRenderer.invoke("pdf:rotate",          opts),
    compress:        (fp)          => ipcRenderer.invoke("pdf:compress",        fp),
    getOutputDir:    ()            => ipcRenderer.invoke("pdf:getOutputDir"),
    chooseOutputDir: ()            => ipcRenderer.invoke("pdf:chooseOutputDir"),
  },

  // ── CIFP reader ──────────────────────────────────────────────────────────
  cifp: {
    browse:    ()               => ipcRenderer.invoke("cifp:browse"),
    read:      (fp)             => ipcRenderer.invoke("cifp:read",      fp),
    decodeRaw: (name, raw)      => ipcRenderer.invoke("cifp:decodeRaw", name, raw),
  },

  // ── Persistence ───────────────────────────────────────────────────────────
  store: {
    getAll:  ()         => ipcRenderer.invoke("store:get-all"),
    get:     (key)      => ipcRenderer.invoke("store:get",      key),
    set:     (key, val) => ipcRenderer.invoke("store:set",      key, val),
    pushKpi: (snap)     => ipcRenderer.invoke("store:push-kpi", snap),
  },

  // ── Notification / badge ─────────────────────────────────────────────────
  markTabViewed: (tabId) => ipcRenderer.send("tab-viewed",    tabId),
  markAllViewed: ()      => ipcRenderer.send("tabs-all-viewed"),

  // ── Auto-updater ──────────────────────────────────────────────────────────
  updater: {
    check:    () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install:  () => ipcRenderer.invoke("update:install"),
  },

  // ── Generic event subscription ────────────────────────────────────────────
  // Returns an unsubscribe function — caller must invoke it in useEffect cleanup.
  on: (channel, callback) => {
    if (!VALID_EVENTS.has(channel)) {
      console.warn(`[preload] Blocked listener on unknown channel: "${channel}"`);
      return () => {};
    }
    const wrapped = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
