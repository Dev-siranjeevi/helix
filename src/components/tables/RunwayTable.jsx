import { useHighlight } from "./useHighlight";
import HighlightContextMenu from "./HighlightContextMenu";

const NAVAID_COLS = [
  { key: "ident", label: "Ident", width: 72 },
  { key: "magBrg", label: "Track (M)", width: 100 },
  { key: "lat", label: "Latitude", width: 160 },
  { key: "lon", label: "Longitude", width: 72 },
  { key: "elev", label: "Elevation", width: 72 },
  { key: "tch", label: "TCH", width: 72 },
  { key: "dthr", label: "DTHR", width: 72 },
];

export default function RunwayTable({
  runways = [],
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  if (!runways.length) return null;

  const allKeys = runways.flatMap((n) =>
    NAVAID_COLS.map(({ key }) => `nav:${n.ident}.${key}`),
  );

  const {
    activeTool,
    menuState,
    onCellClick,
    onCellContextMenu,
    onCellDoubleClick,
    onSelectTool,
    onClearCell,
    getCellClass,
    getSymChar,
    getCell,
    closeMenu,
  } = useHighlight({ filePath, highlights, onHighlightChange, onClearAll });

  return (
    <div className="table-section">
      <div className="table-section-label">runways</div>
      <div className="table-section__scroll">
        <table className="ari-table ari-table--fixed ari-table-secondary">
          <colgroup>
            {NAVAID_COLS.map(({ key, width }) => (
              <col key={key} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {NAVAID_COLS.map(({ key, label }) => (
                <th key={key} className="ari-th">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runways.map((nav) => (
              <tr key={nav.ident} className="ari-tr ari-tr--normal">
                {NAVAID_COLS.map(({ key }) => {
                  const cellKey = `nav:${nav.ident}.${key}`;
                  const val = nav[key];
                  return (
                    <td
                      key={key}
                      className={getCellClass(cellKey, "ari-td")}
                      data-sym={getSymChar(cellKey)}
                      onClick={(e) => onCellClick(e, cellKey, allKeys)}
                      onDoubleClick={(e) => onCellDoubleClick(e, cellKey)}
                      onContextMenu={(e) =>
                        onCellContextMenu(e, cellKey, allKeys)
                      }
                    >
                      {val !== undefined && val !== "" ? (
                        String(val)
                      ) : (
                        <span className="cell-empty">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menuState && (
        <HighlightContextMenu
          x={menuState.x}
          y={menuState.y}
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
