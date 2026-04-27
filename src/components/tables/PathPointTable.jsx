import { useHighlight } from "./useHighlight";
import HighlightContextMenu from "./HighlightContextMenu";

const PATH_COLS = [
  { key: "icao", label: "icao", width: 70 },
  { key: "procedure", label: "procedure", width: 70 },
  { key: "operation_type", label: "operation_type", width: 70 },
  {
    key: "sbas_service_provider_identifier",
    label: "sbas_service_provider_identifier",
    width: 70,
  },
  { key: "airportidentirer", label: "airportidentirer", width: 70 },
  { key: "runway", label: "runway", width: 70 },
  {
    key: "approach_performance_designator",
    label: "approach_performance_designator",
    width: 70,
  },
  { key: "route_indicator", label: "route_indicator", width: 70 },
  {
    key: "reference_path_data_selector",
    label: "reference_path_data_selector",
    width: 70,
  },
  {
    key: "reference_path_identifier",
    label: "reference_path_identifier",
    width: 70,
  },
  { key: "ltp_latitude", label: "ltp_latitude", width: 70 },
  { key: "ltp_longitude", label: "ltp_longitude", width: 70 },
  { key: "ltp_ellipsoidal_height", label: "ltp_ellipsoidal_height", width: 70 },
  { key: "fpap_latitude", label: "fpap_latitude", width: 70 },
  { key: "fpap_longitude", label: "fpap_longitude", width: 70 },
  {
    key: "threshold_crossing_height",
    label: "threshold_crossing_height",
    width: 70,
  },
  { key: "tch_units_selector", label: "tch_units_selector", width: 70 },
  { key: "glidepath_angle", label: "glidepath_angle", width: 70 },
  {
    key: "course_width_at_threshold",
    label: "course_width_at_threshold",
    width: 70,
  },
  { key: "length_offset", label: "length_offset", width: 70 },
  { key: "horizontal_alert_limit", label: "horizontal_alert_limit", width: 70 },
  { key: "vertical_alert_limit", label: "vertical_alert_limit", width: 70 },
  { key: "crc_remainder", label: "crc_remainder", width: 70 },
  { key: "fpap_ellipsoid_height", label: "fpap_ellipsoid_height", width: 70 },
  { key: "ltp_orthometric_height", label: "ltp_orthometric_height", width: 70 },
  {
    key: "fpap_orthometric_height",
    label: "fpap_orthometric_height",
    width: 70,
  },
  { key: "gnss_Channel", label: "gnss_Channel", width: 70 },
  {
    key: "Approach_Type_Identifier",
    label: "Approach_Type_Identifier",
    width: 70,
  },
];

export default function PathPointTable({
  pathPoint = [],
  filePath,
  highlights,
  onHighlightChange,
  onClearAll,
}) {
  if (!pathPoint.length) return null;

  const allKeys = pathPoint.flatMap((n) =>
    PATH_COLS.map(({ key }) => `nav:${n.ident}.${key}`),
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
      <div className="table-section-label">FAS DATA BLOCK INFORMATION</div>

      <div className="table-section__scroll">
        <table className="ari-table ari-table--fixed ari-table-secondary">
          <thead>
            <tr>
              <th className="ari-th">DATA FIELD</th>
              <th className="ari-th">DATA</th>
            </tr>
          </thead>

          <tbody>
            {pathPoint.flatMap((nav) =>
              PATH_COLS.map(({ key, label }) => {
                const cellKey = `nav:${nav.ident}.${key}`;
                const val = nav[key];

                return (
                  <tr
                    key={`${nav.ident || nav.icao}-${key}`}
                    className="ari-tr ari-tr--normal"
                  >
                    <th className="ari-th">
                      {label.replace(/_/g, " ").toLocaleUpperCase()}
                    </th>

                    <td
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
                  </tr>
                );
              }),
            )}
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
