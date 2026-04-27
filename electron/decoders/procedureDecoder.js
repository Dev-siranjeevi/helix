/**
 * procedureDecoder.js — ARINC 424 / CIFP fixed-width record decoder.
 *
 * Decodes:
 *   - Procedure legs    (section P, stage F/D/E)
 *   - Terminal waypoints (section P, subsection E/N, or stage A/C)
 *   - Runways           (section P, stage G)
 *   - Navaids           (VHF, NDB, ILS — extracted from all raw lines)
 */

"use strict";

const {
  reformatdate,
  formatdecimals,
  gradientCleanup,
} = require("../processors/legcleanup");
const {
  fetchPathPointData,
  fetchRunwayData,
  parseWaypoint,
  parseNavaids,
  extractNavaidIdents,
  extractHeaderData,
  col,
  extractSbasRNP,
  constructProcedureHeader,
} = require("./additional/procedureContributor");

const {
  PROC_STAGE,
  ROUTE_TYPES,
  PATH_TERMINATORS,
  COLS,
} = require("./constants");

// ── Slice helper ──────────────────────────────────────────────────────────────
const s = (line, [start, end]) =>
  line
    .substring(start, end)
    .replace(/\u0000/g, "")
    .trim();

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

// ── Course — strip trailing "T" (true course) ─────────────────────────────────
const decodeCourse = (raw) => (raw ? raw.replace(/T$/, "").trim() : "");

// ── Procedure leg parser ──────────────────────────────────────────────────────
const parseLeg = (line) => {
  const legNumber = s(line, COLS.LEG_NUMBER);
  const transId = s(line, COLS.TRANSITION_ID);
  const legType = s(line, COLS.LEG_TYPE);
  // Altitude - Constructions:
  const altdesc = s(line, COLS.ALT_DESC);
  const byATC = s(line, COLS.BY_ATC);
  const altitude = s(line, COLS.ALTITUDE);
  const altitudeFromatted = reformatdate(altitude, altdesc, byATC);
  // Course - Formatting
  const crsFormatted =
    decodeCourse(s(line, COLS.CRS_MAG)) !== ""
      ? `${formatdecimals(decodeCourse(s(line, COLS.CRS_MAG)))}°`
      : "";
  // Reconstruct fixname:
  let reConstructedFixIdent =
    s(line, COLS.FIX_TYPE) == "V"
      ? `${s(line, COLS.WAYPOINT)} (VHF)`
      : s(line, COLS.WAYPOINT);

  switch (s(line, COLS.FIX_TYPE)) {
    case "V":
      // VHF as Fix
      reConstructedFixIdent = `${s(line, COLS.WAYPOINT)} (VHF)`;
      break;

    case "N":
      // NDB as Fix
      reConstructedFixIdent = `${s(line, COLS.WAYPOINT)} (NDB)`;
      break;

    default:
      // Default Fix Name.
      reConstructedFixIdent = s(line, COLS.WAYPOINT);
  }
  if (!legType || !PATH_TERMINATORS.has(legType)) return null;
  // TL / TA — handle "0" as "NA", and non-numeric as-is (e.g. "A/NA")
  let constructTA = !isNaN(s(line, COLS.TA))
    ? `${Number(s(line, COLS.TA))} ft`
    : s(line, COLS.TA);
  constructTA = constructTA.trim() === "0 ft" ? "NA" : constructTA;
  return {
    _key: `${legNumber}.${transId}`,
    legnumber: legNumber,
    transitionid: transId,
    icao: s(line, COLS.ICAO),
    countrycode: s(line, COLS.COUNTRY_CODE),
    procstage: s(line, COLS.PROC_STAGE),
    procedureId: s(line, COLS.PROCEDURE_ID),
    proceduretype: s(line, COLS.PROCEDURE_TYPE),
    category: s(line, COLS.CATEGORY),
    waypoint: s(line, COLS.WAYPOINT),
    reConstructedFixIdent,
    fixtype: s(line, COLS.FIX_TYPE),
    flyover: s(line, COLS.FLY_OVER) === "Y",
    comp: s(line, COLS.COMP),
    fixattr: s(line, COLS.FIX_ATTR),
    turndirections: s(line, COLS.TURN_DIR),
    rnp: decodeRnp(s(line, COLS.RNP)),
    legtype: legType,
    recomnavaid: s(line, COLS.RECOM_NAVAID),
    recomcountrycode: s(line, COLS.RECOM_COUNTRY),
    radius: formatdecimals(s(line, COLS.RADIUS)) / 10,
    theta: formatdecimals(s(line, COLS.THETA)),
    rho: formatdecimals(s(line, COLS.RHO)),
    crsmag: crsFormatted,
    distance: formatdecimals(s(line, COLS.DISTANCE)),
    altdesc: altdesc,
    byATC: byATC,
    altitude: altitude,
    altitudeFromatted,
    ta: `${Number(s(line, COLS.TA))} ft`,
    speed: s(line, COLS.SPEED),
    gradient: gradientCleanup(s(line, COLS.GRADIENT)),
    center: s(line, COLS.CENTER),
    gnssfms: s(line, COLS.GNSS_FMS),
    speeddec: s(line, COLS.SPEED_DEC),
    sensor: s(line, COLS.SENSOR),
    minima: s(line, COLS.MINIMA),
    cycle: s(line, COLS.CYCLE),
  };
};
// ── Missed approach tagging ───────────────────────────────────────────────────
const postProcessLegs = (legs) => {
  let inFinalSegment = false;
  let inMissedSegment = false;

  return legs.map((leg) => {
    // 🔴 Once MISSED starts, it overrides everything
    if (inMissedSegment) {
      return !leg.transitionid ? { ...leg, transitionid: "MISSED" } : leg;
    }

    // 🟢 Start FINAL when fixattr = "I"
    if (leg.fixattr === "I" || leg.fixattr === "F") {
      inFinalSegment = true;
    }

    // 🔴 Start MISSED when COMP = "M"
    if (leg.comp === "M") {
      inMissedSegment = true;
      inFinalSegment = false;

      return !leg.transitionid ? { ...leg, transitionid: "MISSED" } : leg;
    }

    // 🟢 Assign transitions only if empty
    if (!leg.transitionid) {
      if (inFinalSegment) {
        return { ...leg, transitionid: "FINAL" };
      }

      return { ...leg, transitionid: "COMMON" };
    }

    return leg;
  });
};

// ── Group legs into procedure objects ─────────────────────────────────────────
const groupIntoProcedures = (legs, raw) => {
  const map = new Map();
  const order = [];

  for (const leg of legs) {
    const id = leg.procedureId;
    if (!map.has(id)) {
      map.set(id, {
        icao: leg.icao,
        procedureId: id,
        procedureType: PROC_STAGE[leg.procstage] ?? leg.procstage,
        procstage: PROC_STAGE[leg.procstage] ?? leg.procstage,
        category: leg.category,
        cycle: leg.cycle,
        legs: [],
        segments: [],
        header: [],
      });
      order.push(id);
    }
    map.get(id).legs.push(leg);
  }

  for (const proc of map.values()) {
    proc.legs = postProcessLegs(proc.legs);
    console.log(constructProcedureHeader(proc, raw));
    let procedureCategory =
      proc.legs[0].procstage == "F"
        ? proc.legs.filter((leg) => leg.fixattr == "F")[0].category
        : proc.legs[0].category;
    proc.category = procedureCategory;
    const seen = new Set();
    for (const leg of proc.legs) {
      if (leg.transitionid && !seen.has(leg.transitionid)) {
        seen.add(leg.transitionid);
        proc.segments.push(leg.transitionid);
      }
      if (procedureCategory == leg.category) leg.category = "";
    }

    proc.cycle = proc.legs.reduce((max, l) => {
      const n = parseInt(l.cycle, 10);
      return !isNaN(n) && n > parseInt(max, 10) ? l.cycle : max;
    }, proc.cycle ?? "0");
  }

  return order.map((id) => map.get(id));
};

// ── Main entry ────────────────────────────────────────────────────────────────
const decodeProcedure = (raw) => {
  if (!raw || typeof raw !== "string") {
    return { procedures: [], waypoints: [], runways: [], navaids: [] };
  }
  let counter = 0;
  const rawLines = raw.split("\n");
  const procLegs = [];
  const waypoints = [];
  let runways = [];
  let pathPoints = [];
  const gradient = [];
  const procedureAttributes = [];
  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\r$/, "").padEnd(132, " ");
    if (line.trim().length === 0) continue;

    const subsection = line.substring(5, 6);
    const stage = line.substring(12, 13);
    // wptype: if col 5 is space, use col 12; otherwise use col 5
    const wptype = subsection === " " ? stage : subsection;
    const isWpt = ["A", "C"].includes(wptype);
    const isPrimaryWpt = line.substring(21, 22) === "1";
    const isContinuimRecord = line.substring(38, 39) === "2";
    // ── Procedure legs ──────────────────────────────────────────────────────
    if (stage === "F" || stage === "D" || stage === "E") {
      // const extractedRNPCapabilities = extractSbasRNP(line)
      if (line.substring(38, 39) == "4")
        procedureAttributes.push(extractSbasRNP(line));
      const leg = parseLeg(line);

      if (leg) procLegs.push(leg);
      // ── Variation & TCH ─────────────────────────────────────────────────────────────
      if (gradientCleanup(col(line, COLS.GRADIENT)).trim() !== "") {
        const gradientToUpload = gradientCleanup(col(line, COLS.GRADIENT));
        if (gradient.indexOf(gradientToUpload) === -1)
          gradient.push(gradientToUpload);
      }

      if (isContinuimRecord && counter == 0) {
        counter++;

        procedureAttributes.push(extractHeaderData(line, counter));
      }

      continue;
    }

    // ── Waypoints — detect by wptype logic from uploaded decoder ───────────

    if (isWpt) {
      const isWptRecord = line.substring(51, 54).trim() == "";

      if (!isPrimaryWpt) continue; // skip continuation records
      if (!isWptRecord) continue; // skip continuation records
      const wp = parseWaypoint(line);
      if (wp.ident) waypoints.push(wp);
      continue;
    }

    // ── Runways ─────────────────────────────────────────────────────────────
    if (stage === "G") {
      runways = fetchRunwayData(line, runways);
    }

    // ── Path point ─────────────────────────────────────────────────────────────
    const isPathPoint = ["H", "R"].some(
      (type) => type == col(line, COLS.PROCEDURE_TYPE),
    );
    if (stage == "P" && isPathPoint) {
      const pathPoint = fetchPathPointData(line, pathPoints);
      pathPoints = pathPoint;
    }

    // NOTE: Navaid lines (section "D", "DB", col-12 "I") are collected below
    // via the full rawLines pass in parseNavaids — no per-line handling needed here.
  }
  // Filter Runways:
  if (procLegs.length > 0 && procLegs[0].procedureId) {
    const procedureRunway = `RW${procLegs[0].procedureId.substr(1)}`;
    runways = runways.filter((rwy) => rwy.ident == procedureRunway);
  }

  let procedures = groupIntoProcedures(procLegs, raw);

  // ── Navaid extraction ─────────────────────────────────────────────────────
  // 1. Collect candidate idents from all procedure legs
  // 2. Look them up across all raw lines (VHF / NDB / ILS sections)
  const navaidIdents = extractNavaidIdents(procedures);
  const navaids = parseNavaids(rawLines, navaidIdents);
  procedures = [
    {
      ...procedures[0],
      ...procedureAttributes[0],
      ...procedureAttributes[1],
      ...{ gradient },
    },
  ];

  return {
    procedures,
    waypoints,
    runways,
    navaids,
    pathPoints,
    procedureAttributes,
  };
};

module.exports = { decodeProcedure, decodeCourse, decodeRnp };
