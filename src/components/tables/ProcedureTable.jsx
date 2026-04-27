import { useHighlight } from "./useHighlight";
import HighlightContextMenu from "./HighlightContextMenu";

const LEG_COLS = [
  { key: "legnumber", label: "Seq", width: 48 },
  { key: "transitionid", label: "Trans", width: 50 },
  { key: "category", label: "CAT", width: 44 },
  { key: "flyover", label: "FO", width: 40 },
  { key: "legtype", label: "Path", width: 40 },
  { key: "rnp", label: "RNP", width: 40 },
  { key: "fixattr", label: "Attr", width: 30 },
  { key: "comp", label: "Comp", width: 40 },
  { key: "reConstructedFixIdent", label: "Fix", width: 64 },
  { key: "altitudeFromatted", label: "Altitude", width: 80 },
  { key: "speed", label: "Speed", width: 56 },
  { key: "crsmag", label: "Course", width: 50 },
  { key: "distance", label: "Distance", width: 50 },
  { key: "turndirections", label: "Turn", width: 40 },
  { key: "recomnavaid", label: "Recom", width: 60 },
  { key: "theta", label: "Theta", width: 64 },
  { key: "rho", label: "Rho", width: 56 },
  { key: "center", label: "Center", width: 60 },
  { key: "radius", label: "Radius", width: 50 },
  { key: "gradient", label: "VA", width: 50 },
];

const FO_TICK = <span className="fo-tick">✓</span>;

function CellContent({ colKey, value }) {
  if (colKey === "flyover") return value ? FO_TICK : null;
  if (colKey === "turndirections" && value)
    return <span className={`turn-${value}`}>{value}</span>;
  if (!value) return <span className="cell-empty" />;
  return value;
}

export default function ProcedureTable({
  legs = [],
  savLegs = new Set(),
  hiddenSegments = new Set(),
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
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

  if (!legs.length) return null;

  // Filter out legs whose transition is hidden
  const visibleLegs = hiddenSegments.size > 0
    ? legs.filter(leg => !hiddenSegments.has(leg.transitionid))
    : legs;

  const allKeys = visibleLegs.flatMap((leg) =>
    LEG_COLS.map(({ key }) => `leg:${leg._key}.${key}`),
  );

  let lastTrans = null;

  return (
    <div className="table-section">
      <div className="table-section-label">Procedure</div>
      <div className="table-section__scroll">
        <table className="ari-table ari-table--fixed">
          <colgroup>
            {LEG_COLS.map(({ key, width }) => (
              <col key={key} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {LEG_COLS.map(({ key, label }) => (
                <th key={key} className="ari-th">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleLegs.map((leg, i) => {
              const legKey = leg._key ?? `${leg.legnumber}.${leg.transitionid}`;
              const isSav = savLegs.has(legKey);
              const showDiv =
                leg.transitionid &&
                leg.transitionid !== lastTrans &&
                lastTrans !== null;
              lastTrans = leg.transitionid;

              const rowClass = [
                "ari-tr",
                isSav ? "ari-tr--sav" : "ari-tr--normal",
              ]
                .filter(Boolean)
                .join(" ");

              return [
                showDiv && (
                  <tr key={`div-${i}`} className="ari-divider" aria-hidden>
                    <td colSpan={LEG_COLS.length} />
                  </tr>
                ),
                <tr key={legKey} className={rowClass}>
                  {LEG_COLS.map(({ key: col }) => {
                    const cellKey = `leg:${legKey}.${col}`;
                    return (
                      <td
                        key={col}
                        className={getCellClass(cellKey, isSav ? "ari-td-patched" : "ari-td")}
                        data-sym={getSymChar(cellKey)}
                        onClick={(e) => onCellClick(e, cellKey, allKeys)}
                        onDoubleClick={(e) => onCellDoubleClick(e, cellKey)}
                        onContextMenu={(e) => onCellContextMenu(e, cellKey, allKeys)}
                      >
                        <CellContent colKey={col} value={leg[col]} />
                      </td>
                    );
                  })}
                </tr>,
              ];
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
