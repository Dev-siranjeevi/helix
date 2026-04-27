/**
 * fileProcessor.js — two-mode file processor.
 *
 * statFile(ariPath)       → lightweight stub for sidebar (no decode)
 * openFile(ariPath)       → full decode on user click
 * processSavFile(savPath) → re-opens paired ARI when SAV changes
 *
 * Decoded object shape:
 * {
 *   path, name, size, modified, hasSav,
 *   procedures, waypoints, runways, navaids,
 *   validation, raw, savRaw, _stub: false
 * }
 */

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const { decodeProcedure } = require("./decoders/procedureDecoder");
const { mergeDecoded } = require("./processors/merger");
const { validate } = require("./processors/validator");

// ── Helpers ───────────────────────────────────────────────────────────────────
const getStats = async (filePath) => {
  const s = await fs.stat(filePath);
  return { size: s.size, modified: s.mtimeMs };
};

const findSav = async (ariPath) => {
  const savPath = path.join(
    path.dirname(ariPath),
    `${path.basename(ariPath, ".ari")}.sav`,
  );
  try {
    await fs.access(savPath, fs.constants.R_OK);
    return savPath;
  } catch {
    return null;
  }
};

// ── statFile — metadata only, no I/O beyond stat ─────────────────────────────
const statFile = async (ariPath) => {
  const [stats, savPath] = await Promise.all([
    getStats(ariPath),
    findSav(ariPath),
  ]);

  return {
    path: ariPath,
    name: path.basename(ariPath, ".ari"),
    size: stats.size,
    modified: stats.modified,
    hasSav: savPath !== null,
    _stub: true,
  };
};

// ── openFile — full decode on demand ─────────────────────────────────────────
const openFile = async (ariPath) => {
  const stem = path.basename(ariPath, ".ari");
  const savPath = await findSav(ariPath);

  const [rawAri, stats] = await Promise.all([
    fs.readFile(ariPath, "utf-8"),
    getStats(ariPath),
  ]);

  let decoded = decodeProcedure(rawAri);
  let hasSav = false;
  let savRaw = null;

  let customerCode = rawAri
    .split("\n")
    .filter((raw) => raw.substring(0, 1) == "T")[0];
  customerCode = customerCode !== undefined ? customerCode.substring(1, 4) : "";

  if (savPath) {
    try {
      savRaw = await fs.readFile(savPath, "utf-8");
      decoded = mergeDecoded(decoded, decodeProcedure(savRaw));
      hasSav = true;
      console.log(`[fileProcessor] Merged SAV: ${stem}`);
    } catch (err) {
      console.warn(`[fileProcessor] SAV read failed for ${stem}:`, err.message);
    }
  }

  const validation = validate(decoded);

  return {
    path: ariPath,
    name: stem,
    size: stats.size,
    modified: stats.modified,
    hasSav,
    procedures: decoded.procedures ?? [],
    waypoints: decoded.waypoints ?? [],
    runways: decoded.runways ?? [],
    navaids: decoded.navaids ?? [], // ← navaid records
    pathPoints: decoded.pathPoints ?? [], // ← navaid records
    validation,
    customerCode,
    raw: rawAri,
    savRaw,
    _stub: false,
  };
};

// ── processSavFile — re-open paired ARI when SAV changes ─────────────────────
const processSavFile = async (savPath) => {
  const stem = path.basename(savPath, ".sav");
  const ariPath = path.join(path.dirname(savPath), `${stem}.ari`);

  try {
    await fs.access(ariPath, fs.constants.R_OK);
  } catch {
    throw new Error(`Paired .ari not found for "${stem}.sav"`);
  }
  return openFile(ariPath);
};

module.exports = { statFile, openFile, processSavFile };
