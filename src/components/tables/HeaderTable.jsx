import HighlightContextMenu from "./HighlightContextMenu";
import { useHighlight } from "./useHighlight";

const HEADER_COLS = [
  { key: "procedure", label: "Procedure" },
  { key: "variation", label: "VAR" },
  { key: "va", label: "VA" },
  { key: "tch", label: "TCH" },
  { key: "gnssFms", label: "GNSS/FMS" },
  { key: "qualifier3", label: "Qualifier 1" },
  { key: "qualifier2", label: "Qualifier 2" },
  { key: "dmeRequired", label: "DME Required" },
  { key: "capabilities", label: "Capabilities" },
  { key: "rnpauth", label: "RNP Auth" },
  { key: "tl", label: "TL" },
  { key: "count", label: "Count" },
  { key: "cycle", label: "Cycle" },
];

export default function HeaderTable({
  header = {},
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  // const conventionalHeader = ["DME Required"];

  const tailoredHeader = HEADER_COLS;
  //   .filter(
  //   (hdr) => !conventionalHeader.includes(hdr.label),
  // );

  const allKeys = tailoredHeader.map(({ key }) => `hdr:${key}`);

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
      <div className="table-section-label">Header</div>

      <div className="table-section__scroll">
        <table className="ari-table">
          <thead>
            <tr>
              {tailoredHeader.map(({ key, label }) => {
                if (header[key] == null || header[key] === "") return null;

                return (
                  <th key={key} className="ari-th">
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            <tr className="ari-tr">
              {tailoredHeader.map(({ key }) => {
                if (header[key] == null || header[key] === "") return null;

                const cellKey = `hdr:${key}`;
                const dmeTicked = <span className="fo-tick">✓</span>;
                let headerValue = header[key] ?? (
                  <span className="cell-empty">—</span>
                );
                {
                  /* if (key == "dmeRequired" && header[key] !== "")
                  headerValue = dmeTicked; */
                }
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
                    {headerValue}
                  </td>
                );
              })}
            </tr>
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
