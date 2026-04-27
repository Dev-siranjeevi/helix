/**
 * validator.js — validates decoded procedure data.
 * Returns { valid, errors, warnings }.
 */

"use strict";

const { PATH_TERMINATORS } = require("../decoders/constants");

const validate = (decoded) => {
  const errors   = [];
  const warnings = [];

  if (!decoded?.procedures?.length) {
    errors.push("No procedures found in file");
    return { valid: false, errors, warnings };
  }

  for (const proc of decoded.procedures) {
    const id = proc.procedureId ?? "(unknown)";

    if (!proc.legs?.length) {
      errors.push(`${id}: no legs found`);
      continue;
    }

    for (const leg of proc.legs) {
      const ref = `${id} leg ${leg.legnumber}/${leg.transitionid}`;

      // Unknown path terminator
      if (leg.legtype && !PATH_TERMINATORS.has(leg.legtype)) {
        warnings.push(`${ref}: unknown path terminator "${leg.legtype}"`);
      }

      // First leg should be IF (or hold types)
      if (leg.legnumber === "010" && leg.legtype
          && !["IF", "HA", "HF", "HM"].includes(leg.legtype)) {
        warnings.push(`${ref}: first leg is "${leg.legtype}", expected IF`);
      }
    }

    // Check fix references exist in waypoints
    const wpIdents = new Set((decoded.waypoints ?? []).map((w) => w.ident));
    const missingFixes = [
      ...new Set(proc.legs.map((l) => l.waypoint).filter(Boolean)),
    ].filter((fix) => !wpIdents.has(fix));

    for (const fix of missingFixes) {
      warnings.push(`${id}: fix "${fix}" not found in waypoints`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};

module.exports = { validate };
