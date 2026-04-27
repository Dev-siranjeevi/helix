/**
 * CompareHeaderTable — side-by-side header field diff between two procedure files.
 * Shows field-level changes between File A (old) and File B (new).
 * Supports cell highlighting via useHighlight.
 */
import { useHighlight } from "../tables/useHighlight";
import HighlightContextMenu from "../tables/HighlightContextMenu";

const FIELD_LABELS = {
  icao:"ICAO", procedureId:"Procedure ID", procedureType:"Proc Type",
  procstage:"Stage", cycle:"Cycle", gradient:"Gradient",
  variation:"Variation", sensor:"Sensor", minima:"Minima", tch:"TCH",
};

export default function CompareHeaderTable({ headerDiff, nameA, nameB, diffOnly = false, filePath, highlights, onHighlightChange, onClearAll }) {
  const rows = diffOnly ? headerDiff.filter((r) => r.diff !== "same") : headerDiff;
  const sameCount = headerDiff.filter((r) => r.diff === "same").length;
  const allKeys = headerDiff.map((r) => `chdr:${r.key}`);

  const { activeTool, menuState, onCellClick, onCellContextMenu, onCellDoubleClick,
    onSelectTool, onClearCell, getCellClass, getSymChar, getCell, closeMenu } =
    useHighlight({ filePath, highlights, onHighlightChange, onClearAll });

  const cellCls = (diff, side) => {
    const base = diff === "same" ? "diff-val--same" : diff === "changed" ? `diff-val--changed-${side}` :
                 diff === "added" ? `diff-val--added-${side}` : `diff-val--removed-${side}`;
    return `ari-td ${base}`;
  };

  return (
    <div className="table-section">
      <div className="table-section-label">Header</div>
      <div className="table-section__scroll">
        <table className="ari-table">
          <thead>
            <tr>
              <th className="ari-th">Field</th>
              <th className="ari-th diff-th--a">{nameA} (A · old)</th>
              <th className="ari-th diff-th--b">{nameB} (B · new)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ck = `chdr:${r.key}`;
              return (
                <tr key={r.key} className={`ari-tr diff-row--${r.diff}`}>
                  <td className="ari-td diff-val--same">{FIELD_LABELS[r.key] ?? r.key}</td>
                  <td className={`${cellCls(r.diff, "a")} ${getCellClass(ck+"_a","")}`}
                    data-sym={getSymChar(ck+"_a")}
                    onClick={(e) => onCellClick(e, ck+"_a", allKeys)}
                    onDoubleClick={(e) => onCellDoubleClick(e, ck+"_a")}
                    onContextMenu={(e) => onCellContextMenu(e, ck+"_a", allKeys)}>
                    {r.valueA || "—"}
                  </td>
                  <td className={`${cellCls(r.diff, "b")} ${getCellClass(ck+"_b","")}`}
                    data-sym={getSymChar(ck+"_b")}
                    onClick={(e) => onCellClick(e, ck+"_b", allKeys)}
                    onDoubleClick={(e) => onCellDoubleClick(e, ck+"_b")}
                    onContextMenu={(e) => onCellContextMenu(e, ck+"_b", allKeys)}>
                    {r.valueB || "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && diffOnly && <tr><td colSpan={3} className="ari-td diff-val--same" style={{textAlign:"center",padding:"14px"}}>No header differences</td></tr>}
          </tbody>
        </table>
      </div>
      {!diffOnly && sameCount > 0 && <div className="compare-identical-note">{sameCount} identical field{sameCount !== 1 ? "s" : ""} shown</div>}
      {menuState && <HighlightContextMenu x={menuState.x} y={menuState.y} current={getCell(menuState.cellKey)} activeTool={activeTool} onSelectTool={onSelectTool} onClearCell={onClearCell} onClearAll={onClearAll} onClose={closeMenu} />}
    </div>
  );
}
