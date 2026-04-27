import { useHighlight } from "./useHighlight";
import HighlightContextMenu from "./HighlightContextMenu";

const NAVAID_COLS = [
  { key: "ident", label: "Ident", width: 72 },
  { key: "type", label: "Type", width: 100 },
  { key: "name", label: "Name", width: 160 },
  { key: "freq", label: "Freq", width: 72 },
  { key: "lat", label: "Lat", width: 130 },
  { key: "lon", label: "Lon", width: 140 },
  { key: "dLat", label: "DME Lat", width: 130 },
  { key: "dLon", label: "DME Lon", width: 140 },
  { key: "stationDeclination", label: "Decl", width: 64 },
  { key: "dmeBias", label: "DME Bias", width: 72 },
  { key: "forRwy", label: "For RWY", width: 70 },
  { key: "locBearing", label: "Loc Brg", width: 70 },
];

export default function NavaidsTable({
  navaids = [],
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  if (!navaids.length) return null;

  const allKeys = navaids.flatMap((n) =>
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
      <div className="table-section-label">Navaids</div>
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
            {navaids.map((nav) => (
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
