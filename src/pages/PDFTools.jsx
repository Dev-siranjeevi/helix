/**
 * PDFTools.jsx — PDF Merge, Split and Organise.
 * Features: page thumbnail previews, drag-to-reorder, custom output filenames.
 * All PDF work runs in the renderer via pdf-lib (no native deps).
 */
import { useState, useRef, useEffect } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const readFileAsBuffer = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });

const fmtSize = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

/** Sanitise a user-typed filename — strip path separators, trim, ensure .pdf */
const sanitiseName = (raw) => {
  const trimmed = raw.trim().replace(/[/\\?%*:|"<>]/g, "_");
  if (!trimmed) return "";
  return trimmed.endsWith(".pdf") ? trimmed : trimmed + ".pdf";
};

const parseRanges = (str, maxPage) => {
  const pages = new Set();
  str.split(",").forEach((part) => {
    const [a, b] = part.trim().split("-").map(Number);
    if (!a) return;
    const end = b || a;
    for (let i = Math.max(1, a); i <= Math.min(maxPage, end); i++) pages.add(i);
  });
  return [...pages].sort((a, b) => a - b);
};

const downloadBlob = async (bytes, name) => {
  if (window.electronAPI?.saveFile) {
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const result = await window.electronAPI.saveFile(name, buf);
    if (result?.success) return;
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── Page thumbnail (rendered via canvas using pdf-lib page dimensions) ────────
// We render a lightweight SVG stand-in styled like paper — real canvas thumbs
// would require pdfjs-dist which is a heavy dep. The SVG conveys page number
// and rotation clearly enough for organise workflows.
function PageThumb({ pageNum, rotation = 0, deleted = false, width = 48, height = 64 }) {
  const isLandscape = rotation === 90 || rotation === 270;
  const w = isLandscape ? height : width;
  const h = isLandscape ? width  : height;
  const fill   = deleted ? "color-mix(in srgb, var(--danger) 12%, var(--surface))" : "var(--surface2)";
  const stroke = deleted ? "var(--danger)" : "var(--border2)";
  const lineC  = deleted ? "var(--danger)"  : "var(--muted2)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w} height={h}
      style={{ display: "block", transition: "all 0.25s ease", flexShrink: 0 }}
    >
      <rect x="1" y="1" width={w - 2} height={h - 2} rx="2"
        fill={fill} stroke={stroke} strokeWidth="1.2" />
      {/* dog-ear */}
      <path d={`M${w - 10} 1 L${w - 1} 10`} stroke={stroke} strokeWidth="1.2" fill="none" />
      {/* content lines */}
      <line x1="6" y1={h * 0.38} x2={w - 6} y2={h * 0.38} stroke={lineC} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <line x1="6" y1={h * 0.50} x2={w - 6} y2={h * 0.50} stroke={lineC} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <line x1="6" y1={h * 0.62} x2={w - 10} y2={h * 0.62} stroke={lineC} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      {/* page number badge */}
      <rect x={w / 2 - 9} y={h - 14} width="18" height="11" rx="3"
        fill={deleted ? "var(--danger)" : "var(--accent)"} opacity="0.85" />
      <text x={w / 2} y={h - 6} textAnchor="middle"
        style={{ font: "bold 7px JetBrains Mono, monospace", fill: "#000" }}>
        {deleted ? "✕" : pageNum}
      </text>
    </svg>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles, multiple = true, label, sublabel }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const files = [...(e.dataTransfer?.files ?? [])].filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    if (files.length) onFiles(files);
  };
  return (
    <div
      className={`pdf-drop ${drag ? "pdf-drop--active" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf" multiple={multiple}
        style={{ display: "none" }} onChange={(e) => onFiles([...e.target.files])} />
      <svg viewBox="0 0 40 40" fill="none" width="32" height="32" style={{ opacity: 0.35 }}>
        <path d="M8 6h16l10 10v22H8V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M24 6v10h10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M20 22v8M15 26l5 4 5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="pdf-drop__label">{label ?? "Drop PDF files here"}</p>
      {sublabel && <p className="pdf-drop__sub">{sublabel}</p>}
    </div>
  );
}

// ── Filename input ────────────────────────────────────────────────────────────
function FilenameInput({ value, onChange, placeholder }) {
  return (
    <div className="pdf-filename-row">
      <label className="pdf-range-label">Output filename:</label>
      <div className="pdf-filename-wrap">
        <input
          className="pdf-range-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        {!value.endsWith(".pdf") && value.trim() && (
          <span className="pdf-filename-ext">.pdf</span>
        )}
      </div>
    </div>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ status }) {
  const colors = {
    ok:   "var(--accent)",
    warn: "var(--warn)",
    err:  "var(--danger)",
    info: "var(--muted)",
  };
  const icons = { ok: "✓", err: "✗", warn: "⚠", info: "" };
  return (
    <div className="pdf-status" style={{ borderColor: colors[status.type], color: colors[status.type] }}>
      {icons[status.type] && <span style={{ marginRight: 6 }}>{icons[status.type]}</span>}
      {status.msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MERGE TAB — draggable file list with thumbnails + custom filename
// ─────────────────────────────────────────────────────────────────────────────
function MergeTab() {
  const [files,    setFiles]    = useState([]);   // File objects
  const [status,   setStatus]   = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [outName,  setOutName]  = useState("");
  const dragSrc    = useRef(null);
  const addInputRef = useRef();

  const addFiles = (newFiles) => {
    setStatus(null);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const fresh = newFiles.filter((f) => !existing.has(f.name + f.size));
      const next = [...prev, ...fresh];
      // Auto-suggest filename from first file
      if (prev.length === 0 && fresh.length > 0 && !outName) {
        setOutName(fresh[0].name.replace(/\.pdf$/i, "") + "_merged");
      }
      return next;
    });
  };

  const remove    = (i) => setFiles((p) => p.filter((_, j) => j !== i));
  const moveUp    = (i) => setFiles((p) => { if (i === 0) return p; const n = [...p]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; });
  const moveDown  = (i) => setFiles((p) => { if (i === p.length-1) return p; const n = [...p]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; });

  // HTML5 drag-reorder — commit on drop, not on every dragOver
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const onDragStart = (e, i) => { dragSrc.current = i; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (e, i) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(i); };
  const onDragLeave = ()     => setDragOverIdx(null);
  const onDrop      = (e, i) => {
    e.preventDefault();
    const from = dragSrc.current;
    setDragOverIdx(null);
    if (from === null || from === i) return;
    setFiles((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(i, 0, item);
      return arr;
    });
    dragSrc.current = null;
  };
  const onDragEnd = () => { dragSrc.current = null; setDragOverIdx(null); };

  const merge = async () => {
    if (files.length < 2) { setStatus({ type: "warn", msg: "Add at least 2 PDF files." }); return; }
    setBusy(true); setStatus({ type: "info", msg: "Merging…" });
    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      for (const file of files) {
        const buf = await readFileAsBuffer(file);
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes    = await merged.save();
      const name     = sanitiseName(outName || files[0].name.replace(/\.pdf$/i, "") + "_merged");
      await downloadBlob(bytes, name);
      setStatus({ type: "ok", msg: `Merged ${files.length} files → ${name}` });
    } catch (e) {
      setStatus({ type: "err", msg: "Merge failed: " + e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="pdf-tab-content">
      <div className="pdf-section-label">Files to merge — drag to reorder</div>

      {files.length === 0 ? (
        <DropZone onFiles={addFiles} label="Drop PDFs here to merge"
          sublabel="Files will be combined in the order shown" />
      ) : (
        <div className="pdf-file-list">
          {files.map((f, i) => (
            <div
              key={f.name + f.size + i}
              className={`pdf-pill pdf-pill--draggable${dragOverIdx === i ? " pdf-pill--dragover" : ""}`}
              draggable
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e)  => onDragOver(e, i)}
              onDragLeave={onDragLeave}
              onDrop={(e)      => onDrop(e, i)}
              onDragEnd={onDragEnd}
            >
              {/* drag handle */}
              <span className="pdf-pill__drag" title="Drag to reorder">
                <svg viewBox="0 0 8 14" fill="none" width="8" height="14">
                  <circle cx="2.5" cy="2.5"  r="1.3" fill="currentColor"/>
                  <circle cx="5.5" cy="2.5"  r="1.3" fill="currentColor"/>
                  <circle cx="2.5" cy="7"    r="1.3" fill="currentColor"/>
                  <circle cx="5.5" cy="7"    r="1.3" fill="currentColor"/>
                  <circle cx="2.5" cy="11.5" r="1.3" fill="currentColor"/>
                  <circle cx="5.5" cy="11.5" r="1.3" fill="currentColor"/>
                </svg>
              </span>
              {/* thumbnail */}
              <div className="pdf-pill__thumb">
                <PageThumb pageNum={i + 1} width={28} height={36} />
              </div>
              {/* order arrows */}
              <div className="pdf-pill__order">
                <button className="pdf-pill__ord-btn" onClick={() => moveUp(i)}   disabled={i === 0}              title="Move up">▲</button>
                <span   className="pdf-pill__num">{i + 1}</span>
                <button className="pdf-pill__ord-btn" onClick={() => moveDown(i)} disabled={i === files.length-1} title="Move down">▼</button>
              </div>
              {/* name + size */}
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: "var(--danger)", flexShrink: 0 }}>
                <path d="M4 2h5l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 2v4h4"           stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M6 8h5M6 10.5h3"    stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <span className="pdf-pill__name" title={f.name}>{f.name}</span>
              <span className="pdf-pill__size">{fmtSize(f.size)}</span>
              <button className="icon-btn icon-btn--danger pdf-pill__remove" onClick={() => remove(i)} title="Remove">
                <svg viewBox="0 0 8 8" fill="none" width="9" height="9">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
          <button className="pdf-add-more-btn" onClick={() => addInputRef.current?.click()}>
            + Add more files
          </button>
          <input ref={addInputRef} type="file" accept=".pdf" multiple
            style={{ display: "none" }} onChange={(e) => addFiles([...e.target.files])} />
        </div>
      )}

      {files.length > 0 && (
        <>
          <FilenameInput
            value={outName}
            onChange={setOutName}
            placeholder={files[0]?.name.replace(/\.pdf$/i, "") + "_merged"}
          />
          <div className="pdf-action-row">
            <button className="pdf-clear-btn" onClick={() => { setFiles([]); setStatus(null); setOutName(""); }}>
              Clear all
            </button>
            <button className="pdf-action-btn" disabled={busy || files.length < 2} onClick={merge}>
              {busy ? "Merging…" : `Merge ${files.length} files`}
            </button>
          </div>
        </>
      )}

      {status && <StatusBar status={status} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT TAB — page preview + custom filename
// ─────────────────────────────────────────────────────────────────────────────
function SplitTab() {
  const [file,      setFile]      = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode,      setMode]      = useState("extract");
  const [range,     setRange]     = useState("");
  const [outName,   setOutName]   = useState("");
  const [status,    setStatus]    = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [preview,   setPreview]   = useState([]);   // array of page indices to preview

  const loadFile = async ([f]) => {
    if (!f) return;
    setFile(f); setStatus(null); setOutName(""); setPreview([]);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await readFileAsBuffer(f);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setPageCount(count);
      // Show first 12 pages as preview chips
      setPreview(Array.from({ length: Math.min(count, 12) }, (_, i) => i));
    } catch { setPageCount(0); }
  };

  const split = async () => {
    if (!file) return;
    setBusy(true); setStatus({ type: "info", msg: "Splitting…" });
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf      = await readFileAsBuffer(file);
      const src      = await PDFDocument.load(buf, { ignoreEncryption: true });
      const baseName = sanitiseName(outName || file.name.replace(/\.pdf$/i, "")).replace(/\.pdf$/i, "");

      if (mode === "everyPage") {
        for (let i = 0; i < src.getPageCount(); i++) {
          const doc = await PDFDocument.create();
          const [pg] = await doc.copyPages(src, [i]);
          doc.addPage(pg);
          const bytes = await doc.save();
          await downloadBlob(bytes, `${baseName}_page${i + 1}.pdf`);
        }
        setStatus({ type: "ok", msg: `Exported ${src.getPageCount()} individual pages.` });
      } else {
        const pages = parseRanges(range, pageCount);
        if (!pages.length) { setStatus({ type: "warn", msg: "No valid pages in range." }); setBusy(false); return; }
        const doc    = await PDFDocument.create();
        const copied = await doc.copyPages(src, pages.map((p) => p - 1));
        copied.forEach((p) => doc.addPage(p));
        const bytes  = await doc.save();
        const name   = `${baseName}_extract.pdf`;
        await downloadBlob(bytes, name);
        setStatus({ type: "ok", msg: `Extracted pages ${pages.join(", ")} → ${name}` });
      }
    } catch (e) {
      setStatus({ type: "err", msg: "Split failed: " + e.message });
    } finally { setBusy(false); }
  };

  // Highlight pages that fall in current range
  const rangeSet = (() => {
    if (mode !== "extract" || !range.trim()) return new Set();
    return new Set(parseRanges(range, pageCount));
  })();

  return (
    <div className="pdf-tab-content">
      <div className="pdf-section-label">Select a PDF to split</div>

      {!file ? (
        <DropZone onFiles={loadFile} multiple={false}
          label="Drop a PDF to split" sublabel="Single file only" />
      ) : (
        <>
          <div className="pdf-file-list">
            <div className="pdf-pill">
              <div className="pdf-pill__thumb"><PageThumb pageNum={1} width={28} height={36} /></div>
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: "var(--danger)", flexShrink: 0 }}>
                <path d="M4 2h5l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 2v4h4"           stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <span className="pdf-pill__name">{file.name}</span>
              <span className="pdf-pill__size">{fmtSize(file.size)}</span>
              <span className="pdf-pill__size" style={{ color: "var(--muted)" }}>{pageCount} pages</span>
              <button className="icon-btn icon-btn--danger pdf-pill__remove"
                onClick={() => { setFile(null); setPageCount(0); setPreview([]); setStatus(null); }} title="Remove">
                <svg viewBox="0 0 8 8" fill="none" width="9" height="9">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Page preview strip */}
          {preview.length > 0 && (
            <div className="pdf-preview-strip">
              <div className="pdf-section-label" style={{ marginBottom: 8 }}>
                Page preview {pageCount > 12 ? `(first 12 of ${pageCount})` : ""}
              </div>
              <div className="pdf-preview-row">
                {preview.map((idx) => {
                  const pg = idx + 1;
                  const highlighted = mode === "extract" && rangeSet.has(pg);
                  return (
                    <div key={idx}
                      className={`pdf-prev-card ${highlighted ? "pdf-prev-card--hi" : ""}`}
                      title={`Page ${pg}`}
                      onClick={() => {
                        // Toggle page into range input
                        if (mode === "extract") {
                          setRange((prev) => {
                            const parts = prev.split(",").map((s) => s.trim()).filter(Boolean);
                            const has   = parts.includes(String(pg));
                            const next  = has ? parts.filter((p) => p !== String(pg)) : [...parts, String(pg)];
                            return next.join(", ");
                          });
                        }
                      }}
                    >
                      <PageThumb pageNum={pg} width={36} height={48} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pdf-section-label" style={{ marginTop: 8 }}>Split mode</div>
          <div className="pdf-mode-row">
            {[["extract","Extract page range"],["everyPage","Split every page"]].map(([v, l]) => (
              <label key={v} className={`pdf-mode-opt ${mode===v ? "pdf-mode-opt--active" : ""}`}>
                <input type="radio" name="split-mode" value={v} checked={mode===v}
                  onChange={() => setMode(v)} style={{ display: "none" }}/>
                {l}
              </label>
            ))}
          </div>

          {mode === "extract" && (
            <div className="pdf-range-row">
              <label className="pdf-range-label">Pages (e.g. 1,3-5,7):</label>
              <input className="pdf-range-input" value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder={`1-${pageCount}`} />
            </div>
          )}

          <FilenameInput
            value={outName}
            onChange={setOutName}
            placeholder={file.name.replace(/\.pdf$/i, "") + (mode === "everyPage" ? "_page1…" : "_extract")}
          />

          <div className="pdf-action-row">
            <button className="pdf-action-btn" disabled={busy} onClick={split}>
              {busy ? "Splitting…" : mode === "everyPage" ? "Split every page" : "Extract pages"}
            </button>
          </div>
        </>
      )}

      {status && <StatusBar status={status} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORGANISE TAB — visual thumbnail grid with drag-reorder, rotate, delete
// ─────────────────────────────────────────────────────────────────────────────
function OrganiseTab() {
  const [pages,   setPages]   = useState([]); // {id, index, rotation, deleted}
  const [file,    setFile]    = useState(null);
  const [outName, setOutName] = useState("");
  const [status,  setStatus]  = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const dragSrc    = useRef(null);   // index of the card being dragged
  const dragTarget = useRef(null);   // index of the card currently hovered

  const loadFile = async ([f]) => {
    if (!f) return;
    setFile(f); setStatus({ type: "info", msg: "Loading pages…" });
    setOutName(f.name.replace(/\.pdf$/i, "") + "_organised");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf   = await readFileAsBuffer(f);
      const doc   = await PDFDocument.load(buf, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setPages(Array.from({ length: count }, (_, i) => ({ id: i, index: i, rotation: 0, deleted: false })));
      setStatus(null);
    } catch (e) { setStatus({ type: "err", msg: "Failed to load: " + e.message }); }
  };

  const rotate     = (id) => setPages((p) => p.map((pg) => pg.id===id ? {...pg, rotation:(pg.rotation+90)%360}  : pg));
  const rotateCCW  = (id) => setPages((p) => p.map((pg) => pg.id===id ? {...pg, rotation:(pg.rotation+270)%360} : pg));
  const toggleDel  = (id) => setPages((p) => p.map((pg) => pg.id===id ? {...pg, deleted:!pg.deleted} : pg));
  const restoreAll = ()   => setPages((p) => p.map((pg) => ({...pg, deleted:false})));

  const movePageUp   = (i) => setPages((p) => { if (i === 0) return p; const n = [...p]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; });
  const movePageDown = (i) => setPages((p) => { if (i === p.length-1) return p; const n = [...p]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; });

  // ── Drag handlers ─────────────────────────────────────────────────────────
  // Strategy: record src on dragStart, highlight target on dragOver,
  // commit the reorder only on drop. This avoids the thrashing caused by
  // splicing the array on every mousemove during dragOver.
  const handleDragStart = (e, i) => {
    dragSrc.current    = i;
    dragTarget.current = i;
    e.dataTransfer.effectAllowed = "move";
    // Ghost image: slightly transparent
    e.dataTransfer.setDragImage(e.currentTarget, 30, 40);
  };

  const handleDragOver = (e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragTarget.current = i;
    setDragOver(i);
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = (e, i) => {
    e.preventDefault();
    const from = dragSrc.current;
    const to   = i;  // use the drop target index directly — dragTarget.current can lag
    if (from === null || from === to) {
      dragSrc.current    = null;
      dragTarget.current = null;
      setDragOver(null);
      return;
    }
    setPages((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    dragSrc.current    = null;
    dragTarget.current = null;
    setDragOver(null);
  };

  const handleDragEnd = () => {
    dragSrc.current    = null;
    dragTarget.current = null;
    setDragOver(null);
  };

  const save = async () => {
    if (!file) return;
    const active = pages.filter((p) => !p.deleted);
    if (!active.length) { setStatus({ type: "warn", msg: "All pages removed — nothing to save." }); return; }
    setBusy(true); setStatus({ type: "info", msg: "Saving…" });
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const buf     = await readFileAsBuffer(file);
      const src     = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out     = await PDFDocument.create();
      const indices = active.map((p) => p.index);
      const copied  = await out.copyPages(src, indices);
      active.forEach((p, i) => {
        const pg = copied[i];
        if (p.rotation) pg.setRotation(degrees(p.rotation));
        out.addPage(pg);
      });
      const bytes = await out.save();
      const name  = sanitiseName(outName || file.name.replace(/\.pdf$/i, "") + "_organised");
      await downloadBlob(bytes, name);
      setStatus({ type: "ok", msg: `Saved ${active.length} pages → ${name}` });
    } catch (e) {
      setStatus({ type: "err", msg: "Save failed: " + e.message });
    } finally { setBusy(false); }
  };

  const activeCount  = pages.filter((p) => !p.deleted).length;
  const deletedCount = pages.filter((p) =>  p.deleted).length;

  return (
    <div className="pdf-tab-content">
      <div className="pdf-section-label">Load a PDF to organise pages</div>

      {!file ? (
        <DropZone onFiles={loadFile} multiple={false}
          label="Drop a PDF to organise"
          sublabel="◀ ▶ to move pages · ↻ to rotate · ✕ to remove · or drag thumbnails" />
      ) : (
        <>
          {/* file meta bar */}
          <div className="pdf-org-meta">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: "var(--danger)", flexShrink: 0 }}>
              <path d="M4 2h5l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M9 2v4h4"           stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <span className="pdf-pill__name" style={{ flex: 1 }}>{file.name}</span>
            <span className="pdf-org-stat">
              {activeCount} active{deletedCount > 0 ? ` · ${deletedCount} removed` : ""}
            </span>
            {deletedCount > 0 && (
              <button className="pdf-add-more-btn" onClick={restoreAll}>Restore all</button>
            )}
            <button className="pdf-clear-btn"
              onClick={() => { setFile(null); setPages([]); setStatus(null); setOutName(""); }}>
              Change file
            </button>
          </div>

          {/* thumbnail grid */}
          <div className="pdf-page-grid">
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                className={`pdf-page-card
                  ${pg.deleted ? "pdf-page-card--deleted" : ""}
                  ${dragOver === i ? "pdf-page-card--dragover" : ""}`}
                draggable={!pg.deleted}
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e)  => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={(e)      => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
              >
                <div className="pdf-page-thumb"
                  style={{ transform: `rotate(${pg.rotation}deg)` }}>
                  <PageThumb pageNum={i + 1} rotation={pg.rotation} deleted={pg.deleted} />
                </div>
                <div className="pdf-page-num">{pg.deleted ? "removed" : `p. ${i + 1}`}</div>
                <div className="pdf-page-actions">
                  <button className="pdf-pg-btn pdf-pg-btn--move" onClick={() => movePageUp(i)}
                    title="Move left" disabled={pg.deleted || i === 0}>◀</button>
                  <button className="pdf-pg-btn pdf-pg-btn--move" onClick={() => movePageDown(i)}
                    title="Move right" disabled={pg.deleted || i === pages.length - 1}>▶</button>
                  <button className="pdf-pg-btn" onClick={() => rotateCCW(pg.id)}
                    title="Rotate CCW" disabled={pg.deleted}>↺</button>
                  <button className="pdf-pg-btn" onClick={() => rotate(pg.id)}
                    title="Rotate CW" disabled={pg.deleted}>↻</button>
                  <button className={`pdf-pg-btn ${pg.deleted ? "pdf-pg-btn--restore" : "pdf-pg-btn--del"}`}
                    onClick={() => toggleDel(pg.id)} title={pg.deleted ? "Restore" : "Remove"}>
                    {pg.deleted ? "↩" : "✕"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <FilenameInput
            value={outName}
            onChange={setOutName}
            placeholder={file.name.replace(/\.pdf$/i, "") + "_organised"}
          />

          <div className="pdf-action-row">
            <button className="pdf-action-btn" disabled={busy || !activeCount} onClick={save}>
              {busy ? "Saving…" : `Save organised PDF (${activeCount} pages)`}
            </button>
          </div>
        </>
      )}

      {status && <StatusBar status={status} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ROTATE TAB — rotate all/specific pages by 90/180/270°
// ─────────────────────────────────────────────────────────────────────────────
function RotateTab() {
  const [file,      setFile]      = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [angle,     setAngle]     = useState(90);
  const [range,     setRange]     = useState("");
  const [outName,   setOutName]   = useState("");
  const [status,    setStatus]    = useState(null);
  const [busy,      setBusy]      = useState(false);

  const loadFile = async ([f]) => {
    if (!f) return;
    setFile(f); setStatus(null); setOutName("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await readFileAsBuffer(f);
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
    } catch { setPageCount(0); }
  };

  const rotate = async () => {
    if (!file) return;
    setBusy(true); setStatus({ type: "info", msg: "Rotating…" });
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const buf  = await readFileAsBuffer(file);
      const doc  = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = range.trim()
        ? parseRanges(range, pageCount).map((p) => p - 1)
        : Array.from({ length: doc.getPageCount() }, (_, i) => i);
      if (!pages.length) { setStatus({ type: "warn", msg: "No valid pages." }); setBusy(false); return; }
      pages.forEach((idx) => {
        const pg = doc.getPage(idx);
        const cur = pg.getRotation().angle;
        pg.setRotation(degrees((cur + angle) % 360));
      });
      const bytes = await doc.save();
      const name  = sanitiseName(outName || file.name.replace(/\.pdf$/i, "") + `_rot${angle}`);
      await downloadBlob(bytes, name);
      setStatus({ type: "ok", msg: `Rotated ${pages.length} page(s) by ${angle}° → ${name}` });
    } catch (e) {
      setStatus({ type: "err", msg: "Rotate failed: " + e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="pdf-tab-content">
      <div className="pdf-section-label">Rotate PDF pages</div>
      {!file ? (
        <DropZone onFiles={loadFile} multiple={false} label="Drop a PDF to rotate" sublabel="Rotate all or specific pages" />
      ) : (
        <>
          <div className="pdf-file-list">
            <div className="pdf-pill">
              <div className="pdf-pill__thumb"><PageThumb pageNum={1} width={28} height={36} /></div>
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: "var(--danger)", flexShrink: 0 }}>
                <path d="M4 2h5l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <span className="pdf-pill__name">{file.name}</span>
              <span className="pdf-pill__size">{fmtSize(file.size)}</span>
              <span className="pdf-pill__size" style={{ color: "var(--muted)" }}>{pageCount} pages</span>
              <button className="icon-btn icon-btn--danger pdf-pill__remove"
                onClick={() => { setFile(null); setPageCount(0); setStatus(null); }} title="Remove">
                <svg viewBox="0 0 8 8" fill="none" width="9" height="9">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="pdf-section-label" style={{ marginTop: 8 }}>Rotation angle</div>
          <div className="pdf-mode-row">
            {[90, 180, 270].map((deg) => (
              <label key={deg} className={`pdf-mode-opt ${angle === deg ? "pdf-mode-opt--active" : ""}`}>
                <input type="radio" name="rot-angle" value={deg} checked={angle === deg}
                  onChange={() => setAngle(deg)} style={{ display: "none" }}/>
                {deg === 90 ? "↻ 90° CW" : deg === 180 ? "↕ 180°" : "↺ 90° CCW"}
              </label>
            ))}
          </div>

          <div className="pdf-range-row">
            <label className="pdf-range-label">Pages (blank = all):</label>
            <input className="pdf-range-input" value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder={`1-${pageCount} (leave blank for all)`} />
          </div>

          <FilenameInput value={outName} onChange={setOutName}
            placeholder={file.name.replace(/\.pdf$/i, "") + `_rot${angle}`} />

          <div className="pdf-action-row">
            <button className="pdf-clear-btn" onClick={() => { setFile(null); setPageCount(0); setStatus(null); setOutName(""); }}>
              Clear
            </button>
            <button className="pdf-action-btn" disabled={busy} onClick={rotate}>
              {busy ? "Rotating…" : `Rotate pages`}
            </button>
          </div>
        </>
      )}
      {status && <StatusBar status={status} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESS TAB — strips metadata, re-saves without redundant cross-refs (lossless)
// ─────────────────────────────────────────────────────────────────────────────
function CompressTab() {
  const [files,   setFiles]   = useState([]);
  const [status,  setStatus]  = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [results, setResults] = useState([]);

  const addFiles = (newFiles) => {
    setStatus(null); setResults([]);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...newFiles.filter((f) => !existing.has(f.name + f.size))];
    });
  };

  const compress = async () => {
    if (!files.length) return;
    setBusy(true); setStatus({ type: "info", msg: `Optimising ${files.length} file(s)…` });
    const log = [];
    try {
      const { PDFDocument } = await import("pdf-lib");
      for (const file of files) {
        const buf  = await readFileAsBuffer(file);
        const doc  = await PDFDocument.load(buf, { ignoreEncryption: true });
        // Remove all metadata to trim bloat
        doc.setTitle(""); doc.setAuthor(""); doc.setSubject("");
        doc.setKeywords([]); doc.setProducer(""); doc.setCreator("");
        const bytes    = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        const ratio    = ((1 - bytes.byteLength / buf.byteLength) * 100).toFixed(1);
        const name     = file.name.replace(/\.pdf$/i, "_compressed.pdf");
        await downloadBlob(bytes, name);
        log.push({ name: file.name, before: buf.byteLength, after: bytes.byteLength, ratio });
      }
      setResults(log);
      setStatus({ type: "ok", msg: `Done — ${log.length} file(s) optimised.` });
    } catch (e) {
      setStatus({ type: "err", msg: "Compress failed: " + e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="pdf-tab-content">
      <div className="pdf-section-label">Optimise / Compress PDFs</div>
      <p style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 8 }}>
        Lossless optimisation — strips embedded metadata, linearises object streams.
        No image quality is reduced.
      </p>

      {files.length === 0 ? (
        <DropZone onFiles={addFiles} label="Drop PDFs to compress" sublabel="Multiple files supported" />
      ) : (
        <div className="pdf-file-list">
          {files.map((f, i) => (
            <div key={f.name + i} className="pdf-pill">
              <div className="pdf-pill__thumb"><PageThumb pageNum={i + 1} width={28} height={36} /></div>
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: "var(--danger)", flexShrink: 0 }}>
                <path d="M4 2h5l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <span className="pdf-pill__name" title={f.name}>{f.name}</span>
              <span className="pdf-pill__size">{fmtSize(f.size)}</span>
              {results.find((r) => r.name === f.name) && (
                <span className="pdf-pill__size" style={{ color: "var(--accent)" }}>
                  {results.find((r) => r.name === f.name).ratio}% saved
                </span>
              )}
              <button className="icon-btn icon-btn--danger pdf-pill__remove"
                onClick={() => { setFiles((p) => p.filter((_, j) => j !== i)); setResults([]); }} title="Remove">
                <svg viewBox="0 0 8 8" fill="none" width="9" height="9">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
          <button className="pdf-add-more-btn" onClick={() => {
            const inp = document.createElement("input");
            inp.type = "file"; inp.accept = ".pdf"; inp.multiple = true;
            inp.onchange = (e) => addFiles([...e.target.files]);
            inp.click();
          }}>+ Add more files</button>
        </div>
      )}

      {files.length > 0 && (
        <div className="pdf-action-row">
          <button className="pdf-clear-btn" onClick={() => { setFiles([]); setStatus(null); setResults([]); }}>Clear all</button>
          <button className="pdf-action-btn" disabled={busy || !files.length} onClick={compress}>
            {busy ? "Optimising…" : `Optimise ${files.length} file(s)`}
          </button>
        </div>
      )}

      {status && <StatusBar status={status} />}
    </div>
  );
}

const TABS = [
  { id: "merge",    label: "Merge",    icon: "⊕" },
  { id: "split",    label: "Split",    icon: "⌿" },
  { id: "organise", label: "Organise", icon: "⊞" },
  { id: "rotate",   label: "Rotate",   icon: "↻" },
  { id: "compress", label: "Compress", icon: "⊘" },
];

export default function PDFTools() {
  const [activeTab,  setActiveTab]  = useState("merge");
  const [outputDir,  setOutputDir]  = useState(null);
  const [dirLoading, setDirLoading] = useState(false);

  // Load remembered output dir on mount — useEffect, NOT useState
  useEffect(() => {
    window.electronAPI?.pdf?.getOutputDir?.().then((dir) => {
      if (dir) setOutputDir(dir);
    });
  }, []);

  const handleChooseDir = async () => {
    setDirLoading(true);
    try {
      const result = await window.electronAPI?.pdf?.chooseOutputDir?.();
      if (result?.success) setOutputDir(result.dir);
    } finally {
      setDirLoading(false);
    }
  };

  const dirLabel = outputDir
    ? outputDir.replace(/\\/g, "/").split("/").filter(Boolean).pop()
    : "Not set — will prompt on first export";

  return (
    <div className="filespage">
      <div className="filespage__header">
        <div className="filespage__header-left">
          <span className="filespage__ari-badge" style={{
            background:   "color-mix(in srgb, var(--danger) 15%, transparent)",
            color:        "var(--danger)",
            borderColor:  "color-mix(in srgb, var(--danger) 25%, transparent)",
          }}>PDF</span>
          <span className="filespage__filename">PDF Tools</span>
        </div>
        <div className="filespage__header-right">
          <span className="filespage__meta" title={outputDir ?? ""}>
            Output: <strong>{dirLabel}</strong>
          </span>
          <button className="filespage__open-btn" onClick={handleChooseDir}
            disabled={dirLoading} title="Change output folder">
            {dirLoading ? "…" : "Change folder"}
          </button>
        </div>
      </div>

      <div className="pdf-tools-tabs">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`pdf-tools-tab ${activeTab===t.id ? "pdf-tools-tab--active" : "pdf-tools-tab--inactive"}`}>
            <span className="pdf-tools-tab__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "merge"    && <MergeTab />}
      {activeTab === "split"    && <SplitTab />}
      {activeTab === "organise" && <OrganiseTab />}
      {activeTab === "rotate"   && <RotateTab />}
      {activeTab === "compress" && <CompressTab />}
    </div>
  );
}
