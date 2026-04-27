/**
 * constants.js — ARINC 424 column offsets and lookup tables.
 *
 * All ranges are [start, end] for substring(start, end) — 0-indexed, exclusive end.
 * Record width: 132 characters per line (ARINC 424-18 / CIFP format).
 */

"use strict";

// ── Record classification ─────────────────────────────────────────────────────

const PROC_STAGE = {
  F: "IAC",
  D: "SID",
  E: "STAR",
  P: "airport",
};

const ROUTE_TYPES = {
  A: "SID",
  D: "STAR",
  F: "IAC",
  R: "RNP",
  S: "STAR",
  H: "Heliport Approach",
  Z: "Approach",
};

const PATH_TERMINATORS = new Set([
  "IF",
  "TF",
  "CF",
  "DF",
  "AF",
  "RF",
  "PI",
  "CA",
  "CD",
  "CI",
  "CR",
  "FA",
  "FC",
  "FD",
  "FM",
  "HA",
  "HF",
  "HM",
  "VA",
  "VD",
  "VI",
  "VM",
  "VR",
]);

// ── Column ranges [start, end] — 0-indexed, substring(start, end) ────────────
const COLS = Object.freeze({
  // ── Procedure leg ─────────────────────────────────────────────────────────
  ICAO: [6, 10],
  COUNTRY_CODE: [10, 12],
  PROC_STAGE: [12, 13],
  PROCEDURE_ID: [13, 19],
  PROCEDURE_TYPE: [19, 20],
  TRANSITION_ID: [20, 25],
  CATEGORY: [25, 26],
  LEG_NUMBER: [26, 29],
  WAYPOINT: [29, 34],
  FIX_TYPE: [39, 40],
  FLY_OVER: [40, 41],
  COMP: [41, 42],
  FIX_ATTR: [42, 43],
  TURN_DIR: [43, 44],
  RNP: [44, 47],
  LEG_TYPE: [47, 49],
  RECOM_NAVAID: [50, 54],
  RECOM_COUNTRY: [54, 56],
  RADIUS: [57, 61],
  THETA: [62, 66],
  RHO: [66, 70],
  CRS_MAG: [70, 74],
  DISTANCE: [74, 79],
  ALT_DESC: [82, 83],
  BY_ATC: [83, 84],
  ALTITUDE: [84, 94],
  TA: [94, 99],
  SPEED: [99, 102],
  GRADIENT: [102, 106],
  CENTER: [106, 111],
  GNSS_FMS: [116, 117],
  SPEED_DEC: [117, 118],
  SENSOR: [118, 119],
  MINIMA: [119, 120],
  CYCLE: [128, 132],
  LPV: [41, 44],
  LVNAV: [52, 61],
  LNAV: [63, 67],
  RNPAUTH: [89, 104],

  // ── Waypoint (section PE/PN) ───────────────────────────────────────────────
  WP_IDENT: [13, 18],
  WP_REGION: [6, 10],
  WP_TYPE: [26, 29],
  WP_LAT: [32, 41],
  WP_LON: [41, 51],
  WP_FORMAT: [95, 96],
  WP_NAME: [98, 103],

  // ── Runway (section PG) ───────────────────────────────────────────────────
  RWY_ICAO: [6, 10],
  RWY_IDENT: [13, 18],
  RWY_LENGTH: [22, 27],
  RWY_MAG_BRG: [27, 31],
  RWY_LAT: [32, 41],
  RWY_LON: [41, 51],
  RWY_ELEV: [66, 71],
  RWY_DTHR: [71, 75],
  RWY_TCH: [95, 98],
  RWY_TCH_IND: [80, 81],
  RWY_DESC: [101, 123],
  RWY_TRUE_BRG: [51, 55],
  RWY_ELEV_TDZ: [67, 71],

  // ── VHF Navaid (section D, subsection D) ─────────────────────────────────
  // ARINC 424-20 §4.1
  NAV_VHF_IDENT: [13, 17],
  NAV_VHF_FREQ: [22, 27], // × 100 → MHz  (11030 → 110.30)
  NAV_VHF_TYPE: [27, 29], // V=VOR D=DME T=TACAN I=ILS
  NAV_VHF_LAT: [32, 41],
  NAV_VHF_LON: [41, 51],
  NAV_VHF_STATION_DEC: [51, 55], // "E035" → E3.5°
  NAV_VHF_NAME: [93, 118],
  NAV_VHF_DME_LAT: [55, 64],
  NAV_VHF_DME_LON: [64, 74],
  NAV_VHF_DME_BIAS: [90, 93], // tenths of NM
  NAV_VHF_ELEV: [79, 84],

  // ── NDB (section DB) ──────────────────────────────────────────────────────
  // ARINC 424-20 §4.2
  NAV_NDB_IDENT: [13, 17],
  NAV_NDB_FREQ: [22, 25], // × 10 → kHz  (3350 → 335.0)
  NAV_NDB_TYPE: [27, 29],
  NAV_NDB_LAT: [32, 41],
  NAV_NDB_LON: [41, 51],
  NAV_NDB_STATION_DEC: [51, 55],
  NAV_NDB_NAME: [93, 118],
  NAV_NDB_DME_LAT: [55, 64],
  NAV_NDB_DME_LON: [64, 74],
  NAV_NDB_DME_BIAS: [90, 93],

  // ── ILS / Localiser (section code col-12 = "I") ───────────────────────────
  // ARINC 424-20 §4.3
  NAV_ILS_IDENT: [13, 17],
  NAV_ILS_FREQ: [22, 27],
  NAV_ILS_FOR_RWY: [27, 31],
  NAV_ILS_LOC_LAT: [32, 41],
  NAV_ILS_LOC_LON: [41, 51],
  NAV_ILS_LOC_BRG: [51, 55], // × 10 → degrees
  NAV_ILS_GP_LAT: [55, 64],
  NAV_ILS_GP_LON: [64, 74],
  NAV_ILS_STATION_DEC: [74, 78],
  NAV_ILS_LOC_WIDTH: [80, 83],

  // ── Path point (section PG) ───────────────────────────────────────────────────
  PATH_ICAO: [6, 4],
  PATH_PROC: [13, 5],
  PATH_OPRTYPE: [25, 1],
  PATH_SBAS_IDENT: [29, 1],
  PATH_APT_IDENT: [14, 5],
  PATH_RWY: [19, 4],
  PATH_APCH_DESIGNATOR: [36, 1],
  PATH_RTE_IND: [27, 1],
  PATH_REF_SEL: [28, 1],
  PATH_REF_IND: [32, 4],
  PATH_LTP_LAT: [37, 11],
  PATH_LTP_LON: [48, 12],
  PATH_LTP_ELP_HGT: [60, 6],
  PATH_FPAP_LAT: [70, 11],
  PATH_FPAP_LON: [81, 12],
  PATH_FPAP_ELP_HGT: [29, 5],
  PATH_THR_HGT: [102, 6],
  PATH_TCH_UNIT: [107, 1],
  PATH_GLIDEPATH: [66, 4],
  PATH_CRS_WDT: [93, 5],
  PATH_LGT_OFF: [98, 4],
  PATH_HOR_LMT: [109, 3],
  PATH_VRT_LMT: [112, 3],
  PATH_CRC: [115, 8],
  PATH_LTP_ORTH: [34, 6],
  PATH_FPAP_ORTH: [40, 6],
  PATH_GNSS: [56, 5],
  PATH_APCH_IDENT: [47, 9],
});

module.exports = { PROC_STAGE, ROUTE_TYPES, PATH_TERMINATORS, COLS };
