import { useHighlight } from "./useHighlight";
import HighlightContextMenu from "./HighlightContextMenu";

const WP_COLS = [
  { key: "ident", label: "Ident", width: 100 },
  { key: "name", label: "Name", width: 100 },
  { key: "latitude", label: "Latitude", width: 120 },
  { key: "longitude", label: "Longitude", width: 130 },
  { key: "type", label: "Type", width: 60 },
  { key: "format", label: "Format", width: 60 },
];

export default function WaypointTable({
  waypoints = [],
  savWaypoints = new Set(),
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  if (!waypoints.length) return null;

  const allKeys = waypoints.flatMap((wp) =>
    WP_COLS.map(({ key }) => `wp:${wp.ident}.${key}`),
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
      <div className="table-section-label">Waypoint</div>
      <div className="table-section__scroll">
        <table className="ari-table ari-table--fixed ari-table-secondary">
          <colgroup>
            {WP_COLS.map(({ key, width }) => (
              <col key={key} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {WP_COLS.map(({ key, label }) => (
                <th key={key} className="ari-th">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waypoints.map((wp) => {
              const isSav = savWaypoints.has(wp.ident);
              return (
                <tr
                  key={wp.ident}
                  className={`ari-tr ${isSav ? "ari-tr--sav" : "ari-tr--normal"}`}
                >
                  {WP_COLS.map(({ key }) => {
                    const cellKey = `wp:${wp.ident}.${key}`;
                    const wptIdent =
                      key == "ident"
                        ? `${wp[key]}<span className="cell-empty">${wp["region"]}</span>`
                        : wp[key];
                    return (
                      <td
                        key={key}
                        className={getCellClass(
                          cellKey,
                          isSav ? "ari-td-patched" : "ari-td",
                        )}
                        data-sym={getSymChar(cellKey)}
                        onClick={(e) => onCellClick(e, cellKey, allKeys)}
                        onDoubleClick={(e) => onCellDoubleClick(e, cellKey)}
                        onContextMenu={(e) =>
                          onCellContextMenu(e, cellKey, allKeys)
                        }
                      >
                        {key === "ident" ? (
                          <>
                            {wp[key]}
                            <span className="cell-empty">/ {wp["region"]}</span>
                          </>
                        ) : wp[key] ? (
                          wp[key]
                        ) : (
                          <span className="cell-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
