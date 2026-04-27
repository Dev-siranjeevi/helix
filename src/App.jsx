/**
 * App.jsx — unified tab system (decoded + compare), auto-open on file add,
 * cart/PDF export, compare sessions with own limit.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "./hooks/useStore";
import { ThemeProvider } from "./context/ThemeContext";
import TitleBar from "./components/TitleBar";
import NavRail from "./components/NavRail";
import FileTabs from "./components/FileTabs";
import { useNotifications } from "./hooks/useNotifications";
import { useIdleDetector } from "./hooks/useIdleDetector";
import FilePanel from "./components/FilePanel";
import FilePickerModal from "./components/FilePickerModal";
import ExportCart from "./components/ExportCart";

import FilesPage    from "./pages/FilesPage";
import Compare      from "./pages/Compare";
import PDFTools     from "./pages/PDFTools";
import GuidePage    from "./pages/GuidePage";
import SettingsPage from "./pages/SettingsPage";
import UpdateManager from "./components/UpdateManager";
import CIFP         from "./pages/CIFP";
import Report       from "./pages/Report";

const MAX_COMPARE_TABS = 4;
let cmpCounter = 0;
const newCmpSession = () => ({
  id: `cmp-${++cmpCounter}`,
  type: "compare",
  label: `Compare ${cmpCounter}`,
  fileA: null, fileB: null,
  procIdA: null, procIdB: null,
  transA: null, transB: null,
});

let cartCounter = 0;

function AppInner({ store }) {
  const { unviewedTabs, markTabUnviewed, markTabViewed, markAllViewed } = useNotifications();
  const isIdle = useIdleDetector(3000);
  const isIdleRef = useRef(false);
  useEffect(() => { isIdleRef.current = isIdle; }, [isIdle]);
  // Queue of tab IDs auto-opened while user was active — switch when idle
  const pendingAutoTabsRef = useRef([]);

  // When user goes idle: switch to last auto-opened tab they haven't seen
  useEffect(() => {
    if (!isIdle) return;
    const pending = pendingAutoTabsRef.current;
    if (!pending.length) return;
    const lastId = pending.at(-1);
    pendingAutoTabsRef.current = [];
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === lastId);
      if (!exists) return prev;
      setActiveTab(lastId);
      setActiveSection("decoded");
      setHiddenSegments(new Set());
      markTabViewed(lastId);
      return prev;
    });
  }, [isIdle, markTabViewed]);

  const [filePath,       setFilePath]       = useState("");
  const [folderPath,     setFolderPath]     = useState("");
  const [watching,       setWatching]       = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [ariFiles,       setAriFiles]       = useState([]);
  // Unified tab list: each entry is either a decoded file-object (type:"decoded")
  // or a compare session (type:"compare"). Both have a stable .id field.
  const [tabs,           setTabs]           = useState([]);
  const [activeTab,      setActiveTab]      = useState(null); // tab.id
  const [activeSection,  setActiveSection]  = useState("decoded");
  const [showPicker,     setShowPicker]     = useState(false);
  const [newFilePaths,   setNewFilePaths]   = useState(new Set());
  const [highlights,     setHighlights]     = useState({});
  const [loadingPaths,   setLoadingPaths]   = useState(new Set());
  const [hiddenSegments, setHiddenSegments] = useState(new Set());
  const [cartItems,      setCartItems]      = useState([]);
  const [showCart,       setShowCart]       = useState(false);
  // In-memory cache for compare decode (keyed by file path)
  const decodeCacheRef = useRef(new Map());
  const [, forceUpdate] = useState(0);

  const unsubs    = useRef([]);
  const folderRef = useRef("");

  useEffect(() => { folderRef.current = folderPath; }, [folderPath]);

  // ── Restore last folder ───────────────────────────────────────────────────
  useEffect(() => {
    if (store.lastFolder && !folderPath) initFolder(store.lastFolder, store.lastCIFPFilePath);
  }, []);

  // ── Folder init ───────────────────────────────────────────────────────────
  const initFolder = async (fp, cifpFilePath) => {
    if (!fp) return;
    setScanning(true); setFolderPath(fp); folderRef.current = fp;
    store.setLastFolder(fp); setFilePath(cifpFilePath);
    store.setLastCIFPFilePath(cifpFilePath);
    try {
      const result = await window.electronAPI?.scanFolder(fp);
      setAriFiles(result?.existingFiles ?? []);
    } catch (err) { console.error("[initFolder]", err.message); }
    finally { setScanning(false); }
    wireWatcher(fp);
  };

  // ── Watcher ───────────────────────────────────────────────────────────────
  const wireWatcher = async (fp) => {
    const target = fp ?? folderRef.current;
    if (!target) return;
    try {
      const r = await window.electronAPI?.startWatcher(target);
      if (!r?.success) return;
      setWatching(true);
    } catch (err) { console.error("[wireWatcher]", err.message); return; }

    unsubs.current.forEach((fn) => fn());
    unsubs.current = [
      on("ari-file-added", (stub) => {
        setAriFiles((prev) => prev.some((f) => f.path === stub.path) ? prev : [stub, ...prev]);
        pulseNew(stub.path);
        autoOpenFile(stub.path);
      }),
      on("ari-file-changed", (stub) => {
        setAriFiles((prev) => prev.map((f) => f.path === stub.path ? { ...f, ...stub } : f));
        setTabs((prev) => { if (prev.some((t) => t.path === stub.path)) reloadAndUpdate(stub.path); return prev; });
      }),
      on("sav-file-changed", ({ ariPath }) => {
        setTabs((prev) => { if (prev.some((t) => t.path === ariPath)) reloadAndUpdate(ariPath); return prev; });
      }),
      on("file-removed", (fp) => removeFile(fp)),
      on("watcher-error", (e) => console.error("[watcher]", e)),
    ];
  };

  const on = (channel, cb) => window.electronAPI?.on(channel, cb) ?? (() => {});

  // ── Auto open on file add ─────────────────────────────────────────────────
  const autoOpenFile = useCallback(async (filePath) => {
    if (!filePath) return;
    setLoadingPaths((prev) => new Set([...prev, filePath]));
    try {
      const result = await window.electronAPI?.openFile(filePath);
      if (!result?.success) return;
      const file = { ...result.file, type: "decoded", id: result.file.path };
      const limit = store.maxTabs ?? 5;
      setTabs((prev) => {
        if (prev.some((t) => t.id === filePath)) return prev;
        const decodedTabs = prev.filter((t) => t.type === "decoded");
        let next = [...prev];
        if (decodedTabs.length >= limit) {
          const oldest = decodedTabs[0];
          next = next.filter((t) => t.id !== oldest.id);
          markTabViewed(oldest.id);
        }
        return [...next, file];
      });
      markTabUnviewed(filePath);
      if (isIdleRef.current) {
        // User idle → switch immediately
        setActiveTab(filePath);
        setActiveSection("decoded");
        markTabViewed(filePath);
        pendingAutoTabsRef.current = [];
      } else {
        // User active → queue, will switch when they go idle
        pendingAutoTabsRef.current.push(filePath);
      }
      setAriFiles((prev) => prev.map((f) => f.path === filePath ? { ...f, hasSav: file.hasSav } : f));
    } catch (err) { console.error("[autoOpenFile]", err.message); }
    finally { setLoadingPaths((prev) => { const n = new Set(prev); n.delete(filePath); return n; }); }
  }, [store.maxTabs, markTabUnviewed, markTabViewed]);

  // ── Open file (manual, navigates to it) ──────────────────────────────────
  const openAndDecode = useCallback(async (filePath) => {
    if (!filePath) return;
    // Already open → just activate
    setTabs((prev) => {
      if (prev.some((t) => t.id === filePath)) {
        setActiveTab(filePath); setActiveSection("decoded"); return prev;
      }
      return prev;
    });
    setLoadingPaths((prev) => new Set([...prev, filePath]));
    try {
      const result = await window.electronAPI?.openFile(filePath);
      if (!result?.success) throw new Error(result?.error ?? "Failed to open");
      const file = { ...result.file, type: "decoded", id: result.file.path };
      const limit = store.maxTabs ?? 5;
      setTabs((prev) => {
        if (prev.some((t) => t.id === filePath)) return prev;
        const decodedTabs = prev.filter((t) => t.type === "decoded");
        let next = [...prev];
        if (decodedTabs.length >= limit) {
          const oldest = decodedTabs[0];
          next = next.filter((t) => t.id !== oldest.id);
        }
        return [...next, file];
      });
      setActiveTab(filePath); setActiveSection("decoded");
      setHiddenSegments(new Set()); store.setLastFilePath(filePath);
      setAriFiles((prev) => prev.map((f) => f.path === filePath ? { ...f, hasSav: file.hasSav } : f));
    } catch (err) { console.error("[openAndDecode]", err.message); }
    finally { setLoadingPaths((prev) => { const n = new Set(prev); n.delete(filePath); return n; }); }
  }, [store.maxTabs]);

  // ── Reload tab ────────────────────────────────────────────────────────────
  const reloadAndUpdate = useCallback(async (filePath) => {
    try {
      const result = await window.electronAPI?.reloadFile(filePath);
      if (!result?.success) return;
      setTabs((prev) => prev.map((t) => t.id === filePath ? { ...result.file, type: "decoded", id: filePath } : t));
    } catch (err) { console.error("[reloadAndUpdate]", err.message); }
  }, []);

  // ── Compare decode cache ──────────────────────────────────────────────────
  const getDecoded = useCallback((path) => {
    if (!path) return null;
    const tab = tabs.find((t) => t.type === "decoded" && t.id === path);
    if (tab) return tab;
    return decodeCacheRef.current.get(path) ?? null;
  }, [tabs]);

  const decodeForCompare = useCallback(async (path) => {
    if (!path || decodeCacheRef.current.has(path)) return;
    decodeCacheRef.current.set(path, null);
    try {
      const result = await window.electronAPI?.decodeFile(path);
      if (result?.success && result.file) {
        decodeCacheRef.current.set(path, { ...result.file, type: "decoded", id: path });
        forceUpdate((n) => n + 1);
      } else { decodeCacheRef.current.delete(path); }
    } catch { decodeCacheRef.current.delete(path); }
  }, []);

  // ── Compare session management ────────────────────────────────────────────
  const addCompareTab = useCallback(() => {
    const cmpTabs = tabs.filter((t) => t.type === "compare");
    if (cmpTabs.length >= MAX_COMPARE_TABS) {
      const oldest = cmpTabs[0];
      setTabs((prev) => prev.filter((t) => t.id !== oldest.id));
    }
    const s = newCmpSession();
    setTabs((prev) => [...prev, s]);
    setActiveTab(s.id);
    setActiveSection("compare");
  }, [tabs]);

  const updateCompareSession = useCallback((sessionId, patch) => {
    setTabs((prev) => prev.map((t) => {
      if (t.id !== sessionId || t.type !== "compare") return t;
      const merged = { ...t, ...patch };
      const pA = merged.procIdA ?? "";
      const pB = merged.procIdB ?? "";
      if (pA && pB && pA !== pB) merged.label = `${pA} ↔ ${pB}`;
      else if (pA) merged.label = pA + " ↔ ?";
      return merged;
    }));
  }, []);

  // ── Select/close tabs ─────────────────────────────────────────────────────
  const handleSelectTab = useCallback((id) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    setActiveTab(id);
    setActiveSection(tab.type === "compare" ? "compare" : "decoded");
    if (tab.type === "decoded") setHiddenSegments(new Set());
    markTabViewed(id);
  }, [tabs, markTabViewed]);

  const closeTab = useCallback((id) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveTab((cur) => {
        if (cur !== id) return cur;
        if (!next.length) return null;
        return next.at(-1).id;
      });
      return next;
    });
  }, []);

  const closeAllTabs = useCallback(() => { setTabs([]); setActiveTab(null); markAllViewed(); }, [markAllViewed]);

  // ── File removed from watcher ─────────────────────────────────────────────
  const removeFile = useCallback((fp) => {
    setAriFiles((prev) => prev.filter((f) => f.path !== fp));
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== fp);
      setActiveTab((cur) => cur !== fp ? cur : (next.at(-1)?.id ?? null));
      return next;
    });
  }, []);

  const pulseNew = (fp) => {
    setNewFilePaths((prev) => new Set([...prev, fp]));
    setTimeout(() => setNewFilePaths((prev) => { const n = new Set(prev); n.delete(fp); return n; }), 3000);
  };

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = useCallback((sessionOrFile, diffOrNull, nameA, nameB) => {
    const cartId = `cart-${++cartCounter}`;
    if (diffOrNull) {
      setCartItems((prev) => [...prev, { cartId, type: "compare", diff: diffOrNull, nameA, nameB }]);
    } else {
      setCartItems((prev) => [...prev, { cartId, type: "decoded", file: sessionOrFile }]);
    }
    setShowCart(true);
  }, []);

  const removeFromCart = useCallback((cartId) => setCartItems((prev) => prev.filter((i) => i.cartId !== cartId)), []);
  const clearCart      = useCallback(() => setCartItems([]), []);

  // ── Browse ────────────────────────────────────────────────────────────────
  const handleBrowse = async () => {
    const response = await window.electronAPI?.openFolderDialog();
    if (!response) return;
    setFolderPath(response.filePath); folderRef.current = response.folderPath;
    store.setLastFolder(response.folderPath);
    setAriFiles(response.existingFiles ?? []);
    wireWatcher(response.folderPath);
  };
  const handleFileBrowse = async () => {
    const responseFile = await window.electronAPI?.openFileDialog();
    if (!responseFile) return;
    setFilePath(responseFile.filePath); store.setLastCIFPFilePath(responseFile.filePath);
  };
  const handleStart = () => wireWatcher(folderRef.current);
  const handleStop = async () => {
    await window.electronAPI?.stopWatcher();
    unsubs.current.forEach((fn) => fn()); unsubs.current = []; setWatching(false);
  };

  useEffect(() => () => unsubs.current.forEach((fn) => fn()), []);

  // ── Active items ──────────────────────────────────────────────────────────
  const activeTabObj  = tabs.find((t) => t.id === activeTab) ?? null;
  const activeFile    = activeTabObj?.type === "decoded" ? activeTabObj : null;
  const activeCmpSess = activeTabObj?.type === "compare" ? activeTabObj : null;

  if (activeCmpSess) {
    activeCmpSess._onChange = (patch) => updateCompareSession(activeCmpSess.id, patch);
  }

  // ── Page renderer ─────────────────────────────────────────────────────────
  const renderPage = () => {
    if (activeTabObj?.type === "compare") {
      return (
        <Compare
          session={activeCmpSess}
          ariFiles={ariFiles}
          getDecoded={getDecoded}
          decodeFile={decodeForCompare}
          highlights={highlights}
          onHighlightChange={setHighlights}
          onAddToCart={addToCart}
        />
      );
    }
    switch (activeSection) {
      case "decoded":
        return (
          <FilesPage
            file={activeFile}
            onOpenInApp={(fp) => window.electronAPI?.openFilePath(fp)}
            highlights={highlights}
            onHighlightChange={setHighlights}
            loading={loadingPaths.has(activeTab)}
            hiddenSegments={hiddenSegments}
            onAddToCart={(file) => addToCart(file, null, null, null)}
          />
        );
      case "pdfTools":  return <PDFTools />;
      case "guide":     return <GuidePage />;
      case "cifpReader": return (
        <CIFP
          onAddToCart={(file) => addToCart(file, null, null, null)}
          highlights={highlights}
          onHighlightChange={setHighlights}
        />
      );
      case "report":   return <Report />;
      case "settings": return (
        <SettingsPage
          filePath={filePath} folderPath={folderPath}
          watching={watching} scanning={scanning}
          onBrowse={handleBrowse} onFileBrowse={handleFileBrowse}
          onStart={handleStart} onStop={handleStop}
          tabCount={tabs.filter((t) => t.type === "decoded").length}
          maxTabs={store.maxTabs} onMaxTabsChange={store.setMaxTabs}
          onCloseAllTabs={closeAllTabs}
          autoOpenExternal={store.autoOpenExternal}
          onAutoOpenExternalChange={store.setAutoOpenExternal}
        />
      );
      default: return <div className="empty-state"><p>Coming soon</p></div>;
    }
  };

  return (
    <div className="app-root">
      <TitleBar watching={watching} isElectron={Boolean(window.electronAPI)} />
      <UpdateManager />
      <FileTabs
        tabs={tabs}
        activeTab={activeTab}
        onSelect={handleSelectTab}
        onClose={closeTab}
        onAdd={() => ariFiles.length === 0 ? handleBrowse() : setShowPicker(true)}
        unviewedTabs={unviewedTabs}
      />
      <div className="app-body">
        <NavRail
          activeSection={activeSection}
          onNavigate={(sec) => {
            if (sec === "compare") { addCompareTab(); return; }
            setActiveSection(sec); setActiveTab(null);
          }}
          tabCount={tabs.filter((t) => t.type === "decoded").length}
          watching={watching}
          cartCount={cartItems.length}
          onCartClick={() => setShowCart((v) => !v)}
        />

        {(activeSection === "decoded" && !activeCmpSess) && (
          <FilePanel
            ariFiles={ariFiles} scanning={scanning} folderPath={folderPath}
            onBrowse={handleBrowse} tabs={tabs.filter((t) => t.type === "decoded")}
            activeTab={activeTab} newFilePaths={newFilePaths}
            loadingPaths={loadingPaths}
            onActivateTab={(fp) => { setActiveTab(fp); setActiveSection("decoded"); setHiddenSegments(new Set()); }}
            activeFile={activeFile}
            hiddenSegments={hiddenSegments}
            onToggleSegment={(seg, hide) => {
              setHiddenSegments((prev) => { const n = new Set(prev); if (hide) n.add(seg); else n.delete(seg); return n; });
            }}
            onSelectFile={(stub) => openAndDecode(stub.path)}
          />
        )}

        <main className="app-main">{renderPage()}</main>

        {showCart && (
          <ExportCart
            items={cartItems}
            onRemove={removeFromCart}
            onClear={clearCart}
            onClose={() => setShowCart(false)}
          />
        )}
      </div>

      {showPicker && (
        <FilePickerModal
          ariFiles={ariFiles}
          openTabs={tabs.filter((t) => t.type === "decoded")}
          onSelect={(stub) => openAndDecode(stub.path)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  const store = useStore();
  if (!store.ready) return null;
  return (
    <ThemeProvider initialTheme={store.theme} onThemeChange={(t) => store.setTheme(t)}>
      <AppInner store={store} />
    </ThemeProvider>
  );
}
