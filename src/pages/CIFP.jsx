/**
 * CIFP.jsx — Full CIFP / ARINC 424 reader page.
 * Uses electronAPI.cifp.browse() to pick + decode via main process.
 * Also supports drag-drop (sends raw text via cifp IPC for decode).
 * Renders all tables with highlighting and export-cart support.
 */
import { useState, useCallback } from "react";
import HeaderTable    from "../components/tables/HeaderTable";
import ProcedureTable from "../components/tables/ProcedureTable";
import WaypointTable  from "../components/tables/WaypointTable";
import NavaidsTable   from "../components/tables/NavaidsTable";
import RunwayTable    from "../components/tables/RunwayTable";
import PathPointTable from "../components/tables/PathPointTable";

function buildHeader(file, proc) {
  const firstLeg = proc?.legs?.[0] ?? {};
  const cc = file.customerCode ?? "";
  return {
    procedure:    `${proc?.icao ?? ""} / ${proc?.procedureId ?? ""}${cc ? ` (${cc})` : ""}${proc?.category ? ` /${proc.category}` : ""}`,
    variation:    proc?.pdmv ?? "",
    va:           [...new Set(proc?.gradient ?? [])],
    tch:          proc?.thrHeight ?? "",
    gnssFms:      firstLeg.gnssfms || "NA",
    qualifier2:   firstLeg.minima  || "NA",
    qualifier3:   firstLeg.sensor !== "N" ? (firstLeg.sensor ?? "") : "",
    tl:           firstLeg.ta || "NA",
    dmeRequired:  firstLeg.sensor === "D" ? "Ticked" : "Not Ticked",
    count:        String(proc?.legs?.length ?? ""),
    capabilities: proc?.capabilities ?? "",
    rnpauth:      proc?.RNPAUTH ?? "",
    cycle:        proc?.cycle ?? "",
    altUnits:     "",
  };
}

function Placeholder({ onBrowse, onDragOver, onDrop, dragging }) {
  return (
    <div className={`cifp-drop ${dragging ? "cifp-drop--active" : ""}`}
      onDragOver={onDragOver} onDrop={onDrop}>
      <svg viewBox="0 0 48 48" fill="none" width="40" height="40" style={{ opacity: 0.3 }}>
        <path d="M10 6h20l12 12v24H10V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M30 6v12h12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M24 22v12M18 28l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p className="cifp-drop__text">Drop a CIFP / ARI file here</p>
      <p className="cifp-drop__sub">or</p>
      <button className="filespage__open-btn" style={{ fontSize: "var(--fs-sm)", padding: "7px 16px" }} onClick={onBrowse}>
        Browse file…
      </button>
    </div>
  );
}

function ProcSelector({ procedures, activeId, onChange }) {
  if (!procedures || procedures.length <= 1) return null;
  return (
    <div className="filespage__proc-tabs">
      {procedures.map((p) => (
        <button key={p.procedureId} onClick={() => onChange(p.procedureId)}
          className={`filespage__proc-tab ${activeId === p.procedureId ? "filespage__proc-tab--active" : "filespage__proc-tab--inactive"}`}>
          {p.procedureId}
        </button>
      ))}
    </div>
  );
}

export default function CIFP({ onAddToCart, highlights, onHighlightChange }) {
  const [fileData,     setFileData]     = useState(null);
  const [activeProcId, setActiveProcId] = useState(null);
  const [dragging,     setDragging]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const filePath = fileData?.path ?? fileData?.name ?? "cifp";

  const applyDecoded = useCallback((result) => {
    if (!result?.success) { setError(result?.error ?? "Failed to decode"); return; }
    setFileData({
      name:         result.name ?? result.filePath ?? "CIFP",
      path:         result.filePath ?? result.name ?? "cifp",
      customerCode: result.file?.customerCode ?? "",
      procedures:   result.file?.procedures  ?? [],
      waypoints:    result.file?.waypoints   ?? [],
      runways:      result.file?.runways     ?? [],
      navaids:      result.file?.navaids     ?? [],
      pathPoints:   result.file?.pathPoints  ?? [],
    });
    setActiveProcId(result.file?.procedures?.[0]?.procedureId ?? null);
    setError(null);
  }, []);

  const handleBrowse = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.cifp?.browse?.();
      if (!result) return;
      applyDecoded(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      // Read file locally then decode via IPC
      const raw = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (ev) => res(ev.target.result);
        r.onerror = rej;
        r.readAsText(file);
      });
      const result = await window.electronAPI?.cifp?.decodeRaw?.(file.name, raw);
      if (result) { applyDecoded(result); }
      else {
        // Fallback: treat as already-decoded stub
        setError("Drag-drop decode requires the desktop app. Use Browse instead.");
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [applyDecoded]);

  const handleClearAll = () =>
    onHighlightChange?.((prev) => ({ ...prev, [filePath]: {} }));

  const proc    = (fileData?.procedures ?? []).find((p) => p.procedureId === activeProcId) ?? fileData?.procedures?.[0];
  const header  = fileData && proc ? buildHeader(fileData, proc) : null;
  const hlProps = { filePath, highlights: highlights ?? {}, onHighlightChange: onHighlightChange ?? (() => {}), onClearAll: handleClearAll };

  if (loading) return <div className="filespage__empty"><p style={{ fontFamily: "Poppins", color: "var(--muted)" }}>Decoding…</p></div>;

  return (
    <div className="filespage">
      <div className="filespage__header">
        <div className="filespage__header-left">
          <span className="filespage__ari-badge">CIFP</span>
          <span className="filespage__filename">{fileData?.name ?? "CIFP Reader"}</span>
          {fileData && (
            <span className="filespage__meta" style={{ marginLeft: 8 }}>
              {fileData.procedures.length} proc · {fileData.waypoints.length} wpt · {fileData.navaids.length} nav
            </span>
          )}
        </div>
        <div className="filespage__header-right">
          {onAddToCart && fileData && (
            <button className="filespage__open-btn" onClick={() => onAddToCart(fileData)} title="Add to export cart">
              <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                <path d="M1 1h2l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6" cy="10.5" r="0.8" fill="currentColor"/>
                <circle cx="9" cy="10.5" r="0.8" fill="currentColor"/>
              </svg>
              Add to cart
            </button>
          )}
          {fileData && <button className="filespage__open-btn" onClick={handleBrowse}>Open another…</button>}
        </div>
      </div>

      {error && <div className="compare-warn-banner">⚠ {error}</div>}

      {!fileData ? (
        <Placeholder onBrowse={handleBrowse} onDragOver={handleDragOver} onDrop={handleDrop} dragging={dragging} />
      ) : (
        <>
          <ProcSelector procedures={fileData.procedures} activeId={activeProcId} onChange={setActiveProcId} />
          <div className="filespage__tableview">
            {header && <HeaderTable header={header} {...hlProps} />}
            {proc   && <ProcedureTable legs={proc.legs ?? []} hiddenSegments={new Set()} savLegs={new Set()} {...hlProps} />}
            <WaypointTable  waypoints={fileData.waypoints}  {...hlProps} />
            <NavaidsTable   navaids={fileData.navaids}      {...hlProps} />
            <RunwayTable    runways={fileData.runways}       {...hlProps} />
            <PathPointTable pathPoint={fileData.pathPoints ?? []} {...hlProps} />
          </div>
        </>
      )}
    </div>
  );
}
