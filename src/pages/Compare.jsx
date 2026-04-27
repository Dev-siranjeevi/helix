/**
 * Compare.jsx — diff view that mirrors the decoded FilesPage exactly.
 *
 * Design:
 *  - ALL rows shown by default (same + diff). User toggles to "diff only".
 *  - Highlighting works identically to the decoded view (same hook, same context menu).
 *  - Layout: header bar → file pickers → summary strip → section tables.
 *  - Section tables use identical .table-section / .ari-table structure as decoded.
 */
import { useState, useMemo } from "react";
import { buildDiff, validateForCompare } from "../../electron/processors/diffEngine";
import CompareLegTable      from "../components/compare/CompareLegTable";
import CompareWaypointTable from "../components/compare/CompareWaypointTable";
import CompareNavaidsTable  from "../components/compare/CompareNavaidsTable";
import CompareMinimaTable   from "../components/compare/CompareMinimaTable";
import CompareHeaderTable   from "../components/compare/CompareHeaderTable";
import CompareSummary       from "../components/compare/CompareSummary";
import CompareRawDiff       from "../components/compare/CompareRawDiff";

// ── View-mode pill toggle ─────────────────────────────────────────────────────
function ViewToggle({ diffOnly, onChange }) {
  return (
    <div className="compare-view-toggle">
      <button
        className={`compare-view-toggle__btn ${!diffOnly ? "compare-view-toggle__btn--active" : ""}`}
        onClick={() => onChange(false)}
        title="Show all rows (identical + changed)"
      >All</button>
      <button
        className={`compare-view-toggle__btn ${diffOnly ? "compare-view-toggle__btn--active" : ""}`}
        onClick={() => onChange(true)}
        title="Show only changed / added / removed rows"
      >Diff only</button>
    </div>
  );
}

// ── Procedure tabs ────────────────────────────────────────────────────────────
function ProcTabs({ procs, active, onSelect, mod }) {
  if (!procs || procs.length <= 1) return null;
  const accent = mod === "a" ? "var(--accent2)" : "var(--accent)";
  return (
    <div className="filespage__proc-tabs" style={{ marginTop: 4 }}>
      {procs.map((p) => (
        <button key={p.procedureId} onClick={() => onSelect(p.procedureId)}
          className={`filespage__proc-tab ${active === p.procedureId ? "filespage__proc-tab--active" : "filespage__proc-tab--inactive"}`}
          style={active === p.procedureId ? { borderColor: accent, color: accent } : {}}>
          {p.procedureId}
        </button>
      ))}
    </div>
  );
}

// ── Transition tabs ───────────────────────────────────────────────────────────
function TransTabs({ procs, procId, transId, onSelect, mod }) {
  const proc = (procs ?? []).find((p) => p.procedureId === procId) ?? procs?.[0];
  const transitions = [...new Set((proc?.legs ?? []).map((l) => l.transitionid).filter(Boolean))];
  if (!transitions.length) return null;
  const accent = mod === "a" ? "var(--accent2)" : "var(--accent)";
  return (
    <div className="filespage__proc-tabs" style={{ marginTop: 4 }}>
      <button onClick={() => onSelect(null)}
        className={`filespage__proc-tab ${!transId ? "filespage__proc-tab--active" : "filespage__proc-tab--inactive"}`}
        style={!transId ? { borderColor: accent, color: accent } : {}}>All</button>
      {transitions.map((t) => (
        <button key={t} onClick={() => onSelect(t)}
          className={`filespage__proc-tab ${transId === t ? "filespage__proc-tab--active" : "filespage__proc-tab--inactive"}`}
          style={transId === t ? { borderColor: accent, color: accent } : {}}>{t}</button>
      ))}
    </div>
  );
}

// ── File slot ─────────────────────────────────────────────────────────────────
function FileSlot({ label, mod, ariFiles, otherPath, fileObj, procId, transId, onFile, onProc, onTrans, loading }) {
  const available = ariFiles.filter((f) => f.path !== otherPath);
  return (
    <div className="compare-picker__slot">
      <span className={`compare-picker__label compare-picker__label--${mod}`}>{label}</span>
      <select value={fileObj?.path ?? ""} onChange={(e) => onFile(e.target.value || null)}
        className="compare-picker__select" title={fileObj?.name ?? ""}>
        <option value="">Select a file…</option>
        {available.map((f) => <option key={f.path} value={f.path} title={f.name}>{f.name}</option>)}
      </select>
      {loading && <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: 4 }}>Decoding…</span>}
      <ProcTabs  procs={fileObj?.procedures} active={procId}  onSelect={onProc}  mod={mod} />
      <TransTabs procs={fileObj?.procedures} procId={procId} transId={transId} onSelect={onTrans} mod={mod} />
    </div>
  );
}

// ── Validation banner ─────────────────────────────────────────────────────────
function ValidationBanner({ fileObjA, fileObjB, procIdA, procIdB }) {
  const procA = (fileObjA?.procedures ?? []).find((p) => p.procedureId === procIdA) ?? fileObjA?.procedures?.[0];
  const procB = (fileObjB?.procedures ?? []).find((p) => p.procedureId === procIdB) ?? fileObjB?.procedures?.[0];
  if (!procA || !procB) return null;
  const { ok, reasons } = validateForCompare(procA, procB);
  if (ok) return null;
  return <div className="compare-warn-banner">⚠ {reasons.join(" · ")} — diff may not be meaningful</div>;
}

// ── Main Compare view ─────────────────────────────────────────────────────────
export default function Compare({
  session, ariFiles, getDecoded, decodeFile,
  highlights, onHighlightChange, onAddToCart,
}) {
  const { fileA, fileB, procIdA, procIdB, transA, transB, id: sessionId } = session;
  const [diffOnly, setDiffOnly] = useState(false);

  const fileObjA = getDecoded(fileA);
  const fileObjB = getDecoded(fileB);

  const diff = useMemo(
    () => fileObjA && fileObjB ? buildDiff(fileObjA, fileObjB, procIdA, procIdB, transA, transB) : null,
    [fileObjA, fileObjB, procIdA, procIdB, transA, transB],
  );

  const hlProps = {
    filePath: sessionId,
    highlights,
    onHighlightChange,
    onClearAll: () => onHighlightChange((prev) => ({ ...prev, [sessionId]: {} })),
  };

  const nameA  = fileObjA?.name ?? "File A";
  const nameB  = fileObjB?.name ?? "File B";
  const titleA = procIdA ?? nameA;
  const titleB = procIdB ?? nameB;

  const handleFile = (slot, path) => {
    session._onChange?.(slot === "A"
      ? { fileA: path, procIdA: path ? getDecoded(path)?.procedures?.[0]?.procedureId ?? null : null, transA: null }
      : { fileB: path, procIdB: path ? getDecoded(path)?.procedures?.[0]?.procedureId ?? null : null, transB: null });
    if (path && !getDecoded(path)) decodeFile(path);
  };

  // Total delta count for the header pill
  const totalDelta = diff
    ? Object.values(diff.summary).reduce((sum, s) => sum + (s.changed ?? 0) + (s.added ?? 0) + (s.removed ?? 0), 0)
    : 0;

  return (
    <div className="filespage">

      {/* ── Header bar — identical structure to decoded FilesPage ── */}
      <div className="filespage__header">
        <div className="filespage__header-left">
          <span className="filetabs__cmp-icon" style={{ fontSize: 15, marginRight: 6, color: "var(--muted)" }}>↔</span>
          <span className="filespage__filename">Compare</span>
          {diff && (
            <span className="filespage__sav-badge" style={{
              background: totalDelta > 0
                ? "color-mix(in srgb, var(--warn) 12%, transparent)"
                : "color-mix(in srgb, var(--accent) 10%, transparent)",
              color: totalDelta > 0 ? "var(--warn)" : "var(--accent)",
              borderColor: totalDelta > 0
                ? "color-mix(in srgb, var(--warn) 22%, transparent)"
                : "color-mix(in srgb, var(--accent) 20%, transparent)",
            }}>
              {totalDelta > 0 ? `${totalDelta} Δ` : "identical"}
            </span>
          )}
          {fileObjA && fileObjB && (
            <span className="filespage__filename" style={{ marginLeft: 6, fontSize: "var(--fs-xs)", color: "var(--muted)", fontWeight: 400 }}>
              {titleA} ↔ {titleB}
            </span>
          )}
        </div>
        <div className="filespage__header-right">
          {diff && <ViewToggle diffOnly={diffOnly} onChange={setDiffOnly} />}
          {onAddToCart && diff && (
            <button className="filespage__open-btn" onClick={() => onAddToCart(session, diff, nameA, nameB)} title="Add to export cart">
              <svg viewBox="0 0 12 12" fill="none" width="11" height="11">
                <path d="M1 1h2l1.5 6h5l1-4H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6" cy="10.5" r="0.8" fill="currentColor"/>
                <circle cx="9" cy="10.5" r="0.8" fill="currentColor"/>
              </svg>
              Cart
            </button>
          )}
        </div>
      </div>

      {/* ── File pickers ── */}
      <div className="compare-picker">
        <FileSlot label="File A — Base (older)" mod="a" ariFiles={ariFiles} otherPath={fileB}
          fileObj={fileObjA} procId={procIdA} transId={transA}
          onFile={(p) => handleFile("A", p)}
          onProc={(id) => session._onChange?.({ procIdA: id, transA: null })}
          onTrans={(t) => session._onChange?.({ transA: t })}
          loading={fileA && !fileObjA} />
        <span className="compare-picker__sep">↔</span>
        <FileSlot label="File B — Compare (newer)" mod="b" ariFiles={ariFiles} otherPath={fileA}
          fileObj={fileObjB} procId={procIdB} transId={transB}
          onFile={(p) => handleFile("B", p)}
          onProc={(id) => session._onChange?.({ procIdB: id, transB: null })}
          onTrans={(t) => session._onChange?.({ transB: t })}
          loading={fileB && !fileObjB} />
      </div>

      {fileObjA && fileObjB && (
        <ValidationBanner fileObjA={fileObjA} fileObjB={fileObjB} procIdA={procIdA} procIdB={procIdB} />
      )}

      {(!fileObjA || !fileObjB) && (
        <div className="compare-empty" style={{ flex: 1 }}>
          <span className="compare-empty__icon">↔</span>
          <p className="compare-empty__text">
            {ariFiles.length === 0
              ? "No files loaded — open a folder from the Files page first"
              : "Select two files above to compare"}
          </p>
        </div>
      )}

      {diff && (
        <>
          <CompareSummary summary={diff.summary} />

          {/* ── Table sections — same structure as decoded FilesPage ── */}
          <div className="filespage__tableview">
            <CompareHeaderTable
              headerDiff={diff.headerDiff}
              nameA={nameA} nameB={nameB}
              diffOnly={diffOnly}
              {...hlProps}
            />
            <CompareLegTable
              legDiff={diff.legDiff}
              nameA={nameA} nameB={nameB}
              diffOnly={diffOnly}
              {...hlProps}
            />
            <CompareWaypointTable
              waypointDiff={diff.waypointDiff}
              nameA={nameA} nameB={nameB}
              diffOnly={diffOnly}
              {...hlProps}
            />
            <CompareNavaidsTable
              navaidDiff={diff.navaidDiff}
              nameA={nameA} nameB={nameB}
              diffOnly={diffOnly}
              {...hlProps}
            />
            {diff.minimaDiff?.length > 0 && (
              <CompareMinimaTable
                minimaDiff={diff.minimaDiff}
                nameA={nameA} nameB={nameB}
                diffOnly={diffOnly}
                {...hlProps}
              />
            )}
            {diff.rawDiff?.length > 0 && (
              <div className="table-section">
                <div className="table-section-label">Raw Line Diff</div>
                <CompareRawDiff rawDiff={diff.rawDiff} diffOnly={diffOnly} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
