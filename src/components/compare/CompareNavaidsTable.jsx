
import { useHighlight } from "../tables/useHighlight";
import HighlightContextMenu from "../tables/HighlightContextMenu";

const NAV_COLS = [
  {key:"type",label:"Type"},{key:"name",label:"Name"},{key:"freq",label:"Freq"},
  {key:"lat",label:"Lat"},{key:"lon",label:"Lon"},
  {key:"stationDeclination",label:"Decl"},{key:"dmeBias",label:"DME Bias"},
];

export default function CompareNavaidsTable({ navaidDiff, nameA, nameB, diffOnly = false, filePath, highlights, onHighlightChange, onClearAll }) {
  if (!navaidDiff?.length) return null;
  const diffRows = navaidDiff.filter((r) => r.diff !== "same");
  const sameCount = navaidDiff.filter((r) => r.diff === "same").length;
  const rows = diffOnly ? navaidDiff.filter((r) => r.diff !== "same") : navaidDiff;

  const { activeTool, menuState, onCellClick, onCellContextMenu, onCellDoubleClick,
    onSelectTool, onClearCell, getCellClass, getSymChar, getCell, closeMenu } =
    useHighlight({ filePath, highlights, onHighlightChange, onClearAll });

  const allKeys = rows.flatMap((r) => NAV_COLS.map((c) => `cnav:${r.ident}.${c.key}`));

  const renderRows = () => rows.flatMap((r) => {
    if (r.diff === "same") return [<tr key={r.ident} className="ari-tr"><td className="ari-td diff-val--same">{r.ident}</td><td className="ari-td diff-val--same" colSpan={3}>identical</td></tr>];
    if (r.diff === "added" || r.diff === "removed") {
      const nav = r.navB ?? r.navA;
      return [<tr key={r.ident} className={`ari-tr diff-row--${r.diff}`}>
        <td className={`ari-td diff-val--${r.diff==="added"?"added-b":"removed-a"}`}>{r.ident}</td>
        <td className="ari-td diff-val--same" colSpan={3}>Navaid {r.diff} — {nav?.type}{nav?.freq ? ` ${nav.freq} MHz` : ""}</td>
      </tr>];
    }
    return (r.fields ?? []).filter((f) => f.diff !== "same").map((f) => {
      const ck = `cnav:${r.ident}.${f.field}`;
      return (
        <tr key={`${r.ident}.${f.field}`} className="ari-tr diff-row--changed">
          <td className="ari-td diff-val--same">{r.ident}</td>
          <td className="ari-td diff-val--same">{NAV_COLS.find((c)=>c.key===f.field)?.label??f.field}</td>
          <td className={`ari-td diff-cell--changed ${getCellClass(ck,"")}`}
            data-sym={getSymChar(ck)} onClick={(e)=>onCellClick(e,ck,allKeys)}
            onDoubleClick={(e)=>onCellDoubleClick(e,ck)} onContextMenu={(e)=>onCellContextMenu(e,ck,allKeys)}>
            <span className="diff-stack__new">{f.valueB||"—"}</span>
            <span className="diff-stack__old">{f.valueA||"—"}</span>
          </td>
          <td className="ari-td"/>
        </tr>
      );
    });
  });

  return (
    <div className="table-section">
      <div className="table-section-label">Navaids</div>
      <div className="table-section__scroll">
        <table className="ari-table"><thead><tr><th className="ari-th">Ident</th><th className="ari-th">Field</th><th className="ari-th"><span className="diff-th--b">New (B)</span><span style={{margin:"0 4px",opacity:0.5}}>→</span><span className="diff-th--a">Old (A)</span></th><th className="ari-th"/></tr></thead>
        <tbody>
          {renderRows()}
          {diffRows.length===0&&diffOnly&&<tr><td colSpan={4} className="ari-td diff-val--same" style={{textAlign:"center",padding:"14px"}}>No navaid differences</td></tr>}
        </tbody></table>
      </div>
      {!diffOnly&&sameCount>0&&<div className="compare-identical-note">{sameCount} identical navaid{sameCount!==1?"s":""} shown</div>}
      {menuState&&<HighlightContextMenu x={menuState.x} y={menuState.y} current={getCell(menuState.cellKey)} activeTool={activeTool} onSelectTool={onSelectTool} onClearCell={onClearCell} onClearAll={onClearAll} onClose={closeMenu}/>}
    </div>
  );
}
