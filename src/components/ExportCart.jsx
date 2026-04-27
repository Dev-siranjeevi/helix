/**
 * ExportCart — slide-in panel listing items queued for PDF export.
 * Items: decoded files or compare sessions.
 * PDF: clean light/print-friendly output via window.print() with a
 *      dedicated print stylesheet, OR via html2canvas+jsPDF if available.
 */
import { useState, useCallback } from "react";

// ── PDF generation ────────────────────────────────────────────────────────────
function buildPrintHtml(items) {
  const escHtml = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const renderHeaderRow = (header) => {
    const COLS = [
      ["procedure","Procedure"],["variation","VAR"],["va","VA"],["tch","TCH"],
      ["gnssFms","GNSS/FMS"],["qualifier3","Qualifier 1"],["qualifier2","Qualifier 2"],
      ["dmeRequired","DME Req"],["capabilities","Capabilities"],["cycle","Cycle"],
    ];
    const filled = COLS.filter(([k]) => header?.[k] != null && header[k] !== "");
    return `<table class="ptbl"><thead><tr>${filled.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead>
<tbody><tr>${filled.map(([k])=>`<td>${escHtml(header?.[k])}</td>`).join("")}</tr></tbody></table>`;
  };

  const LEG_COLS = [
    ["legnumber","Seq"],["transitionid","Trans"],["category","CAT"],["flyover","FO"],
    ["legtype","Path"],["rnp","RNP"],["fixattr","Attr"],["comp","Comp"],
    ["reConstructedFixIdent","Fix"],["altitudeFromatted","Altitude"],["speed","Speed"],
    ["crsmag","Course"],["distance","Dist"],["turndirections","Turn"],
    ["recomnavaid","Recom"],["theta","θ"],["rho","ρ"],
  ];

  const renderLegs = (legs) => {
    if (!legs?.length) return "";
    let lastTrans = null;
    const rows = legs.map((leg) => {
      const divider = leg.transitionid && leg.transitionid !== lastTrans && lastTrans !== null
        ? `<tr class="divider"><td colspan="${LEG_COLS.length}"></td></tr>` : "";
      lastTrans = leg.transitionid;
      return divider + `<tr>${LEG_COLS.map(([k]) => `<td>${escHtml(k==="flyover"?(leg[k]?"✓":""):leg[k])}</td>`).join("")}</tr>`;
    }).join("");
    return `<table class="ptbl ptbl--legs"><thead><tr>${LEG_COLS.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  };

  const WP_COLS = [["ident","Ident"],["name","Name"],["latitude","Lat"],["longitude","Lon"],["type","Type"],["format","Format"]];
  const renderWaypoints = (wpts) => {
    if (!wpts?.length) return "";
    return `<table class="ptbl"><thead><tr>${WP_COLS.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead>
<tbody>${wpts.map(w=>`<tr>${WP_COLS.map(([k])=>`<td>${escHtml(w[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };

  const NAV_COLS2 = [["ident","Ident"],["type","Type"],["name","Name"],["freq","Freq"],["lat","Lat"],["lon","Lon"],["stationDeclination","Decl"],["dmeBias","DME Bias"]];
  const renderNavaids = (navs) => {
    if (!navs?.length) return "";
    return `<table class="ptbl"><thead><tr>${NAV_COLS2.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead>
<tbody>${navs.map(n=>`<tr>${NAV_COLS2.map(([k])=>`<td>${escHtml(n[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };

  const RWY_COLS = [["ident","Ident"],["magBrg","Track(M)"],["lat","Lat"],["lon","Lon"],["elev","Elev"],["tch","TCH"],["dthr","DTHR"]];
  const renderRunways = (rwys) => {
    if (!rwys?.length) return "";
    return `<table class="ptbl"><thead><tr>${RWY_COLS.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead>
<tbody>${rwys.map(r=>`<tr>${RWY_COLS.map(([k])=>`<td>${escHtml(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };

  const DIFF_LEG_COLS = [
    ["legnumber","Seq"],["transitionid","Trans"],["legtype","Path"],["fixattr","Attr"],
    ["waypoint","Fix"],["altitude","Alt"],["speed","Spd"],["crsmag","Crs"],
    ["turndirections","Turn"],["distance","Dist"],
  ];

  const renderDiffLegs = (legDiff) => {
    if (!legDiff?.length) return "";
    const diffOnly = legDiff.filter((l) => (l._diff ?? "same") !== "same");
    if (!diffOnly.length) return `<p class="no-diff">No leg differences</p>`;
    const rows = diffOnly.map((leg) => {
      const status = leg._diff;
      const cls = status === "added" ? "row-added" : status === "removed" ? "row-removed" : "row-changed";
      return `<tr class="${cls}">${DIFF_LEG_COLS.map(([k]) => {
        const field = leg[k];
        if (field && typeof field === "object" && field.diff === "changed") {
          return `<td><span class="new-val">${escHtml(field.value)}</span><br/><span class="old-val">${escHtml(field.oldValue)}</span></td>`;
        }
        const v = (field && typeof field === "object") ? field.value : field;
        return `<td>${escHtml(v)}</td>`;
      }).join("")}</tr>`;
    }).join("");
    return `<table class="ptbl ptbl--legs"><thead><tr>${DIFF_LEG_COLS.map(([,l])=>`<th>${escHtml(l)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  };

  const sections = items.map((item, idx) => {
    if (item.type === "decoded") {
      const file = item.file;
      const proc = file.procedures?.[0];
      const header = {
        procedure: `${proc?.icao ?? ""} / ${proc?.procedureId ?? ""}`,
        variation: proc?.pdmv ?? "",
        va: (proc?.gradient ?? []).join(", "),
        tch: proc?.thrHeight ?? "",
        gnssFms: proc?.legs?.[0]?.gnssfms || "NA",
        qualifier2: proc?.legs?.[0]?.minima || "NA",
        qualifier3: proc?.legs?.[0]?.sensor !== "N" ? proc?.legs?.[0]?.sensor ?? "" : "",
        dmeRequired: proc?.legs?.[0]?.sensor === "D" ? "✓" : "—",
        capabilities: proc?.capabilities ?? "",
        cycle: proc?.cycle ?? "",
      };
      const navHtml = file.navaids?.length ? renderNavaids(file.navaids) : "";
      const rwyHtml = file.runways?.length ? renderRunways(file.runways) : "";
      return `
        <div class="export-section">
          <div class="section-title">
            <span class="section-num">${idx + 1}</span>
            <span>${escHtml(file.name)}</span>
            ${proc?.procedureId ? `<span class="badge-proc">${escHtml(proc.procedureId)}</span>` : ""}
            <span class="badge-decoded">DECODED</span>
          </div>
          <div class="sub-label">Header</div>${renderHeaderRow(header)}
          <div class="sub-label">Procedure Legs</div>${renderLegs(proc?.legs)}
          <div class="sub-label">Waypoints</div>${renderWaypoints(file.waypoints)}
          ${navHtml ? `<div class="sub-label">Navaids</div>${navHtml}` : ""}
          ${rwyHtml ? `<div class="sub-label">Runways</div>${rwyHtml}` : ""}
        </div>`;
    } else {
      // compare
      const { diff, nameA, nameB } = item;
      const hdrChanges = diff.headerDiff.filter((r) => r.diff !== "same");
      return `
        <div class="export-section">
          <div class="section-title">
            <span class="section-num">${idx + 1}</span>
            <span>${escHtml(nameA)} ↔ ${escHtml(nameB)}</span>
            <span class="badge-compare">COMPARE</span>
          </div>
          <div class="diff-meta">
            Legs: ${diff.summary.legs.changed} changed · ${diff.summary.legs.added} added · ${diff.summary.legs.removed} removed &nbsp;|&nbsp;
            Waypoints: ${diff.summary.waypoints.changed + diff.summary.waypoints.added + diff.summary.waypoints.removed} changes
          </div>
          ${hdrChanges.length ? `<div class="sub-label">Header Changes</div>
          <table class="ptbl"><thead><tr><th>Field</th><th>Old (${escHtml(nameA)})</th><th>New (${escHtml(nameB)})</th></tr></thead>
          <tbody>${hdrChanges.map(r=>`<tr class="row-changed"><td>${escHtml(FIELD_LABELS[r.key]??r.key)}</td><td class="old-val">${escHtml(r.valueA)}</td><td class="new-val">${escHtml(r.valueB)}</td></tr>`).join("")}</tbody></table>` : ""}
          <div class="sub-label">Leg Differences</div>${renderDiffLegs(diff.legDiff)}
        </div>`;
    }
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Helix Export</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Helvetica Neue",Arial,sans-serif;font-size:10px;color:#1a1a1a;background:#fff;padding:16px}
  h1{font-size:16px;font-weight:700;margin-bottom:4px;color:#111}
  .meta{font-size:9px;color:#666;margin-bottom:20px}
  .export-section{margin-bottom:28px;page-break-inside:avoid}
  .section-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid #333}
  .section-num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#333;color:#fff;font-size:9px;flex-shrink:0}
  .badge-decoded{font-size:8px;padding:2px 6px;border-radius:3px;background:#e8f4fd;color:#0066cc;border:1px solid #b3d9f5;font-weight:700;letter-spacing:.05em}
  .badge-compare{font-size:8px;padding:2px 6px;border-radius:3px;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;font-weight:700;letter-spacing:.05em}
  .badge-proc{font-size:8px;padding:2px 6px;border-radius:3px;background:#e8f4fd;color:#003d82;border:1px solid #b3d9f5;font-weight:700}
  .sub-label{font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 4px}
  .diff-meta{font-size:9px;color:#555;margin-bottom:8px;padding:4px 8px;background:#f5f5f5;border-radius:3px}
  .ptbl{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9px}
  .ptbl th{background:#f0f0f0;font-weight:700;padding:3px 6px;border:1px solid #ccc;text-align:left;white-space:nowrap}
  .ptbl td{padding:2px 6px;border:1px solid #ddd;white-space:nowrap}
  .ptbl--legs td,.ptbl--legs th{font-family:"Courier New",monospace}
  .divider td{height:4px;background:#eee;border:none}
  .row-added td{background:#e8f5e9;color:#1b5e20}
  .row-removed td{background:#fce4ec;color:#880e4f;text-decoration:line-through}
  .row-changed td{background:#fff8e1}
  .new-val{color:#1b5e20;font-weight:600;display:block}
  .old-val{color:#b71c1c;text-decoration:line-through;font-size:8px;display:block}
  .no-diff{color:#666;font-style:italic;font-size:9px;padding:4px 0}
  @page{margin:15mm;size:A4 landscape}
  @media print{body{padding:0}}
</style>
</head>
<body>
<h1>Helix — Procedure Export</h1>
<div class="meta">Generated ${new Date().toLocaleString()} · ${items.length} item${items.length !== 1 ? "s" : ""}</div>
${sections}
</body>
</html>`;
}

const FIELD_LABELS = {
  icao:"ICAO", procedureId:"Procedure ID", procedureType:"Proc Type",
  procstage:"Stage", cycle:"Cycle", gradient:"Gradient",
  variation:"Variation", sensor:"Sensor", minima:"Minima", tch:"TCH",
};

// ── Cart panel ────────────────────────────────────────────────────────────────
export default function ExportCart({ items, onRemove, onClear, onClose }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!items.length) return;
    setExporting(true);
    try {
      const html = buildPrintHtml(items);
      const win = window.open("", "_blank", "width=1200,height=900,scrollbars=yes");
      if (!win) { alert("Please allow pop-ups to export PDF"); setExporting(false); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); setExporting(false); }, 600);
    } catch (e) {
      console.error("[ExportCart]", e);
      setExporting(false);
    }
  }, [items]);

  return (
    <div className="cart-panel">
      <div className="cart-panel__header">
        <span className="cart-panel__title">
          <svg viewBox="0 0 14 14" fill="none" width="13" height="13" style={{marginRight:6}}>
            <path d="M1 1h2l2 7h6l1.5-5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7" cy="12" r="1" fill="currentColor"/>
            <circle cx="10.5" cy="12" r="1" fill="currentColor"/>
          </svg>
          Export Cart
          <span className="cart-panel__count">{items.length}</span>
        </span>
        <button className="icon-btn icon-btn--danger" onClick={onClose} title="Close">
          <svg viewBox="0 0 8 8" fill="none" width="10" height="10">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="cart-panel__list">
        {items.length === 0 && (
          <div className="cart-panel__empty">
            <p>No items yet.</p>
            <p>Use <strong>Add to cart</strong> on any decoded or compare view.</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.cartId} className="cart-item">
            <span className={`cart-item__badge ${item.type === "compare" ? "cart-item__badge--cmp" : "cart-item__badge--dec"}`}>
              {item.type === "compare" ? "↔" : "ARI"}
            </span>
            <span className="cart-item__label">
              {item.type === "decoded" ? item.file?.name : `${item.nameA} ↔ ${item.nameB}`}
            </span>
            <button className="icon-btn icon-btn--danger cart-item__remove" onClick={() => onRemove(item.cartId)} title="Remove">
              <svg viewBox="0 0 8 8" fill="none" width="9" height="9">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="cart-panel__footer">
        {items.length > 0 && (
          <button className="cart-panel__clear" onClick={onClear}>Clear all</button>
        )}
        <button
          className={`cart-panel__export ${items.length === 0 ? "cart-panel__export--disabled" : ""}`}
          onClick={handleExport}
          disabled={items.length === 0 || exporting}
        >
          {exporting ? "Preparing…" : `Export ${items.length} to PDF`}
        </button>
      </div>
    </div>
  );
}
