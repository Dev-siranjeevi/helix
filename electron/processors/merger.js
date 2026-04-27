/**
 * merger.js — merges SAV decoded data into ARI decoded data at record level.
 *
 * Strategy: ARI always wins on conflict. SAV only contributes records
 * that are absent from the ARI.
 *
 * Merges: procedures, waypoints, runways, navaids.
 */

"use strict";

const mergeProcedures = (ariProcs, savProcs) => {
  const ariMap = new Map(ariProcs.map((p) => [p.procedureId, p]));

  for (const savProc of savProcs) {
    const ariProc = ariMap.get(savProc.procedureId);

    if (!ariProc) {
      ariMap.set(savProc.procedureId, {
        ...savProc,
        _savLegs: new Set(savProc.legs.map((l) => l._key)),
      });
      continue;
    }

    const ariKeys     = new Set(ariProc.legs.map((l) => l._key));
    const savOnlyLegs = savProc.legs.filter((l) => !ariKeys.has(l._key));

    ariProc.legs     = [...ariProc.legs, ...savOnlyLegs];
    ariProc._savLegs = new Set(savOnlyLegs.map((l) => l._key));

    const seen = new Set(ariProc.segments);
    for (const seg of savProc.segments) {
      if (!seen.has(seg)) { seen.add(seg); ariProc.segments.push(seg); }
    }
  }

  return [...ariMap.values()];
};

const mergeDecoded = (decodedAri, decodedSav) => {

  const procedures = mergeProcedures(
    decodedAri.procedures ?? [],
    decodedSav.procedures ?? [],
  );

  // Waypoints — ARI wins on ident conflict
  const ariWpSet  = new Set((decodedAri.waypoints ?? []).map((w) => w.ident));
  const waypoints = [
    ...(decodedAri.waypoints ?? []),
    ...(decodedSav.waypoints ?? []).filter((w) => !ariWpSet.has(w.ident)),
  ];

  // Runways — ARI wins on ident conflict
  const ariRwySet = new Set((decodedAri.runways ?? []).map((r) => r.ident));
  const runways   = [
    ...(decodedAri.runways ?? []),
    ...(decodedSav.runways ?? []).filter((r) => !ariRwySet.has(r.ident)),
  ];

  // Navaids — ARI wins on ident conflict
  const ariNavSet = new Set((decodedAri.navaids ?? []).map((n) => n.ident));
  const navaids   = [
    ...(decodedAri.navaids ?? []),
    ...(decodedSav.navaids ?? []).filter((n) => !ariNavSet.has(n.ident)),
  ];

  return { procedures, waypoints, runways, navaids };
};

module.exports = { mergeDecoded };
