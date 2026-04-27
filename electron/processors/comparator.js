/**
 * comparator.js — diffs two decoded .ari file objects.
 *
 * Used by the Compare page (client-side diff via Compare.jsx mirrors this).
 * Also available for future IPC-based comparison.
 */

"use strict";

const DIFF = Object.freeze({
  SAME:    "same",
  CHANGED: "changed",
  ADDED:   "added",
  REMOVED: "removed",
});

// ── Value comparison ──────────────────────────────────────────────────────────
const dv = (a, b) => {
  if (a === undefined && b !== undefined) return DIFF.ADDED;
  if (a !== undefined && b === undefined) return DIFF.REMOVED;
  return String(a ?? "") !== String(b ?? "") ? DIFF.CHANGED : DIFF.SAME;
};

// ── Header diff ───────────────────────────────────────────────────────────────
const diffHeader = (hA, hB) => {
  const keys = [...new Set([...Object.keys(hA), ...Object.keys(hB)])];
  return keys.map((key) => ({
    key,
    valueA: hA[key] ?? "",
    valueB: hB[key] ?? "",
    diff:   dv(hA[key], hB[key]),
  }));
};

// ── Leg diff ──────────────────────────────────────────────────────────────────
const LEG_FIELDS = [
  "legtype", "fixattr", "comp", "flyover", "category", "rnp",
  "waypoint", "altitude", "speed", "crsmag", "turndirections",
  "distance", "radius", "recomnavaid", "recomcountrycode",
  "theta", "rho", "gnssfms", "sensor", "minima",
];

const diffLegs = (legsA, legsB) => {
  const keyOf = (l) => l._key ?? `${l.legnumber}.${l.transitionid}`;
  const mapA  = Object.fromEntries(legsA.map((l) => [keyOf(l), l]));
  const mapB  = Object.fromEntries(legsB.map((l) => [keyOf(l), l]));
  const keys  = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];

  return keys.map((k) => {
    const lA = mapA[k];
    const lB = mapB[k];
    if (!lA) return { key: k, legnumber: lB.legnumber, transitionid: lB.transitionid, legA: null, legB: lB, diff: DIFF.ADDED,   fields: [] };
    if (!lB) return { key: k, legnumber: lA.legnumber, transitionid: lA.transitionid, legA: lA, legB: null, diff: DIFF.REMOVED, fields: [] };

    const fields    = LEG_FIELDS.map((f) => ({ field: f, valueA: lA[f] ?? "", valueB: lB[f] ?? "", diff: dv(lA[f], lB[f]) }));
    const hasChange = fields.some((f) => f.diff !== DIFF.SAME);

    return { key: k, legnumber: lA.legnumber, transitionid: lA.transitionid, legA: lA, legB: lB, diff: hasChange ? DIFF.CHANGED : DIFF.SAME, fields };
  });
};

// ── Waypoint diff ─────────────────────────────────────────────────────────────
const WP_FIELDS = ["latitude", "longitude", "type", "format", "name"];

const diffWaypoints = (wpA, wpB) => {
  const mapA = Object.fromEntries(wpA.map((w) => [w.ident, w]));
  const mapB = Object.fromEntries(wpB.map((w) => [w.ident, w]));
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];

  return keys.map((k) => {
    const wA = mapA[k];
    const wB = mapB[k];
    if (!wA) return { ident: k, wpA: null, wpB: wB, diff: DIFF.ADDED };
    if (!wB) return { ident: k, wpA: wA,   wpB: null, diff: DIFF.REMOVED };

    const fields    = WP_FIELDS.map((f) => ({ field: f, valueA: wA[f] ?? "", valueB: wB[f] ?? "", diff: dv(wA[f], wB[f]) }));
    const hasChange = fields.some((f) => f.diff !== DIFF.SAME);
    return { ident: k, wpA: wA, wpB: wB, diff: hasChange ? DIFF.CHANGED : DIFF.SAME, fields };
  });
};

// ── Raw diff — LCS ────────────────────────────────────────────────────────────
const diffRaw = (rawA, rawB) => {
  const linesA = (rawA ?? "").split("\n");
  const linesB = (rawB ?? "").split("\n");
  const n = linesA.length;
  const m = linesB.length;

  // LCS DP table
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = linesA[i] === linesB[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const result = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && linesA[i] === linesB[j]) {
      result.push({ diff: DIFF.SAME,    lineA: i + 1, lineB: j + 1, text: linesA[i] });
      i++; j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ diff: DIFF.ADDED,   lineA: null,  lineB: j + 1, text: linesB[j] });
      j++;
    } else {
      result.push({ diff: DIFF.REMOVED, lineA: i + 1, lineB: null,  text: linesA[i] });
      i++;
    }
  }
  return result;
};

// ── Summary ───────────────────────────────────────────────────────────────────
const summarise = (arr) => ({
  changed: arr.filter((r) => r.diff === DIFF.CHANGED).length,
  added:   arr.filter((r) => r.diff === DIFF.ADDED).length,
  removed: arr.filter((r) => r.diff === DIFF.REMOVED).length,
  total:   arr.length,
});

// ── Main ──────────────────────────────────────────────────────────────────────
const compare = (fileA, fileB, procIdA, procIdB) => {
  const procA = (fileA.procedures ?? []).find((p) => p.procedureId === procIdA)
    ?? fileA.procedures?.[0] ?? {};
  const procB = (fileB.procedures ?? []).find((p) => p.procedureId === procIdB)
    ?? fileB.procedures?.[0] ?? {};

  const headerDiff   = diffHeader(procA.header ?? {}, procB.header ?? {});
  const legDiff      = diffLegs(procA.legs   ?? fileA.legs   ?? [], procB.legs   ?? fileB.legs   ?? []);
  const waypointDiff = diffWaypoints(fileA.waypoints ?? [],          fileB.waypoints ?? []);
  const rawDiff      = diffRaw(fileA.raw ?? "",                      fileB.raw ?? "");

  return {
    headerDiff, legDiff, waypointDiff, rawDiff,
    summary: {
      header:    summarise(headerDiff),
      legs:      summarise(legDiff),
      waypoints: summarise(waypointDiff),
      raw:       summarise(rawDiff),
    },
  };
};

module.exports = { compare, DIFF };
