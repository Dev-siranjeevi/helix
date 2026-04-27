/**
 * main.js — Electron main process entry point.
 * Node 22 / Electron 41 compatible.
 */

"use strict";

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
  nativeImage,
} = require("electron/main");
const path = require("node:path");
const fs = require("node:fs/promises");
const chokidar = require("chokidar");

const { statFile, openFile, processSavFile } = require("./fileProcessor");
const { getAll, get, set, pushKpi, saveWindowBounds } = require("./store");
const { initUpdater } = require("./updater");

// ── NODE_ENV — set early, electronmon does not set this ──────────────────────
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = app.isPackaged ? "production" : "development";
}

const isDev = process.env.NODE_ENV !== "production";

// ── Chromium flags — must be set before app.whenReady() ─────────────────────
if (isDev) {
  app.commandLine.appendSwitch("allow-insecure-localhost");
  app.commandLine.appendSwitch("disable-site-isolation-trials");
  app.commandLine.appendSwitch(
    "disable-features",
    "BlockInsecurePrivateNetworkRequests",
  );
}

let win = null;
let watcher = null;

// ── IPC → renderer ───────────────────────────────────────────────────────────
const sendEvent = (channel, payload) => {
  win?.webContents.send(channel, payload);
};


// ── Unviewed file counter + taskbar badge ─────────────────────────────────────
let unviewedCount = 0;
let batchTimer    = null;
const BATCH_MS    = 1200; // coalesce rapid file-adds into one badge update

/**
 * Generate a small red-circle badge image with a number, used as the
 * Windows taskbar overlay icon.  Uses Node canvas-free approach:
 * builds a tiny PNG via raw pixel data embedded as a data URL.
 */
const makeBadgeImage = (count) => {
  // SVG → nativeImage.createFromDataURL (works in Electron without canvas)
  const label = count > 99 ? "99+" : String(count);
  const w = 20, h = 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <circle cx="${w/2}" cy="${h/2}" r="${w/2}" fill="#e03535"/>
    <text x="${w/2}" y="${h/2 + 4}" text-anchor="middle"
      font-family="Arial" font-size="${label.length > 1 ? 9 : 11}"
      font-weight="bold" fill="#ffffff">${label}</text>
  </svg>`;
  const b64 = Buffer.from(svg).toString("base64");
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${b64}`);
};

const updateBadge = () => {
  if (!win) return;
  if (unviewedCount === 0) {
    // Clear
    if (process.platform === "darwin" || process.platform === "linux") {
      app.setBadgeCount(0);
    } else {
      win.setOverlayIcon(null, "");
    }
    win.setTitle("Helix");
    return;
  }
  if (process.platform === "darwin" || process.platform === "linux") {
    app.setBadgeCount(unviewedCount);
  } else {
    // Windows — overlay icon on taskbar button
    win.setOverlayIcon(makeBadgeImage(unviewedCount), `${unviewedCount} new file${unviewedCount !== 1 ? "s" : ""}`);
  }
  win.setTitle(`Helix (${unviewedCount} new)`);
};

const scheduleFileAddedBatch = (names) => {
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(() => {
    batchTimer = null;
    updateBadge();
    // Flash taskbar (Windows) / bounce dock (macOS)
    if (!win?.isFocused()) {
      win?.flashFrame(true);
      // Stop flashing once user focuses
      win?.once("focus", () => win?.flashFrame(false));
    }
    // Send batched notification to renderer for in-app sound trigger
    sendEvent("files-added-batch", { count: unviewedCount, names });
  }, BATCH_MS);
};

// ── Window ────────────────────────────────────────────────────────────────────
const createWindow = () => {
  const iconPath = path.join(__dirname, "../build/icons/icon.ico");
  const iconExists = (() => {
    try {
      require("node:fs").accessSync(iconPath);
      return true;
    } catch {
      return false;
    }
  })();

  // Restore last saved bounds
  const bounds = get("windowBounds") ?? {};

  win = new BrowserWindow({
    width: bounds.width ?? 1280,
    height: bounds.height ?? 800,
    x: bounds.x ?? undefined,
    y: bounds.y ?? undefined,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hidden",
    icon: iconExists ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // required for contextBridge
      nodeIntegration: false, // must be false when contextIsolation is true
      sandbox: false, // keep — needed for preload to use require()
      webSecurity: !isDev,
    },
  });

  if (isDev) {
    // wait for vite dev server
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("close", () => saveWindowBounds(win));
  win.on("closed", () => {
    win = null;
    stopWatcher();
  });
};

// ── File filter ───────────────────────────────────────────────────────────────
// .sav — never listed directly (processed silently as patches)
// .ari with "resort" in stem — excluded
const shouldList = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const stem = path.basename(filePath, ext).toLowerCase();
  return ext === ".ari" && !stem.includes("resort");
};

// ── Folder scanner — stubs only, no decode ───────────────────────────────────
const scanFolder = async (folderPath) => {
  const walk = async (dir) => {
    let results = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await walk(fullPath));
      } else if (entry.isFile() && shouldList(fullPath)) {
        results.push(fullPath);
      }
    }
    return results;
  };

  const ariPaths = await walk(folderPath);
  console.log("[scan] Found", ariPaths.length, ".ari files in", folderPath);

  const files = await Promise.allSettled(ariPaths.map((fp) => statFile(fp)));

  return files.filter((r) => r.status === "fulfilled").map((r) => r.value);
};

// ── Watcher handlers ──────────────────────────────────────────────────────────
// Track names for batched notification
const pendingNames = [];

const handleAriAdded = async (filePath) => {
  try {
    const stub = await statFile(filePath);
    sendEvent("ari-file-added", stub);
    console.log("[watcher] Added:", stub.name);

    unviewedCount++;
    pendingNames.push(stub.name);
    scheduleFileAddedBatch([...pendingNames]);

    if (get("autoOpenExternal")) shell.openPath(filePath);
  } catch (err) {
    console.error("[watcher] handleAriAdded:", err.message);
  }
};

const handleAriChanged = async (filePath) => {
  try {
    const stub = await statFile(filePath);
    sendEvent("ari-file-changed", stub);
    console.log("[watcher] Changed:", stub.name);
  } catch (err) {
    console.error("[watcher] handleAriChanged:", err.message);
  }
};

const handleSavFile = async (savPath) => {
  try {
    const stem = path.basename(savPath, ".sav");
    const ariPath = path.join(path.dirname(savPath), `${stem}.ari`);
    sendEvent("sav-file-changed", { savPath, ariPath, stem });
    console.log("[watcher] SAV changed:", stem);
  } catch (err) {
    console.error("[watcher] handleSavFile:", err.message);
  }
};

// ── File watcher ──────────────────────────────────────────────────────────────
const startWatcher = (folderPath) => {
  stopWatcher();
  const normalized = folderPath.replace(/\\/g, "/");
  console.log("[watcher] Starting on:", normalized);

  watcher = chokidar.watch(normalized, {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[/\\])\../, // ignore dotfiles
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher
    .on("ready", () => console.log("[watcher] Ready"))
    .on("add", (fp) => {
      const ext = path.extname(fp).toLowerCase();
      if (ext === ".sav") {
        handleSavFile(fp);
        return;
      }
      if (!shouldList(fp)) {
        console.log("[watcher] Skipped:", path.basename(fp));
        return;
      }
      handleAriAdded(fp);
    })
    .on("change", (fp) => {
      const ext = path.extname(fp).toLowerCase();
      if (ext === ".sav") {
        handleSavFile(fp);
        return;
      }
      if (!shouldList(fp)) return;
      handleAriChanged(fp);
    })
    .on("unlink", (fp) => {
      sendEvent("file-removed", fp);
      console.log("[watcher] Removed:", path.basename(fp));
    })
    .on("error", (err) => {
      console.error("[watcher] Error:", err.message);
      sendEvent("watcher-error", err.message);
    });

  return { success: true, folder: normalized };
};

const stopWatcher = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log("[watcher] Stopped");
  }
};

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // ── Allow localhost requests in dev (for Vite HMR + dynamic imports) ──
  if (isDev) {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
      },
    );

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Access-Control-Allow-Origin": ["*"],
        },
      });
    });
  }
  // ── Folder / watcher ─────────────────────────────────────────────────────
  ipcMain.handle("ping", () => "pong");

  ipcMain.handle("dialog:open-folder", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const folderPath = result.filePaths[0];
    const existingFiles = await scanFolder(folderPath);
    return { folderPath, existingFiles };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  ipcMain.handle("folder:scan", async (_e, p) => {
    if (!p?.folderPath) return { success: false, error: "No folder path" };
    try {
      const existingFiles = await scanFolder(p.folderPath);
      return { success: true, existingFiles };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("watcher:start", (_e, p) => {
    if (!p?.folderPath) return { success: false, error: "No folder specified" };
    return startWatcher(p.folderPath);
  });

  ipcMain.handle("watcher:stop", () => {
    stopWatcher();
    return { success: true };
  });

  // ── File open / reload — decode on demand ────────────────────────────────
  ipcMain.handle("file:open", async (_e, filePath) => {
    try {
      const file = await openFile(filePath);
      console.log("[file:open] Decoded:", file.name);
      return { success: true, file };
    } catch (err) {
      console.error("[file:open]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ── file:decode — decode only, no tab registration ───────────────────────
  ipcMain.handle("file:decode", async (_e, filePath) => {
    try {
      const file = await openFile(filePath);
      console.log("[file:decode] Decoded for compare:", file.name);
      return { success: true, file };
    } catch (err) {
      console.error("[file:decode]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:reload", async (_e, filePath) => {
    try {
      const file = await openFile(filePath);
      console.log("[file:reload] Reloaded:", file.name);
      return { success: true, file };
    } catch (err) {
      console.error("[file:reload]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ── File write (raw editor replace) ─────────────────────────────────────
  ipcMain.handle("file:write", async (_e, filePath, data) => {
    try {
      await fs.writeFile(filePath, data, "utf-8");
      console.log("[file:write] Saved:", path.basename(filePath));
      return { success: true };
    } catch (err) {
      console.error("[file:write]", err.message);
      return { success: false, error: err.message };
    }
  });
  // ── File loader ─────────────────────────────────────────────────────────────
  ipcMain.handle("dialog:open-file", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];

    return { filePath };
  });


  // ── Tab viewed → decrement unviewed badge ────────────────────────────────
  ipcMain.on("tab-viewed", (_e, _tabId) => {
    if (unviewedCount > 0) {
      unviewedCount--;
      updateBadge();
    }
    // Clear pending names when user starts viewing
    if (unviewedCount === 0) pendingNames.length = 0;
  });

  // ── All tabs cleared → reset badge ───────────────────────────────────────
  ipcMain.on("tabs-all-viewed", () => {
    unviewedCount = 0;
    pendingNames.length = 0;
    updateBadge();
  });


  // ══════════════════════════════════════════════════════════════════════════
  //  PDF Tools  — merge / split / organise via pdf-lib
  // ══════════════════════════════════════════════════════════════════════════
  const getPdfLib = () => {
    try { return require("pdf-lib"); }
    catch { return null; }
  };

  // ── Resolve output directory (prompt once, then remember) ─────────────────
  // Pass forcePrompt=true to override the stored value (used by Settings reset).
  const resolveOutputDir = async (forcePrompt = false) => {
    const stored = get("pdfOutputDir");
    if (stored && !forcePrompt) {
      // Verify it still exists on disk
      try { await fs.access(stored); return stored; } catch { /* fall through to prompt */ }
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "Choose PDF output folder",
      buttonLabel: "Use this folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths?.[0]) return null;
    set("pdfOutputDir", filePaths[0]);
    return filePaths[0];
  };

  // ── Page count ─────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:pageCount", async (_e, filePath) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed. Run: npm install pdf-lib" };
      const { PDFDocument } = pdfLib;
      const bytes = await fs.readFile(filePath);
      const doc   = await PDFDocument.load(bytes);
      return { success: true, count: doc.getPageCount() };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Get / reset output dir (called from Settings) ─────────────────────────
  ipcMain.handle("pdf:getOutputDir", () => get("pdfOutputDir") ?? null);
  ipcMain.handle("pdf:chooseOutputDir", async () => {
    const dir = await resolveOutputDir(true);
    return dir ? { success: true, dir } : { success: false, canceled: true };
  });

  // ── Merge ──────────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:merge", async (_e, filePaths, outputName) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed. Run: npm install pdf-lib" };
      const { PDFDocument } = pdfLib;
      const merged = await PDFDocument.create();
      for (const fp of filePaths) {
        const bytes = await fs.readFile(fp);
        const src   = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const outBytes = await merged.save();
      const outDir = await resolveOutputDir();
      if (!outDir) return { success: false, error: "Cancelled" };
      const outName = (outputName ?? "merged.pdf").replace(/\.pdf$/i, "") + ".pdf";
      const outPath = path.join(outDir, outName);
      await fs.writeFile(outPath, outBytes);
      return { success: true, outPath };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Split ──────────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:split", async (_e, { filePath, mode, ranges, everyN, pages }) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed. Run: npm install pdf-lib" };
      const { PDFDocument } = pdfLib;
      const bytes   = await fs.readFile(filePath);
      const srcDoc  = await PDFDocument.load(bytes);
      const total   = srcDoc.getPageCount();

      let groups = [];
      if (mode === "every") {
        const n = Math.max(1, everyN);
        for (let i = 0; i < total; i += n)
          groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
      } else if (mode === "range") {
        for (const part of ranges.split(",")) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          if (trimmed.includes("-")) {
            const [a, b] = trimmed.split("-").map(Number);
            groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i).filter(i => i >= 0 && i < total));
          } else {
            const n = Number(trimmed) - 1;
            if (n >= 0 && n < total) groups.push([n]);
          }
        }
      } else if (mode === "pages") {
        const idxs = pages.split(",").map(s => Number(s.trim()) - 1).filter(i => i >= 0 && i < total);
        if (idxs.length) groups.push(idxs);
      }

      if (!groups.length) return { success: false, error: "No valid pages selected" };

      const outDir = await resolveOutputDir();
      if (!outDir) return { success: false, error: "Cancelled" };

      const base = path.basename(filePath, ".pdf");
      for (let g = 0; g < groups.length; g++) {
        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(srcDoc, groups[g]);
        copied.forEach(p => newDoc.addPage(p));
        const outBytes = await newDoc.save();
        const outName  = groups.length === 1 ? `${base}_split.pdf` : `${base}_part${g+1}.pdf`;
        await fs.writeFile(path.join(outDir, outName), outBytes);
      }
      return { success: true, count: groups.length, outDir };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Organise (reorder + rotate) ────────────────────────────────────────────
  ipcMain.handle("pdf:organise", async (_e, { filePath, pages }) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed. Run: npm install pdf-lib" };
      const { PDFDocument, degrees } = pdfLib;
      const bytes  = await fs.readFile(filePath);
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();

      for (const { page: pageNum, rotation } of pages) {
        const [copied] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
        if (rotation) copied.setRotation(degrees(rotation));
        newDoc.addPage(copied);
      }

      const outDir = await resolveOutputDir();
      if (!outDir) return { success: false, error: "Cancelled" };
      const outName = path.basename(filePath, ".pdf") + "_organised.pdf";
      const outPath = path.join(outDir, outName);
      await fs.writeFile(outPath, await newDoc.save());
      return { success: true, outPath };
    } catch (err) { return { success: false, error: err.message }; }
  });


  // ── PDF save dialog (renderer-driven save, fallback) ─────────────────────
  ipcMain.handle("pdf:save", async (_e, suggestedName, arrayBuffer) => {
    const outDir = await resolveOutputDir();
    if (!outDir) return { success: false, canceled: true };
    try {
      const outPath = path.join(outDir, suggestedName);
      await fs.writeFile(outPath, Buffer.from(arrayBuffer));
      return { success: true, filePath: outPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Rotate ─────────────────────────────────────────────────────────────────
  ipcMain.handle("pdf:rotate", async (_e, { filePath, angle, pageIndices }) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed." };
      const { PDFDocument, degrees } = pdfLib;
      const bytes  = await fs.readFile(filePath);
      const doc    = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total  = doc.getPageCount();
      const idxs   = pageIndices?.length ? pageIndices : Array.from({ length: total }, (_, i) => i);
      idxs.forEach((i) => {
        if (i < 0 || i >= total) return;
        const pg  = doc.getPage(i);
        const cur = pg.getRotation().angle;
        pg.setRotation(degrees((cur + angle) % 360));
      });
      const outBytes = await doc.save();
      const outDir   = await resolveOutputDir();
      if (!outDir) return { success: false, canceled: true };
      const outName  = path.basename(filePath, ".pdf") + `_rot${angle}.pdf`;
      const outPath  = path.join(outDir, outName);
      await fs.writeFile(outPath, outBytes);
      return { success: true, outPath };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Compress (lossless optimise) ───────────────────────────────────────────
  ipcMain.handle("pdf:compress", async (_e, filePath) => {
    try {
      const pdfLib = getPdfLib();
      if (!pdfLib) return { success: false, error: "pdf-lib not installed." };
      const { PDFDocument } = pdfLib;
      const bytes  = await fs.readFile(filePath);
      const doc    = await PDFDocument.load(bytes, { ignoreEncryption: true });
      doc.setTitle(""); doc.setAuthor(""); doc.setSubject("");
      doc.setKeywords([]); doc.setProducer(""); doc.setCreator("");
      const outBytes  = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      const outDir    = await resolveOutputDir();
      if (!outDir) return { success: false, canceled: true };
      const outName   = path.basename(filePath, ".pdf") + "_compressed.pdf";
      const outPath   = path.join(outDir, outName);
      await fs.writeFile(outPath, outBytes);
      const saved = (( 1 - outBytes.byteLength / bytes.byteLength ) * 100).toFixed(1);
      return { success: true, outPath, savedPercent: saved };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── CIFP reader — read raw text file ─────────────────────────────────────

  ipcMain.handle("cifp:decodeRaw", async (_e, fileName, raw) => {
    try {
      const { decodeProcedure } = require("./decoders/procedureDecoder");
      const decoded = decodeProcedure(raw);
      const ccLine = raw.split("\n").find((l) => l[0] === "T");
      const customerCode = ccLine ? ccLine.substring(1, 4) : "";
      return {
        success: true,
        name: fileName,
        filePath: fileName,
        file: {
          ...decoded,
          customerCode,
          raw,
          path: fileName,
          name: fileName.replace(/\.[^.]+$/, ""),
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("cifp:read", async (_e, filePath) => {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return { success: true, raw, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("cifp:browse", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Open CIFP / ARI file",
      properties: ["openFile"],
      filters: [
        { name: "ARINC 424 Files", extensions: ["dat", "ari", "txt", "cifp"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const { decodeProcedure } = require("./decoders/procedureDecoder");
      const decoded = decodeProcedure(raw);
      const ccLine = raw.split("\n").find((l) => l[0] === "T");
      const customerCode = ccLine ? ccLine.substring(1, 4) : "";
      return {
        success: true,
        raw,
        filePath,
        name: path.basename(filePath),
        file: { ...decoded, customerCode, raw, path: filePath, name: path.basename(filePath, path.extname(filePath)) },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Store ─────────────────────────────────────────────────────────────────
  ipcMain.handle("store:get-all", () => getAll());
  ipcMain.handle("store:get", (_e, key) => get(key));
  ipcMain.handle("store:set", (_e, k, v) => {
    set(k, v);
    return { success: true };
  });
  ipcMain.handle("store:push-kpi", (_e, snap) => {
    pushKpi(snap);
    return { success: true };
  });

  // ── Shell ─────────────────────────────────────────────────────────────────
  ipcMain.handle("shell:open-path", (_e, fp) => shell.openPath(fp));

  // ── Window controls ───────────────────────────────────────────────────────
  ipcMain.on("window:minimize", () => win?.minimize());
  ipcMain.on("window:maximize", () =>
    win?.isMaximized() ? win.unmaximize() : win.maximize(),
  );
  ipcMain.on("window:close", () => win?.close());

  createWindow();
  initUpdater(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
app.on("before-quit", () => stopWatcher());
app.on("window-all-closed", () => {
  stopWatcher();
  if (process.platform !== "darwin") app.quit();
});
