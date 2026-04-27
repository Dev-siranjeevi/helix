/**
 * updater.js — electron-updater integration.
 * Called once from main.js after createWindow().
 * Auto-check runs silently on startup; manual check/download/install
 * are triggered via IPC from the renderer's UpdateManager component.
 */

"use strict";

const { autoUpdater } = require("electron-updater");
const { ipcMain, app } = require("electron");
const log = require("electron-log");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
autoUpdater.autoDownload = false;        // Never download without user consent
autoUpdater.autoInstallOnAppQuit = false;

let mainWindow = null;

function send(status, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", { status, payload });
  }
}

function initUpdater(win) {
  mainWindow = win;

  // ── Auto-updater events ──────────────────────────────────────────────────
  autoUpdater.on("checking-for-update",  ()         => send("checking"));
  autoUpdater.on("update-available",     (info)     => send("available", info));
  autoUpdater.on("update-not-available", ()         => send("not-available"));
  autoUpdater.on("download-progress",    (progress) => send("downloading", progress));
  autoUpdater.on("update-downloaded",    ()         => send("ready"));
  autoUpdater.on("error", (err) => {
    log.error("Updater error:", err);
    send("error", err.message);
  });

  // ── IPC handlers ────────────────────────────────────────────────────────
  ipcMain.handle("update:check", async () => {
    try { await autoUpdater.checkForUpdates(); }
    catch (err) { log.error("Check failed:", err); send("error", err.message); }
  });

  ipcMain.handle("update:download", async () => {
    try { await autoUpdater.downloadUpdate(); }
    catch (err) { log.error("Download failed:", err); send("error", err.message); }
  });

  ipcMain.handle("update:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // ── Auto-check on startup (silent — never blocks launch) ────────────────
  // Only attempt in packaged builds; dev mode has no update feed.
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn("Startup auto-check failed (offline?):", err.message);
    });
  }
}

module.exports = { initUpdater };
