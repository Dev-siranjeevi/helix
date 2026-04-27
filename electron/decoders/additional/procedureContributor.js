/**
 * procedureContributor.js
 *
 * Parsers for:
 *   - Waypoints  (parseWaypoint)
 *   - Runways    (parseRunway)
 *   - Navaids    (parseNavaids, extractNavaidIdents)
 *
 * All column ranges come from constants.js.
 * Navaid parsing covers VHF (VOR/DME/TACAN), NDB, and ILS.
 */

"use strict";

const { formatdecimals } = require("../../processors/legcleanup");
const { COLS } = require("../constants");

// ── Slice helper ──────────────────────────────────────────────────────────────
const col = (line, [start, end]) =>
  line
    .substring(start, end)
    .replace(/\u0000/g, "")
    .trim();
const colStr = (line, [start, end]) =>
  line
    .substr(start, end)
    .replace(/\u0000/g, "")
    .trim();

// ── Coordinate formatters ─────────────────────────────────────────────────────
// ARINC 424: "N402744.00" → "N40 27 44.00"
const formatLat = (raw) => {
  const r = raw?.trim() ?? "";
  if (r.length < 7) return r;
  return `${r[0]}${r.slice(1, 3)} ${r.slice(3, 5)} ${r.slice(5, 7)}.${r.slice(7)}`;
};

const formatLon = (raw) => {
  const r = raw?.trim() ?? "";
  if (r.length < 8) return r;
  return `${r[0]}${r.slice(1, 4)} ${r.slice(4, 6)} ${r.slice(6, 8)}.${r.slice(8)}`;
};

const fmtPos = (latRaw, lonRaw) => [formatLat(latRaw), formatLon(lonRaw)];

// ── Waypoint parser ───────────────────────────────────────────────────────────
const parseWaypoint = (line) => {
  const isENRT =
    line.substr(6, 4) == "ENRT"
      ? line.substr(19, 2)
      : col(line, COLS.WP_REGION);
  return {
    ident: col(line, COLS.WP_IDENT),
    region: isENRT,
    type: col(line, COLS.WP_TYPE),
    format: col(line, COLS.WP_FORMAT),
    latitude: formatLat(col(line, COLS.WP_LAT)),
    longitude: formatLon(col(line, COLS.WP_LON)),
    name: col(line, COLS.WP_NAME),
  };
};

// ── Navaid helpers ────────────────────────────────────────────────────────────

const TYPE_ABBR = { V: "VOR", D: "DME", T: "TACAN", H: "NDB", I: "ILS" };

const buildTypeString = (typeRaw) => {
  const parts = (typeRaw ?? "")
    .split("")
    .map((c) => TYPE_ABBR[c])
    .filter(Boolean);
  return parts.length ? parts.join(" + ") : (typeRaw?.trim() ?? "");
};

// VHF: stored as integer × 100 → MHz  (11030 → 110.30)
const decodeVhfFreq = (raw) => {
  const n = Number(raw?.trim());
  if (!n) return 0;
  const s = String(n);
  return Number(`${s.slice(0, -2)}.${s.slice(-2)}`);
};

// NDB: stored as integer × 10 → kHz  (3350 → 335.0)
const decodeNdbFreq = (raw) => {
  const n = Number(raw?.trim());
  if (!n) return 0;
  const s = String(n);
  return Number(`${s.slice(0, -1)}.${s.slice(-1)}`);
};

// "E035" → "E3.5",  "W120" → "W12.0"
const decodeStationDec = (raw) => {
  const r = raw?.trim() ?? "";
  if (!r) return "";
  const dir = r[0];
  const digits = r.slice(1).replace(/\s/g, "");
  if (!digits) return dir;
  const val = Number(`${digits.slice(0, -1)}.${digits.slice(-1)}`);
  return `${dir}${val}`;
};

// ── Line-type detectors ───────────────────────────────────────────────────────
const isVhfLine = (l) => l[4] === "D" && l[12] !== "I";
const isNdbLine = (l) => l.substring(4, 6) === "DB" || l[12] === "H";
const isIlsLine = (l) => l[12] === "I";
const isContinuation1 = (l) => l[21] === "1";

// ── VHF record parser ─────────────────────────────────────────────────────────
const parseVhfRecord = (line) => {
  const [lat, lon] = fmtPos(
    col(line, COLS.NAV_VHF_LAT),
    col(line, COLS.NAV_VHF_LON),
  );
  const [dLat, dLon] = fmtPos(
    col(line, COLS.NAV_VHF_DME_LAT),
    col(line, COLS.NAV_VHF_DME_LON),
  );
  return {
    ident: col(line, COLS.NAV_VHF_IDENT),
    type: buildTypeString(col(line, COLS.NAV_VHF_TYPE)),
    name: col(line, COLS.NAV_VHF_NAME).replace(/\s{2,}/g, " "),
    freq: decodeVhfFreq(col(line, COLS.NAV_VHF_FREQ)),
    lat,
    lon,
    dLat: dLat !== lat ? dLat : "",
    dLon: dLon !== lon ? dLon : "",
    stationDeclination: decodeStationDec(col(line, COLS.NAV_VHF_STATION_DEC)),
    elevation: col(line, COLS.NAV_VHF_ELEV),
    dmeBias: "",
    raw: line,
  };
};

// ── NDB record parser ─────────────────────────────────────────────────────────
const parseNdbRecord = (line) => {
  const [lat, lon] = fmtPos(
    col(line, COLS.NAV_NDB_LAT),
    col(line, COLS.NAV_NDB_LON),
  );
  const [dLat, dLon] = fmtPos(
    col(line, COLS.NAV_NDB_DME_LAT),
    col(line, COLS.NAV_NDB_DME_LON),
  );
  return {
    ident: col(line, COLS.NAV_NDB_IDENT),
    type: "NDB",
    name: col(line, COLS.NAV_NDB_NAME).replace(/\s{2,}/g, " "),
    freq: decodeNdbFreq(col(line, COLS.NAV_NDB_FREQ)),
    lat,
    lon,
    dLat: dLat !== lat ? dLat : "",
    dLon: dLon !== lon ? dLon : "",
    stationDeclination: decodeStationDec(col(line, COLS.NAV_NDB_STATION_DEC)),
    elevation: "",
    dmeBias: "",
    raw: line,
  };
};

// ── ILS record parser ─────────────────────────────────────────────────────────
// Multiple continuation lines per ident — we take all and merge.
const parseIlsRecord = (ilsLines, vhfLineForIdent) => {
  const primary = ilsLines.find(isContinuation1) ?? ilsLines[0];
  if (!primary) return null;

  const freq = decodeVhfFreq(col(primary, COLS.NAV_ILS_FREQ));
  const forRwy = col(primary, COLS.NAV_ILS_FOR_RWY);
  const locBrg = Number(col(primary, COLS.NAV_ILS_LOC_BRG)) / 10;
  const statDec = decodeStationDec(col(primary, COLS.NAV_ILS_STATION_DEC));
  const [locLat, locLon] = fmtPos(
    col(primary, COLS.NAV_ILS_LOC_LAT),
    col(primary, COLS.NAV_ILS_LOC_LON),
  );

  const ltpLatRaw = col(primary, COLS.NAV_ILS_GP_LAT);
  const gpLonRaw = col(primary, COLS.NAV_ILS_GP_LON);
  const [gpLat, gpLon] = ltpLatRaw
    ? fmtPos(ltpLatRaw, gpLonRaw)
    : [locLat, locLon];

  const dmeBiasRaw = vhfLineForIdent
    ? col(vhfLineForIdent, COLS.NAV_VHF_DME_BIAS)
    : "";
  const dmeBias = dmeBiasRaw ? Number(dmeBiasRaw) / 10 : 0;

  const ident = col(primary, COLS.NAV_ILS_IDENT);
  const dmeNameR = vhfLineForIdent
    ? col(vhfLineForIdent, COLS.NAV_VHF_NAME)
    : "";

  return {
    ident: dmeBias !== 0 ? `${ident} - BIAS` : ident,
    type: "ILS",
    name: dmeNameR.replace(/\W/g, " ").trim(),
    freq,
    forRwy,
    locBearing: locBrg,
    lat: locLat,
    lon: locLon,
    dLat: gpLat,
    dLon: gpLon,
    stationDeclination: statDec,
    elevation: "",
    dmeBias: dmeBias || "",
    raw: primary,
  };
};

// ── extractNavaidIdents ───────────────────────────────────────────────────────
// Collects candidate navaid identifiers from all decoded procedure legs.
// Includes recomnavaid always; includes waypoint only when ≤4 chars (navaid length).
const extractNavaidIdents = (procedures) => {
  const idents = new Set();
  for (const proc of procedures ?? []) {
    for (const leg of proc.legs ?? []) {
      const nav = leg.recomnavaid?.trim();
      const wpt = leg.waypoint?.trim();
      if (nav) idents.add(nav.toUpperCase());
      if (wpt && wpt.length <= 4) idents.add(wpt.toUpperCase());
    }
  }
  return [...idents];
};

// ── parseNavaids ──────────────────────────────────────────────────────────────
// Main navaid entry point.
// rawLines   — all lines from the .ari file (already split on \n)
// navaidIdents — string[] of idents to look up (from extractNavaidIdents)
//
// Returns NavaidRecord[]:
// { ident, type, name, freq, lat, lon, dLat, dLon,
//   stationDeclination, elevation, dmeBias, forRwy?, locBearing?, raw }
const parseNavaids = (rawLines, navaidIdents) => {
  if (!rawLines?.length || !navaidIdents?.length) return [];

  const identSet = new Set(navaidIdents.map((id) => id.trim().toUpperCase()));

  // Build indexes — continuation-1 records only for VHF/NDB base records
  const vhfByIdent = new Map();
  const ndbByIdent = new Map();
  const ilsByIdent = new Map();

  for (const line of rawLines) {
    if (!line || line.length < 22) continue;

    if (isVhfLine(line) && isContinuation1(line)) {
      const id = line
        .substring(COLS.NAV_VHF_IDENT[0], COLS.NAV_VHF_IDENT[1])
        .trim();
      if (!vhfByIdent.has(id)) vhfByIdent.set(id, line);
    }

    if (isNdbLine(line) && isContinuation1(line)) {
      const id = line
        .substring(COLS.NAV_NDB_IDENT[0], COLS.NAV_NDB_IDENT[1])
        .trim();
      if (!ndbByIdent.has(id)) ndbByIdent.set(id, line);
    }

    if (isIlsLine(line)) {
      const id = line
        .substring(COLS.NAV_ILS_IDENT[0], COLS.NAV_ILS_IDENT[1])
        .trim();
      if (!ilsByIdent.has(id)) ilsByIdent.set(id, []);
      ilsByIdent.get(id).push(line);
    }
  }

  const results = [];

  for (const ident of identSet) {
    // ILS takes priority
    if (ilsByIdent.has(ident)) {
      const record = parseIlsRecord(
        ilsByIdent.get(ident),
        vhfByIdent.get(ident) ?? null,
      );
      if (record) results.push(record);
      continue;
    }

    // VHF (VOR, DME, TACAN, VOR/DME…)
    if (vhfByIdent.has(ident)) {
      results.push(parseVhfRecord(vhfByIdent.get(ident)));
      continue;
    }

    // NDB
    if (ndbByIdent.has(ident)) {
      results.push(parseNdbRecord(ndbByIdent.get(ident)));
    }
    // Not found → silently skip (may be a terminal fix, not a navaid)
  }

  return results;
};

const extractHeaderData = (line, counter) => {
  if (counter == 1) {
    // TCH:

    const thrHeight = `${
      Number(line.substring(40, 43)) == 0
        ? "NA"
        : `${Number(line.substring(40, 43)).toString()} ft`
    }`;
    // VAR:
    let pdmv = line.substring(60, 65);
    const variation = Number(pdmv.substr(1)) / 10;
    pdmv =
      variation !== 0 ? `${pdmv.substr(0, 1)} ${variation}°` : "Not available";

    return { thrHeight, pdmv };
  }
};
// ── RNP decoder — "052" → "0.05" ─────────────────────────────────────────────
const decodeRnp = (raw) => {
  if (!raw) return "";
  const digits = raw.trim();
  if (!digits) return "";
  const val = parseInt(digits.substring(0, 2), 10);
  const decimal = parseInt(digits.substring(2), 10);
  if (isNaN(val) || isNaN(decimal)) return "";
  if (decimal === 0) return val === 0 ? "" : String(val);
  const result = val / Math.pow(10, decimal);
  return result === 0 ? "" : String(result);
};
const extractSbasRNP = (line) => {
  const raw = col(line, COLS.RNPAUTH)?.replace(/N/g, "").trim().split("A");
  let RNPAUTH;
  if (raw[0] !== "")
    RNPAUTH = raw.map((rnp) => {
      return decodeRnp(rnp);
    });
  RNPAUTH = RNPAUTH == undefined ? "" : RNPAUTH;

  return {
    capabilities: [
      col(line, COLS.LPV),
      col(line, COLS.LNAV),
      col(line, COLS.LNAV),
    ]
      .filter(Boolean)
      .join(","),

    RNPAUTH,
  };
};

// ── Course — strip trailing "T" (true course) ─────────────────────────────────
const decodeCourse = (raw) => (raw ? raw.replace(/T$/, "").trim() : "");
// ── Runway parser ─────────────────────────────────────────────────────────────
const parseRunwayPrimaryRecord = (line) => ({
  icao: col(line, COLS.RWY_ICAO),
  ident: col(line, COLS.RWY_IDENT),
  length: col(line, COLS.RWY_LENGTH),
  magBrg: formatdecimals(decodeCourse(col(line, COLS.RWY_MAG_BRG))),
  lat: formatLat(col(line, COLS.RWY_LAT)),
  lon: formatLon(col(line, COLS.RWY_LON)),
  elev: decimalData(col(line, COLS.RWY_ELEV), 1),
  dthr: decimalData(col(line, COLS.RWY_DTHR), 1),
  tch: decimalData(col(line, COLS.RWY_TCH), 10),
  tchInd: col(line, COLS.RWY_TCH_IND),
  desc: col(line, COLS.RWY_DESC),
});
const parseRunwaySecondaryRecord = (line) => ({
  truebrg: col(line, COLS.RWY_TRUE_BRG),
  tdzelev: col(line, COLS.RWY_ELEV_TDZ),
});
const fetchRunwayData = (line, runways) => {
  const ident = col(line, COLS.RWY_IDENT);
  const recordType = line.substring(21, 22);

  // If no runways exist yet, initialize with primary record
  if (runways.length === 0) {
    return [parseRunwayPrimaryRecord(line)];
  }

  const existingIndex = runways.findIndex((rwy) => rwy.ident === ident);
  const existingRunway = existingIndex !== -1 ? runways[existingIndex] : null;

  let updatedRunway;

  switch (recordType) {
    case "1":
      // Primary record
      updatedRunway = parseRunwayPrimaryRecord(line);
      break;

    case "3":
      // Secondary record (merge with existing if present)
      updatedRunway = {
        ...existingRunway,
        ...parseRunwaySecondaryRecord(line),
      };
      break;

    default:
      // Unknown record type, keep existing
      updatedRunway = existingRunway;
  }

  // Update or append runway
  if (existingIndex !== -1) {
    runways[existingIndex] = updatedRunway;
  } else if (updatedRunway) {
    runways.push(updatedRunway);
  }

  return runways;
};
// ── Path point data ─────────────────────────────────────────────────────────────
const parsePathPrimaryRecord = (line) => {
  const ltpLatRaw = colStr(line, COLS.PATH_LTP_LAT);
  const ltpLonRaw = colStr(line, COLS.PATH_LTP_LON);
  const [ltpLat, ltpLon] = fmtPos(ltpLatRaw, ltpLonRaw);

  const fpapLatRaw = colStr(line, COLS.PATH_FPAP_LAT);
  const fpapLonRaw = colStr(line, COLS.PATH_FPAP_LON);
  const [fpapLat, fpapLon] = fmtPos(fpapLatRaw, fpapLonRaw);

  return {
    icao: colStr(line, COLS.PATH_ICAO),
    procedure: colStr(line, COLS.PATH_PROC),
    operation_type: colStr(line, COLS.PATH_OPRTYPE),
    sbas_service_provider_identifier: colStr(line, COLS.PATH_SBAS_IDENT),
    airportidentirer: colStr(line, COLS.PATH_APT_IDENT),
    runway: colStr(line, COLS.PATH_RWY),
    approach_performance_designator: colStr(line, COLS.PATH_APCH_DESIGNATOR),
    route_indicator: colStr(line, COLS.PATH_RTE_IND),
    reference_path_data_selector: colStr(line, COLS.PATH_REF_SEL),
    reference_path_identifier: colStr(line, COLS.PATH_REF_IND),
    ltp_latitude: ltpLat,
    ltp_longitude: ltpLon,
    ltp_ellipsoidal_height: `${colStr(line, COLS.PATH_LTP_ELP_HGT).substr(0, 1)}${decimalData(colStr(line, COLS.PATH_LTP_ELP_HGT).substr(1), 10)}`,
    fpap_latitude: fpapLat,
    fpap_longitude: fpapLon,
    threshold_crossing_height: decimalData(colStr(line, COLS.PATH_THR_HGT), 10),
    tch_units_selector: colStr(line, COLS.PATH_TCH_UNIT),
    glidepath_angle: decimalData(colStr(line, COLS.PATH_GLIDEPATH), 100),
    course_width_at_threshold: decimalData(
      colStr(line, COLS.PATH_CRS_WDT),
      100,
    ),
    length_offset: colStr(line, COLS.PATH_LGT_OFF),
    horizontal_alert_limit: decimalData(colStr(line, COLS.PATH_HOR_LMT), 10),
    vertical_alert_limit: decimalData(colStr(line, COLS.PATH_VRT_LMT), 10),
    crc_remainder: colStr(line, COLS.PATH_CRC),
  };
};
const parsePathSecondaryRecord = (line) => ({
  fpap_ellipsoid_height: `${colStr(line, COLS.PATH_LTP_ELP_HGT).substr(0, 1)}${decimalData(colStr(line, COLS.PATH_LTP_ELP_HGT).substr(1), 10)}`,
  ltp_orthometric_height: `${colStr(line, COLS.PATH_LTP_ORTH).substr(0, 1)}${decimalData(colStr(line, COLS.PATH_LTP_ORTH).substr(1), 10)}`,
  fpap_orthometric_height: `${colStr(line, COLS.PATH_FPAP_ORTH).substr(0, 1)}${decimalData(colStr(line, COLS.PATH_FPAP_ORTH).substr(1), 10)}`,
  gnss_Channel: colStr(line, COLS.PATH_GNSS),
  Approach_Type_Identifier: colStr(line, COLS.PATH_APCH_IDENT),
});

const decimalData = (st, div) => {
  return (Number(st) / div).toString();
};
const fetchPathPointData = (line, pathpoint) => {
  const ident = colStr(line, COLS.PATH_PROC);
  const recordType = line.substring(26, 27);
  // If no runways exist yet, initialize with primary record
  if (pathpoint.length === 0) {
    return [parsePathPrimaryRecord(line)];
  }

  const existingIndex = pathpoint.findIndex((rwy) => rwy.procedure === ident);
  const existingPathpoint =
    existingIndex !== -1 ? pathpoint[existingIndex] : null;

  let updatedRunway;

  switch (recordType) {
    case "1":
      // Primary record
      updatedRunway = parsePathPrimaryRecord(line);
      break;

    case "2":
      // Secondary record (merge with existing if present)
      updatedRunway = {
        ...existingPathpoint,
        ...parsePathSecondaryRecord(line),
      };
      break;

    default:
      // Unknown record type, keep existing
      updatedRunway = existingPathpoint;
  }

  // Update or append runway
  if (existingIndex !== -1) {
    pathpoint[existingIndex] = updatedRunway;
  } else if (updatedRunway) {
    pathpoint.push(updatedRunway);
  }

  return pathpoint;
};

const constructProcedureHeader = (proc, rawAri) => {
  let customerCode = rawAri
    .split("\n")
    .filter((raw) => raw.substring(0, 1) == "T")[0];
  customerCode = customerCode !== undefined ? customerCode.substring(1, 4) : "";

  const constructCustomeCode =
    customerCode !== "" ? ` - (${customerCode})` : "";
  const procedureCategory = proc.category ? ` /${proc.category}` : "";
  const firstLeg = proc.legs?.[0] ?? {};
  const header = {
    procedure: `${proc.icao ?? ""} / ${proc.procedureId ?? ""}${constructCustomeCode ?? ""} ${procedureCategory}`,
    variation: proc.pdmv ?? "",
    va: [...new Set(proc.gradient)] ?? "",
    tch: proc.thrHeight ?? "",
    gnssFms: firstLeg.gnssfms == "" ? "NA" : firstLeg.gnssfms,
    qualifier2: firstLeg.minima == "" ? "NA" : firstLeg.minima,
    qualifier3: firstLeg.sensor !== "N" ? firstLeg.sensor : ("" ?? ""),
    tl: firstLeg.ta == "" ? "NA" : firstLeg.ta,
    dmeRequired: firstLeg.sensor == "D" ? "Ticked" : "Not Ticked",
    count: String(proc.legs?.length ?? ""),
    capabilities: proc.capabilities ?? "",
    rnpauth: proc.RNPAUTH ?? "",
    cycle: proc.cycle ?? "",
    altUnits: "",
  };
  return header;
};

module.exports = {
  parseWaypoint,
  fetchRunwayData,
  parseNavaids,
  extractNavaidIdents,
  extractHeaderData,
  fetchPathPointData,
  col,
  extractSbasRNP,
  constructProcedureHeader,
};
