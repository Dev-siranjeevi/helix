/**
 * diffEngine.js — ARINC 424 diff engine for Helix.
 *
 * Ported from reader/compare/helper/findchanges.js and
 * reader/compare/compareutils.js (the "old reader" logic).
 *
 * Key design:
 *  - Per-transition comparison: same-length → positional index-by-index;
 *    different-length → keyed map (fixattr/comp for FINAL, legnumber prefix otherwise).
 *  - Changed field values are stored STACKED: field.value = newVal, field.oldValue = oldVal.
 *  - Added/removed legs carry _diff = "added" / "removed" on the whole leg.
 *  - Added/removed transitions cross-checked for rename (same content, different id).
 *  - Waypoint, navaid, runway, minima and header diffs follow the same pattern.
 *  - Raw LCS diff filtered to the active procedure line range.
 *
 * Status constants: "same" | "changed" | "added" | "removed"
 */

// ES module — strict mode is implicit

const DIFF = Object.freeze({
  SAME:    "same",
  CHANGED: "changed",
  ADDED:   "added",
  REMOVED: "removed",
});

const LEG_FIELDS = [
  "legtype","fixattr","comp","flyover","category","rnp",
  "waypoint","altitude","speed","crsmag","turndirections",
  "distance","radius","recomnavaid","recomcountrycode",
  "theta","rho","gnssfms","sensor","minima",
];
const WP_FIELDS  = ["latitude","longitude","type","format","name"];
const NAV_FIELDS = ["type","name","freq","lat","lon","dLat","dLon","stationDeclination","dmeBias"];
const MINIMA_FIELDS = [
  "routeIndicator","refPathDataSelector","refPathIdentifier",
  "ltpLat","ltpLon","ltpEllipsoidalHeight","fpapLat","fpapLon",
  "glidepathAngle","courseWidthAtThreshold","lengthOffset",
  "thresholdCrossingHeight","tchUnits","horizontalAlertLimit",
  "verticalAlertLimit","crcRemainder","ltpOrthometricHeight",
  "fpapOrthometricHeight","gnssChannel",
];
const HEADER_FIELDS = [
  "icao","procedureId","procedureType","procstage","cycle",
  "gradient","variation","sensor","minima","tch",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const cloneLeg = (leg) => {
  const out = {};
  for (const k of Object.keys(leg)) {
    out[k] = typeof leg[k] === "object" && leg[k] !== null ? { ...leg[k] } : leg[k];
  }
  return out;
};

const markLeg = (leg, status) => {
  const copy = cloneLeg(leg);
  copy._diff    = status;
  copy._status  = status;
  return copy;
};

const getLegKey = (leg, transId, prefix) => {
  if (transId === "FINAL") {
    if (leg.fixattr) return leg.fixattr;
    if (leg.comp)    return leg.comp;
  }
  return (leg.legnumber ?? "").substring(0, prefix);
};

const transSig = (legs) =>
  legs.map((l) => `${l.legtype ?? ""}${l.waypoint ?? ""}`).join(",");

// ── Per-transition leg diff ───────────────────────────────────────────────────

const diffTransitionLegs = (legsA, legsB, transId) => {
  const isSame = legsA.length === legsB.length;

  const suffA = [...new Set(legsA.map((l) => (l.legnumber ?? "").substring(2)))];
  const suffB = [...new Set(legsB.map((l) => (l.legnumber ?? "").substring(2)))];
  const prefix = suffA.length === 1 && suffB.length === 1 ? 2 : 3;

  if (isSame) {
    return legsA.map((legA, idx) => {
      const legB   = legsB[idx];
      const result = cloneLeg(legA);
      let hasChange = false;

      for (const field of LEG_FIELDS) {
        const vA = String(legA[field] ?? "");
        const vB = String(legB[field] ?? "");
        if (vA !== vB) {
          // value = newer (B), oldValue = older (A) — UI shows new on top, old struck-through
          result[field] = { value: vB, oldValue: vA, ClassToSet: ["changed"], diff: DIFF.CHANGED };
          hasChange = true;
        } else {
          result[field] = { value: vA, oldValue: "", ClassToSet: [], diff: DIFF.SAME };
        }
      }

      result._diff    = hasChange ? DIFF.CHANGED : DIFF.SAME;
      result._transId = transId;
      result._key     = `${transId}:${result.legnumber ?? ""}:${idx}`;
      return result;
    });
  }

  const mapA = new Map(legsA.map((l) => [getLegKey(l, transId, prefix), l]));
  const mapB = new Map(legsB.map((l) => [getLegKey(l, transId, prefix), l]));
  const allKeys = [...mapA.keys(), ...[...mapB.keys()].filter((k) => !mapA.has(k))];

  const merged = [];
  for (const key of allKeys) {
    const legA = mapA.get(key);
    const legB = mapB.get(key);

    if (!legA) {
      const r = markLeg(legB, DIFF.ADDED);
      r._transId = transId;
      merged.push(r);
      continue;
    }
    if (!legB) {
      const r = markLeg(legA, DIFF.REMOVED);
      r._transId = transId;
      merged.push(r);
      continue;
    }

    const result = cloneLeg(legA);
    let hasChange = false;
    for (const field of LEG_FIELDS) {
      const vA = String(legA[field] ?? "");
      const vB = String(legB[field] ?? "");
      if (vA !== vB) {
        // value = newer (B), oldValue = older (A)
        result[field] = { value: vB, oldValue: vA, ClassToSet: ["changed"], diff: DIFF.CHANGED };
        hasChange = true;
      } else {
        result[field] = { value: vA, oldValue: "", ClassToSet: [], diff: DIFF.SAME };
      }
    }
    result._diff    = hasChange ? DIFF.CHANGED : DIFF.SAME;
    result._transId = transId;
    merged.push(result);
  }

  merged.sort((a, b) => {
    const na = Number((a.legnumber ?? "").replace(/\D/g, "") || 0);
    const nb = Number((b.legnumber ?? "").replace(/\D/g, "") || 0);
    return na - nb;
  });

  // Stamp a guaranteed-unique _key on every result leg
  merged.forEach((leg, i) => {
    leg._key = `${leg._transId ?? transId}:${leg.legnumber ?? ""}:${i}`;
  });

  return merged;
};

// ── Full transition-aware leg diff ────────────────────────────────────────────

const diffLegs = (procA, procB) => {
  const legsA = procA.legs ?? [];
  const legsB = procB.legs ?? [];

  const transA = [...new Set(legsA.map((l) => l.transitionid))];
  const transB = [...new Set(legsB.map((l) => l.transitionid))];
  const setA   = new Set(transA);
  const setB   = new Set(transB);

  const addedTrans   = transB.filter((t) => !setA.has(t));
  const removedTrans = transA.filter((t) => !setB.has(t));
  const sharedTrans  = transA.filter((t) => setB.has(t));

  const addedSigs   = new Map(addedTrans.map((t)   => [transSig(legsB.filter((l) => l.transitionid === t)), t]));
  const removedSigs = new Map(removedTrans.map((t) => [transSig(legsA.filter((l) => l.transitionid === t)), t]));

  const result = [];

  for (const transId of sharedTrans) {
    const tA = legsA.filter((l) => l.transitionid === transId);
    const tB = legsB.filter((l) => l.transitionid === transId);
    result.push(...diffTransitionLegs(tA, tB, transId));
  }

  for (const transId of addedTrans) {
    const sig = transSig(legsB.filter((l) => l.transitionid === transId));
    if (removedSigs.has(sig)) continue;
    legsB.filter((l) => l.transitionid === transId).forEach((leg, i) => {
      const r = markLeg(leg, DIFF.ADDED);
      r._transId = transId;
      r._key     = `${transId}:${r.legnumber ?? ""}:added:${i}`;
      result.push(r);
    });
  }

  for (const transId of removedTrans) {
    const sig = transSig(legsA.filter((l) => l.transitionid === transId));
    if (addedSigs.has(sig)) continue;
    legsA.filter((l) => l.transitionid === transId).forEach((leg, i) => {
      const r = markLeg(leg, DIFF.REMOVED);
      r._transId = transId;
      r._key     = `${transId}:${r.legnumber ?? ""}:removed:${i}`;
      result.push(r);
    });
  }

  return result;
};

// ── Header diff ───────────────────────────────────────────────────────────────

const diffHeader = (procA, procB) =>
  HEADER_FIELDS.map((k) => {
    const vA   = String(procA[k] ?? "");
    const vB   = String(procB[k] ?? "");
    const diff = vA !== vB ? DIFF.CHANGED : DIFF.SAME;
    return { key: k, valueA: vA, valueB: vB, oldValue: vA, diff };
  });

// ── Waypoint diff ─────────────────────────────────────────────────────────────

const diffWaypoints = (wpA, wpB) => {
  const mapA = Object.fromEntries((wpA ?? []).map((w) => [w.ident, w]));
  const mapB = Object.fromEntries((wpB ?? []).map((w) => [w.ident, w]));
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];

  return keys.map((k) => {
    const a = mapA[k], b = mapB[k];
    if (!a) return { ident: k, wpA: null, wpB: b, diff: DIFF.ADDED,   fields: [] };
    if (!b) return { ident: k, wpA: a,   wpB: null, diff: DIFF.REMOVED, fields: [] };

    const fields = WP_FIELDS.map((f) => ({
      field: f,
      valueA: String(a[f] ?? ""), valueB: String(b[f] ?? ""), oldValue: String(a[f] ?? ""),
      diff:   String(a[f] ?? "") !== String(b[f] ?? "") ? DIFF.CHANGED : DIFF.SAME,
    }));
    return {
      ident: k, wpA: a, wpB: b,
      diff: fields.some((f) => f.diff !== DIFF.SAME) ? DIFF.CHANGED : DIFF.SAME,
      fields,
    };
  });
};

// ── Navaid diff ───────────────────────────────────────────────────────────────

const diffNavaids = (navA, navB) => {
  const mapA = Object.fromEntries((navA ?? []).map((n) => [n.ident, n]));
  const mapB = Object.fromEntries((navB ?? []).map((n) => [n.ident, n]));
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];

  return keys.map((k) => {
    const a = mapA[k], b = mapB[k];
    if (!a) return { ident: k, navA: null, navB: b, diff: DIFF.ADDED,   fields: [] };
    if (!b) return { ident: k, navA: a,   navB: null, diff: DIFF.REMOVED, fields: [] };

    const fields = NAV_FIELDS.map((f) => ({
      field: f,
      valueA: String(a[f] ?? ""), valueB: String(b[f] ?? ""), oldValue: String(a[f] ?? ""),
      diff:   String(a[f] ?? "") !== String(b[f] ?? "") ? DIFF.CHANGED : DIFF.SAME,
    }));
    return {
      ident: k, navA: a, navB: b,
      diff: fields.some((f) => f.diff !== DIFF.SAME) ? DIFF.CHANGED : DIFF.SAME,
      fields,
    };
  });
};

// ── Minima diff ───────────────────────────────────────────────────────────────

const diffMinima = (minimaA, minimaB) => {
  const key = (m) => m.procedureKey ?? m.routeIndicator ?? JSON.stringify(m);
  const mapA = Object.fromEntries((minimaA ?? []).map((m) => [key(m), m]));
  const mapB = Object.fromEntries((minimaB ?? []).map((m) => [key(m), m]));
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])];

  return keys.map((k) => {
    const a = mapA[k], b = mapB[k];
    if (!a) return { key: k, mA: null, mB: b, diff: DIFF.ADDED,   fields: [] };
    if (!b) return { key: k, mA: a,   mB: null, diff: DIFF.REMOVED, fields: [] };

    const fields = MINIMA_FIELDS.map((f) => ({
      field: f,
      valueA: String(a[f] ?? ""), valueB: String(b[f] ?? ""), oldValue: String(a[f] ?? ""),
      diff:   String(a[f] ?? "") !== String(b[f] ?? "") ? DIFF.CHANGED : DIFF.SAME,
    }));
    return {
      key: k, mA: a, mB: b,
      diff: fields.some((f) => f.diff !== DIFF.SAME) ? DIFF.CHANGED : DIFF.SAME,
      fields,
    };
  });
};

// ── Raw LCS diff ──────────────────────────────────────────────────────────────

const filterRawToProc = (raw, procId, icao) => {
  if (!raw || (!procId && !icao)) return raw ?? "";
  return raw.split("\n").filter((line) => {
    if (!line || line.length < 19) return false;
    const lineIcao   = line.substring(6,  10).trim();
    const lineProcId = line.substring(13, 19).trim();
    return (!icao || lineIcao === icao) && (!procId || lineProcId === procId);
  }).join("\n");
};

const diffRaw = (rawA, rawB, procId, icao) => {
  const fA = filterRawToProc(rawA, procId, icao);
  const fB = filterRawToProc(rawB, procId, icao);
  const lA = fA.split("\n"), lB = fB.split("\n");
  const n = lA.length, m = lB.length;

  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = lA[i] === lB[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);

  const result = []; let ri = 0, rj = 0;
  while (ri < n || rj < m) {
    if (ri < n && rj < m && lA[ri] === lB[rj]) {
      result.push({ diff: DIFF.SAME,    lineA: ri+1, lineB: rj+1, text: lA[ri] }); ri++; rj++;
    } else if (rj < m && (ri >= n || dp[ri][rj+1] >= dp[ri+1][rj])) {
      result.push({ diff: DIFF.ADDED,   lineA: null,  lineB: rj+1, text: lB[rj] }); rj++;
    } else {
      result.push({ diff: DIFF.REMOVED, lineA: ri+1, lineB: null,  text: lA[ri] }); ri++;
    }
  }
  return result;
};

// ── Summary ───────────────────────────────────────────────────────────────────

const summarise = (arr) => ({
  changed: arr.filter((r) => r.diff === DIFF.CHANGED || r._diff === DIFF.CHANGED).length,
  added:   arr.filter((r) => r.diff === DIFF.ADDED   || r._diff === DIFF.ADDED).length,
  removed: arr.filter((r) => r.diff === DIFF.REMOVED || r._diff === DIFF.REMOVED).length,
  total:   arr.length,
});

// ── Validation ────────────────────────────────────────────────────────────────

const validateForCompare = (procA, procB) => {
  const reasons = [];
  if (!procA || !procB) return { ok: false, reasons: ["Missing procedure data"] };
  if (procA.icao      !== procB.icao)      reasons.push(`Different ICAOs: ${procA.icao} vs ${procB.icao}`);
  if (procA.procstage !== procB.procstage) reasons.push(`Different procedure types: ${procA.procstage} vs ${procB.procstage}`);
  return { ok: reasons.length === 0, reasons };
};

// ── Main entry ────────────────────────────────────────────────────────────────

const buildDiff = (fileA, fileB, procIdA, procIdB, transA, transB) => {
  let procA =
    (fileA?.procedures ?? []).find((p) => p.procedureId === procIdA) ??
    fileA?.procedures?.[0] ?? {};
  let procB =
    (fileB?.procedures ?? []).find((p) => p.procedureId === procIdB) ??
    fileB?.procedures?.[0] ?? {};

  // Ensure A = older cycle, B = newer cycle
  const cA = parseInt(procA.cycle ?? "0", 10);
  const cB = parseInt(procB.cycle ?? "0", 10);
  if (!isNaN(cA) && !isNaN(cB) && cA > cB) {
    [procA, procB] = [procB, procA];
    [fileA, fileB] = [fileB, fileA];
  }

  const filteredProcA = transA
    ? { ...procA, legs: (procA.legs ?? []).filter((l) => l.transitionid === transA) }
    : procA;
  const filteredProcB = transB
    ? { ...procB, legs: (procB.legs ?? []).filter((l) => l.transitionid === transB) }
    : procB;

  const headerDiff   = diffHeader(procA, procB);
  const legDiff      = diffLegs(filteredProcA, filteredProcB);
  const waypointDiff = diffWaypoints(fileA?.waypoints,  fileB?.waypoints);
  const navaidDiff   = diffNavaids(fileA?.navaids,      fileB?.navaids);
  const minimaDiff   = diffMinima(fileA?.pathPoints,    fileB?.pathPoints);
  const rawDiff      = diffRaw(fileA?.raw, fileB?.raw, procA.procedureId, procA.icao);

  return {
    headerDiff, legDiff, waypointDiff, navaidDiff, minimaDiff, rawDiff,
    summary: {
      header:    summarise(headerDiff),
      legs:      summarise(legDiff),
      waypoints: summarise(waypointDiff),
      navaids:   summarise(navaidDiff),
      minima:    summarise(minimaDiff),
      raw:       summarise(rawDiff),
    },
  };
};

// ── Exports ───────────────────────────────────────────────────────────────────
export { buildDiff, validateForCompare, DIFF, LEG_FIELDS, WP_FIELDS, NAV_FIELDS, MINIMA_FIELDS, HEADER_FIELDS };
