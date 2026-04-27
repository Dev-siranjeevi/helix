/**
 * CompareMinimaTable — unified diff of LPV / path-point minima records.
 * Mirrors CompareWaypointTable structure with full highlight support.
 * Changed fields show new value (B) above old value (A) — struck through.
 */
import { useHighlight } from "../tables/useHighlight";
import HighlightContextMenu from "../tables/HighlightContextMenu";

const MINIMA_COLS = [
  { key: "routeIndicator",          label: "Route"     },
  { key: "refPathIdentifier",       label: "Ref Path"  },
  { key: "glidepathAngle",          label: "GP Angle"  },
  { key: "thresholdCrossingHeight", label: "TCH"       },
  { key: "tchUnits",                label: "TCH Units" },
  { key: "horizontalAlertLimit",    label: "HAL"       },
  { key: "verticalAlertLimit",      label: "VAL"       },
  { key: "ltpLat",                  label: "LTP Lat"   },
  { key: "ltpLon",                  label: "LTP Lon"   },
  { key: "fpapLat",                 label: "FPAP Lat"  },
  { key: "fpapLon",                 label: "FPAP Lon"  },
  { key: "gnssChannel",             label: "Ch"        },
  { key: "crcRemainder",            label: "CRC"       },
];

const valClass = (diff, side) => {
  if (diff === "same")    return "diff-val--same";
  if (diff === "changed") return `diff-val--changed-${side}`;
  if (diff === "added")   return `diff-val--added-${side}`;
  if (diff === "removed") return `diff-val--removed-${side}`;
  return "";
};

export default function CompareMinimaTable({ minimaDiff, nameA, nameB, diffOnly = false, filePath, highlights, onHighlightChange, onClearAll }) {
  const { activeTool, menuState, onCellClick, onCellContextMenu, onCellDoubleClick,
    onSelectTool, onClearCell, getCellClass, getSymChar, getCell, closeMenu } =
    useHighlight({ filePath, highlights, onHighlightChange, onClearAll });

  if (!minimaDiff?.length) return null;

  const diffRows  = minimaDiff.filter((r) => r.diff !== "same");
  const sameCount = minimaDiff.filter((r) => r.diff === "same").length;
  const allKeys   = minimaDiff.flatMap((r) => MINIMA_COLS.map((c) => `cmin:${r.key}.${c.key}`));

  const renderRows = () => {
    const rows = diffOnly ? diffRows : minimaDiff;
    return rows.flatMap((r) => {
      if (r.diff === "same") {
        return [(
          <tr key={r.key} className="ari-tr">
            <td className="ari-td diff-val--same">{r.key}</td>
            <td className="ari-td diff-val--same" colSpan={3}>identical</td>
          </tr>
        )];
      }

      if (r.diff === "added" || r.diff === "removed") {
        const m = r.mB ?? r.mA;
        return [(
          <tr key={r.key} className={`ari-tr diff-row--${r.diff}`}>
            <td className={`ari-td ${valClass(r.diff, r.diff === "added" ? "b" : "a")}`}>{r.key}</td>
            <td className="ari-td diff-val--same" colSpan={3}>
              Minima record {r.diff === "added" ? "added in B" : "removed in B"}
              {m?.glidepathAngle ? ` — GP ${m.glidepathAngle}°` : ""}
            </td>
          </tr>
        )];
      }

      return (r.fields ?? [])
        .filter((f) => f.diff !== "same")
        .map((f) => {
          const ck = `cmin:${r.key}.${f.field}`;
          return (
            <tr key={`${r.key}.${f.field}`} className="ari-tr diff-row--changed">
              <td className="ari-td diff-val--same">{r.key}</td>
              <td className="ari-td diff-val--same">
                {MINIMA_COLS.find((c) => c.key === f.field)?.label ?? f.field}
              </td>
              <td className={`ari-td diff-cell--changed ${getCellClass(ck, "")}`}
                data-sym={getSymChar(ck)}
                onClick={(e) => onCellClick(e, ck, allKeys)}
                onDoubleClick={(e) => onCellDoubleClick(e, ck)}
                onContextMenu={(e) => onCellContextMenu(e, ck, allKeys)}>
                {/* valueB = newer (B), valueA = older (A) */}
                <span className="diff-stack__new">{f.valueB || "—"}</span>
                <span className="diff-stack__old">{f.valueA || "—"}</span>
              </td>
              <td className="ari-td" />
            </tr>
          );
        });
    });
  };

  return (
    <div className="table-section">
      <div className="table-section-label">Minima / Path Points</div>
      <div className="table-section__scroll">
        <table className="ari-table">
          <thead>
            <tr>
              <th className="ari-th">Key</th>
              <th className="ari-th">Field</th>
              <th className="ari-th">
                <span className="diff-th--b">New (B)</span>
                <span style={{ margin: "0 4px", opacity: 0.5 }}>→</span>
                <span className="diff-th--a">Old (A)</span>
              </th>
              <th className="ari-th" />
            </tr>
          </thead>
          <tbody>
            {renderRows()}
            {diffRows.length === 0 && diffOnly && (
              <tr>
                <td colSpan={4} className="ari-td diff-val--same" style={{ textAlign: "center" }}>
                  No minima differences
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!diffOnly && sameCount > 0 && (
        <div className="compare-identical-note">{sameCount} identical record{sameCount !== 1 ? "s" : ""} shown</div>
      )}
      {menuState && (
        <HighlightContextMenu
          x={menuState.x} y={menuState.y}
          current={getCell(menuState.cellKey)}
          activeTool={activeTool}
          onSelectTool={onSelectTool}
          onClearCell={onClearCell}
          onClearAll={onClearAll}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
