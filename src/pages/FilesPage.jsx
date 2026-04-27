import { useState, useEffect } from "react";
import RawViewer from "../components/RawViewer";

// ── Eagerly imported — no lazy() to avoid Electron ERR_NETWORK_ACCESS_DENIED ─
import HeaderTable from "../components/tables/HeaderTable";
import ProcedureTable from "../components/tables/ProcedureTable";
import WaypointTable from "../components/tables/WaypointTable";
import NavaidsTable from "../components/tables/NavaidsTable";
import RunwayTable from "../components/tables/RunwayTable";
import PathPointTable from "../components/tables/PathPointTable";

// ── Empty / loading states ────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="filespage__empty">
      <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
        <path
          d="M10 6h20l12 12v24H10V6z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M30 6v12h12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M16 28h16M16 34h10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <p>Select a file from the sidebar</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="filespage__empty">
      <svg
        viewBox="0 0 48 48"
        fill="none"
        width="36"
        height="36"
        className="filespage__loading-icon"
      >
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeDasharray="30 80"
          strokeLinecap="round"
        />
      </svg>
      <p>Decoding file…</p>
    </div>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }) {
  return (
    <div className="filespage__view-toggle">
      {["table", "raw"].map((val) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`filespage__toggle-btn ${
            view === val
              ? "filespage__toggle-btn--active"
              : "filespage__toggle-btn--inactive"
          }`}
        >
          {val.charAt(0).toUpperCase() + val.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Procedure selector tabs ───────────────────────────────────────────────────
function ProcTabs({ procedures, active, onChange }) {
  if (!procedures || procedures.length <= 1) return null;
  return (
    <div className="filespage__proc-tabs">
      {procedures.map((proc) => {
        const id = proc.procedureId;
        const sel = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`filespage__proc-tab ${
              sel
                ? "filespage__proc-tab--active"
                : "filespage__proc-tab--inactive"
            }`}
          >
            {id}
          </button>
        );
      })}
    </div>
  );
}

// ── Table view — all four sections stacked ────────────────────────────────────
function TableView({
  file,
  proc,
  waypoints,
  navaids,
  runways,
  pathPoint,
  savLegs,
  savWaypoints,
  hiddenSegments = new Set(),
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  if (!proc) {
    return (
      <div className="filespage__empty">
        <p>No procedure data decoded yet</p>
      </div>
    );
  }
  const constructCustomeCode =
    file.customerCode !== "" ? ` - (${file.customerCode})` : "";
  const procedureCategory = proc.category ? ` /${proc.category}` : "";
  const firstLeg = proc.legs?.[0] ?? {};
  const header = {
    procedure: `${proc.icao ?? ""} / ${proc.procedureId ?? ""}${constructCustomeCode ?? ""} ${procedureCategory}`,
    variation: proc.pdmv ?? "",
    va: [...new Set(proc.gradient ?? [])],
    tch: proc.thrHeight ?? "",
    gnssFms: firstLeg.gnssfms == "" ? "NA" : firstLeg.gnssfms,
    qualifier2: firstLeg.minima == "" ? "NA" : firstLeg.minima,
    qualifier3: firstLeg.sensor !== "N" ? (firstLeg.sensor ?? "") : "",
    tl: firstLeg.ta == "" ? "NA" : firstLeg.ta,
    dmeRequired: firstLeg.sensor == "D" ? "Ticked" : "Not Ticked",
    count: String(proc.legs?.length ?? ""),
    capabilities: proc.capabilities ?? "",
    rnpauth: proc.RNPAUTH ?? "",
    cycle: proc.cycle ?? "",
    altUnits: "",
  };

  const hlProps = { filePath, highlights, onHighlightChange, onClearAll };

  return (
    <div className="filespage__tableview">
      <HeaderTable header={header} {...hlProps} />
      <ProcedureTable
        legs={proc.legs ?? []}
        savLegs={savLegs}
        hiddenSegments={hiddenSegments}
        {...hlProps}
      />
      <WaypointTable
        waypoints={waypoints ?? []}
        savWaypoints={savWaypoints}
        {...hlProps}
      />
      <NavaidsTable navaids={navaids ?? []} {...hlProps} />
      <RunwayTable runways={runways ?? []} {...hlProps} />
      <PathPointTable pathPoint={pathPoint ?? []} {...hlProps} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FilesPage({
  file,
  onOpenInApp,
  highlights,
  onHighlightChange,
  loading,
  hiddenSegments = new Set(),
  onAddToCart,
}) {
  const [view, setView] = useState("table");
  const [activeProcId, setActiveProcId] = useState(null);
  const [rawContent, setRawContent] = useState(null);

  // Reset all local state when file changes
  useEffect(() => {
    setActiveProcId(null);
    setRawContent(null);
    setView("table");
  }, [file?.path]);

  if (loading) return <LoadingState />;
  if (!file) return <EmptyState />;
  const procedures = file.procedures ?? [];
  const activeId = activeProcId ?? procedures[0]?.procedureId ?? null;
  const activeProc =
    procedures.find((p) => p.procedureId === activeId) ?? procedures[0] ?? null;
  const savLegs = activeProc?._savLegs ?? new Set();
  const savWaypoints = file._savWaypoints ?? new Set();
  const navaids = file.navaids ?? [];
  const runways = file.runways ?? [];
  const pathPoint = file.pathPoints ?? [];
  const raw = rawContent ?? file.raw ?? "";
  const lineCount = raw.split("\n").length;

  const handleClearAll = () =>
    onHighlightChange((prev) => ({ ...prev, [file.path]: {} }));

  return (
    <div className="filespage">
      {/* ── Header ── */}
      <div className="filespage__header">
        <div className="filespage__header-left">
          <span className="filespage__ari-badge">ARI</span>
          <span className="filespage__filename">{file.name}</span>
          {file.hasSav && <span className="filespage__sav-badge">SAV</span>}
        </div>
        <div className="filespage__header-right">
          <span className="filespage__meta">
            {procedures.length} proc · {(file.waypoints ?? []).length} wpt ·{" "}
            {navaids.length} nav · {lineCount} lines
          </span>
          {onAddToCart && (
            <button onClick={() => onAddToCart(file)} className="filespage__open-btn" title="Add to export cart">
              <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                <path d="M1 1h2l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6" cy="10.5" r="0.8" fill="currentColor"/>
                <circle cx="9" cy="10.5" r="0.8" fill="currentColor"/>
              </svg>
              Add to cart
            </button>
          )}
          {onOpenInApp && (
            <button
              onClick={() => onOpenInApp(file.path)}
              className="filespage__open-btn"
              title="Open in default application"
            >
              <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                <path
                  d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 1h3m0 0v3m0-3L5.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Open in app
            </button>
          )}
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* ── Procedure selector ── */}
      {view === "table" && (
        <ProcTabs
          procedures={procedures}
          active={activeId}
          onChange={setActiveProcId}
        />
      )}

      {/* ── Content ── */}
      {view === "raw" ? (
        <RawViewer raw={raw} filePath={file.path} onRawChange={setRawContent} />
      ) : (
        <TableView
          file={file}
          proc={activeProc}
          waypoints={file.waypoints}
          navaids={navaids}
          runways={runways}
          pathPoint={pathPoint}
          savLegs={savLegs}
          savWaypoints={savWaypoints}
          hiddenSegments={hiddenSegments}
          filePath={file.path}
          highlights={highlights}
          onHighlightChange={onHighlightChange}
          onClearAll={handleClearAll}
        />
      )}
    </div>
  );
}
