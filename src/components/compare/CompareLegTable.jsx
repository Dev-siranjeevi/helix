/**
 * CompareLegTable — transition-aware leg diff with highlighting support.
 * Changed fields: new value stacked above old (struck through).
 */
import { useHighlight } from "../tables/useHighlight";
import HighlightContextMenu from "../tables/HighlightContextMenu";

const COLS = [
  { key: "legtype",        label: "Path"   },
  { key: "fixattr",        label: "Attr"   },
  { key: "comp",           label: "Comp"   },
  { key: "flyover",        label: "FO"     },
  { key: "category",       label: "CAT"    },
  { key: "rnp",            label: "RNP"    },
  { key: "waypoint",       label: "Fix"    },
  { key: "altitude",       label: "Alt"    },
  { key: "speed",          label: "Spd"    },
  { key: "crsmag",         label: "Crs"    },
  { key: "turndirections", label: "Turn"   },
  { key: "distance",       label: "Dist"   },
  { key: "recomnavaid",    label: "Recom"  },
  { key: "theta",          label: "θ"      },
  { key: "rho",            label: "ρ"      },
  { key: "gnssfms",        label: "GNSS"   },
  { key: "sensor",         label: "Sensor" },
  { key: "minima",         label: "Min"    },
];

function FieldCell({ leg, fieldKey, rowStatus, cellKey, getCellClass, getSymChar, onCellClick, onCellContextMenu, onCellDoubleClick, allKeys }) {
  const field = leg[fieldKey];
  const baseClass = rowStatus === "added" ? "diff-cell--added" :
                    rowStatus === "removed" ? "diff-cell--removed" : "";
  const hlClass = getCellClass(cellKey, baseClass || "ari-td");
  const val = (field && typeof field === "object") ? field.value : String(field ?? "");
  const oldVal = (field && typeof field === "object") ? field.oldValue : "";
  const isChanged = field?.diff === "changed";

  return (
    <td className={`ari-td ${hlClass}`} data-sym={getSymChar(cellKey)}
      onClick={(e) => onCellClick(e, cellKey, allKeys)}
      onDoubleClick={(e) => onCellDoubleClick(e, cellKey)}
      onContextMenu={(e) => onCellContextMenu(e, cellKey, allKeys)}>
      {isChanged ? (
        <>
          <span className="diff-stack__new">{val || "—"}</span>
          <span className="diff-stack__old">{oldVal || "—"}</span>
        </>
      ) : (val || "")}
    </td>
  );
}

export default function CompareLegTable({ legDiff, nameA, nameB, diffOnly = false, filePath, highlights, onHighlightChange, onClearAll }) {
  const { activeTool, menuState, onCellClick, onCellContextMenu, onCellDoubleClick,
    onSelectTool, onClearCell, getCellClass, getSymChar, getCell, closeMenu } =
    useHighlight({ filePath, highlights, onHighlightChange, onClearAll });

  const diffLegs = legDiff.filter((l) => (l._diff ?? "same") !== "same");
  const sameLegs = legDiff.filter((l) => (l._diff ?? "same") === "same");

  // Default: show ALL rows. When diffOnly=true, hide identical rows.
  const rows = diffOnly ? diffLegs : legDiff;

  const allKeys = rows.flatMap((leg, i) => {
    const base = `${leg._transId ?? leg.transitionid ?? ""}:${leg.legnumber ?? ""}:${i}`;
    return COLS.map((c) => `cleg:${base}.${c.key}`);
  });

  return (
    <div className="table-section">
      <div className="table-section-label">Procedure Legs
        <span style={{ fontWeight: "normal", fontSize: "var(--fs-xs)", color: "var(--muted)", marginLeft: 8 }}>
          Changed cells: <span className="diff-stack__new" style={{display:"inline"}}>new (B)</span> / <span className="diff-stack__old" style={{display:"inline",fontSize:"inherit"}}>old (A)</span>
        </span>
      </div>
      <div className="table-section__scroll">
        <table className="ari-table ari-table--fixed">
          <thead>
            <tr>
              <th className="ari-th" style={{ minWidth: 40 }}>Seq</th>
              <th className="ari-th" style={{ minWidth: 60 }}>Trans</th>
              {COLS.map((c) => <th key={c.key} className="ari-th">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((leg, i) => {
              const status = leg._diff ?? "same";
              const base = `${leg._transId ?? leg.transitionid ?? ""}:${leg.legnumber ?? ""}:${i}`;
              const rowCls = status === "added" ? "ari-tr diff-row--added" :
                             status === "removed" ? "ari-tr diff-row--removed" :
                             status === "changed" ? "ari-tr diff-row--changed" : "ari-tr";
              const seqCellKey = `cleg:${base}.seq`;
              return (
                <tr key={`${leg._transId}:${leg.legnumber}:${i}`} className={rowCls}>
                  <td className={`ari-td diff-cell--seq ${getCellClass(seqCellKey, "")}`}
                    data-sym={getSymChar(seqCellKey)}
                    onClick={(e) => onCellClick(e, seqCellKey, allKeys)}
                    onDoubleClick={(e) => onCellDoubleClick(e, seqCellKey)}
                    onContextMenu={(e) => onCellContextMenu(e, seqCellKey, allKeys)}>
                    {leg.legnumber ?? ""}
                  </td>
                  <td className="ari-td diff-cell--trans">{leg.transitionid ?? leg._transId ?? ""}</td>
                  {COLS.map((c) => (
                    <FieldCell key={c.key} leg={leg} fieldKey={c.key} rowStatus={status}
                      cellKey={`cleg:${base}.${c.key}`}
                      getCellClass={getCellClass} getSymChar={getSymChar}
                      onCellClick={onCellClick} onCellContextMenu={onCellContextMenu}
                      onCellDoubleClick={onCellDoubleClick} allKeys={allKeys} />
                  ))}
                </tr>
              );
            })}
            {diffLegs.length === 0 && diffOnly && (
              <tr><td colSpan={COLS.length + 2} className="ari-td diff-val--same" style={{ textAlign: "center", padding: "14px" }}>No leg differences</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!diffOnly && sameLegs.length > 0 && (
        <div className="compare-identical-note">
          {sameLegs.length} identical leg{sameLegs.length !== 1 ? "s" : ""} shown — use <strong>Diff only</strong> to hide them
        </div>
      )}
      {menuState && (
        <HighlightContextMenu x={menuState.x} y={menuState.y} current={getCell(menuState.cellKey)}
          activeTool={activeTool} onSelectTool={onSelectTool} onClearCell={onClearCell}
          onClearAll={onClearAll} onClose={closeMenu} />
      )}
    </div>
  );
}
