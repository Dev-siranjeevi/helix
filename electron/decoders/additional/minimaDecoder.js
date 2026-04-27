/**
 * minimaDecoder.js — LPV / SBAS path-point (minima) record decoder.
 *
 * Ported from reader/components/cMT.js and cleaned up for Helix:
 *   – No DOM references
 *   – No space→x replacement hack (works on raw lines directly)
 *   – Each record returned as a plain object keyed by field name
 *   – formatPosition logic kept inline and aligned with procedureContributor.js
 *
 * ARINC 424 §5.21 — Path Point Record (section P, stage P).
 * Each procedure entry uses two continuation records (col 21 = '1' and '2').
 *
 * Returns MinimaRecord[]:
 * {
 *   procedureKey,   // "ICAO / procId"
 *   icao, procedureId,
 *   routeIndicator, refPathDataSelector, refPathIdentifier,
 *   ltpLat, ltpLon, ltpEllipsoidalHeight,
 *   fpapLat, fpapLon,
 *   glidepathAngle, courseWidthAtThreshold,
 *   lengthOffset,
 *   thresholdCrossingHeight, tchUnits,
 *   horizontalAlertLimit, verticalAlertLimit,
 *   crcRemainder,
 *   ltpOrthometricHeight, fpapOrthometricHeight,
 *   gnssChannel,
 * }
 */

"use strict";

const { COLS } = require("../constants");

// ── Helpers ───────────────────────────────────────────────────────────────────

const col = (line, [start, end]) =>
  line.substring(start, end).replace(/\u0000/g, "").trim();

/** ARINC coordinate → "N40 27 44.00" / "W122 23 12.30" */
const formatLat = (raw) => {
  const r = raw?.trim() ?? "";
  if (r.length < 7) return r || "";
  return `${r[0]}${r.slice(1, 3)} ${r.slice(3, 5)} ${r.slice(5, 7)}.${r.slice(7)}`;
};

const formatLon = (raw) => {
  const r = raw?.trim() ?? "";
  if (r.length < 8) return r || "";
  return `${r[0]}${r.slice(1, 4)} ${r.slice(4, 6)} ${r.slice(6, 8)}.${r.slice(8)}`;
};

/** Numeric decode helpers — mirror reader's formatMinimaTable rules */
const divBy10  = (raw) => raw ? String(Number(raw) / 10)   : "";
const divBy100 = (raw) => raw ? String(Number(raw) / 100)  : "";

/** TCH field: "+01234" format (tenths of metres) → "123.4m", else plain ÷10 */
const decodeTch = (raw) => {
  if (!raw) return "";
  const s = raw.trim();
  if (s.startsWith("+")) return `${(Number(s.slice(1)) / 10).toFixed(1)}m`;
  const n = Number(s);
  return isNaN(n) ? s : String(n / 10);
};

const toNum = (raw) => {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  return isNaN(n) ? s : String(n);
};

// ── Main decoder ──────────────────────────────────────────────────────────────

/**
 * decodeMinimaRecords — extract all LPV path-point records from raw CIFP lines.
 *
 * @param {string[]} rawLines   — all lines already split on \n
 * @returns {MinimaRecord[]}
 */
const decodeMinimaRecords = (rawLines) => {
  if (!rawLines?.length) return [];

  // Filter to section P, stage P (col 12 = 'P'), ignore empty
  const pLines = rawLines.filter((l) => {
    if (!l || l.length < 30) return false;
    const padded = l.padEnd(132, " ");
    return padded[4] === "P" && padded[12] === "P";
  }).map((l) => l.replace(/\r$/, "").padEnd(132, " "));

  if (!pLines.length) return [];

  // Group by procedure key (ICAO + procId), then by continuation record number
  // col 21 is the continuation record counter ('1' = primary data, '2' = secondary)
  const byProc = new Map();

  for (const line of pLines) {
    const icao    = col(line, COLS.MINIMA_ICAO);
    const procId  = col(line, COLS.MINIMA_PROC_ID);
    const contRec = line[21] ?? "0";
    const key     = `${icao}__${procId}`;

    if (!byProc.has(key)) byProc.set(key, { icao, procId, rec1: null, rec2: null });
    const entry = byProc.get(key);

    if (contRec === "1" && !entry.rec1) entry.rec1 = line;
    if (contRec === "2" && !entry.rec2) entry.rec2 = line;
  }

  const results = [];

  for (const { icao, procId, rec1, rec2 } of byProc.values()) {
    if (!rec1) continue; // primary record mandatory

    const ltpLatRaw  = col(rec1, COLS.MINIMA_LTP_LAT);
    const ltpLonRaw  = col(rec1, COLS.MINIMA_LTP_LON);
    const fpapLatRaw = col(rec1, COLS.MINIMA_FPAP_LAT);
    const fpapLonRaw = col(rec1, COLS.MINIMA_FPAP_LON);

    results.push({
      procedureKey:              `${icao} / ${procId}`,
      icao,
      procedureId:               procId,

      routeIndicator:            col(rec1, COLS.MINIMA_ROUTE_IND),
      refPathDataSelector:       col(rec1, COLS.MINIMA_REF_PATH_SEL),
      refPathIdentifier:         col(rec1, COLS.MINIMA_REF_PATH_IDENT),

      ltpLat:                    formatLat(ltpLatRaw),
      ltpLon:                    formatLon(ltpLonRaw),
      ltpEllipsoidalHeight:      toNum(col(rec1, COLS.MINIMA_LTP_ELLIP_HGT)),

      fpapLat:                   formatLat(fpapLatRaw),
      fpapLon:                   formatLon(fpapLonRaw),

      glidepathAngle:            divBy100(col(rec1, COLS.MINIMA_GLIDEPATH_ANGLE)),
      courseWidthAtThreshold:    divBy100(col(rec1, COLS.MINIMA_CRS_WIDTH)),
      lengthOffset:              toNum(col(rec1, COLS.MINIMA_LENGTH_OFFSET)),

      thresholdCrossingHeight:   decodeTch(col(rec1, COLS.MINIMA_TCH)),
      tchUnits:                  col(rec1, COLS.MINIMA_TCH_UNITS),

      horizontalAlertLimit:      divBy10(col(rec1, COLS.MINIMA_HAL)),
      verticalAlertLimit:        divBy10(col(rec1, COLS.MINIMA_VAL)),
      crcRemainder:              col(rec1, COLS.MINIMA_CRC),

      // Continuation record 2 fields — may be absent
      ltpOrthometricHeight:      rec2 ? toNum(col(rec2, COLS.MINIMA_LTP_ORTH_HGT))  : "",
      fpapOrthometricHeight:     rec2 ? toNum(col(rec2, COLS.MINIMA_FPAP_ORTH_HGT)) : "",
      gnssChannel:               rec2 ? toNum(col(rec2, COLS.MINIMA_GNSS_CHANNEL))   : "",
    });
  }

  return results;
};

module.exports = { decodeMinimaRecords };
