/**
 * RawViewer
 *
 * Fixed-width ARINC 424 raw text viewer with floating find/replace bar.
 *
 * Features:
 *   Ctrl+F        → open find bar
 *   Ctrl+H        → open find + replace bar
 *   Escape        → close bar
 *   Enter         → next match
 *   Shift+Enter   → previous match
 *   Regex on by default, case-insensitive toggle
 *   All matches highlighted simultaneously
 *   Active match scrolled into view
 *   Replace writes back to disk via IPC → watcher re-decodes automatically
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const writeFile = (fp, data) => window.electronAPI?.writeFile(fp, data);

// ── Build match index from raw text ──────────────────────────────────────────
const buildMatches = (raw, pattern, caseSensitive) => {
  if (!pattern) return [];
  try {
    const flags = caseSensitive ? "g" : "gi";
    const re    = new RegExp(pattern, flags);
    const matches = [];
    let m;
    while ((m = re.exec(raw)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
      if (m[0].length === 0) re.lastIndex++; // avoid infinite loop on zero-width match
    }
    return matches;
  } catch {
    return []; // invalid regex
  }
};

// ── Map global char offsets → line numbers ───────────────────────────────────
const buildLineIndex = (raw) => {
  const index = [0]; // index[i] = char offset of start of line i
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\n") index.push(i + 1);
  }
  return index;
};

const charOffsetToLine = (lineIndex, offset) => {
  let lo = 0, hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo; // 0-indexed line number
};

// ── Highlight a single line's text into React spans ──────────────────────────
const highlightLine = (text, lineMatches, activeMatchId, matchIdStart) => {
  if (!lineMatches.length) return text || " ";

  const parts = [];
  let cursor   = 0;
  let localId  = matchIdStart;

  for (const { start, end } of lineMatches) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    const isActive = localId === activeMatchId;
    parts.push(
      <mark
        key={localId}
        className={`raw-match ${isActive ? "raw-match--active" : ""}`}
        data-matchid={localId}
      >
        {text.slice(start, end)}
      </mark>
    );
    localId++;
    cursor = end;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

// ── Find bar ─────────────────────────────────────────────────────────────────
function FindBar({
  mode, pattern, replace,
  caseSensitive, isRegexValid,
  matchCount, activeMatch,
  onPatternChange, onReplaceChange,
  onCaseSensitiveToggle,
  onNext, onPrev,
  onReplace, onReplaceAll,
  onClose,
  inputRef,
}) {
  return (
    <div className="raw-findbar">
      <div className="raw-findbar__row">

        {/* Find input */}
        <div className={`raw-findbar__input-wrap ${!isRegexValid ? "raw-findbar__input-wrap--error" : ""}`}>
          <span className="raw-findbar__regex-icon" title="Regex always on">.*</span>
          <input
            ref={inputRef}
            className="raw-findbar__input"
            placeholder="Find (regex)"
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
              if (e.key === "Escape") onClose();
            }}
            spellCheck={false}
          />
          <button
            className={`raw-findbar__toggle ${caseSensitive ? "raw-findbar__toggle--active" : ""}`}
            title="Match case"
            onClick={onCaseSensitiveToggle}
          >Aa</button>
        </div>

        {/* Match counter */}
        <span className="raw-findbar__count">
          {matchCount === 0 ? (pattern ? "no matches" : "") : `${activeMatch + 1} / ${matchCount}`}
        </span>

        {/* Navigation */}
        <button className="raw-findbar__nav" onClick={onPrev} title="Previous (Shift+Enter)" disabled={matchCount === 0}>
          <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
            <path d="M2 7l3-4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="raw-findbar__nav" onClick={onNext} title="Next (Enter)" disabled={matchCount === 0}>
          <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
            <path d="M2 3l3 4 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Close */}
        <button className="raw-findbar__close" onClick={onClose} title="Close (Escape)">
          <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Replace row */}
      {mode === "replace" && (
        <div className="raw-findbar__row raw-findbar__row--replace">
          <div className="raw-findbar__input-wrap">
            <input
              className="raw-findbar__input"
              placeholder="Replace"
              value={replace}
              onChange={(e) => onReplaceChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
              spellCheck={false}
            />
          </div>
          <button
            className="raw-findbar__action"
            onClick={onReplace}
            disabled={matchCount === 0}
            title="Replace current match"
          >
            Replace
          </button>
          <button
            className="raw-findbar__action"
            onClick={onReplaceAll}
            disabled={matchCount === 0}
            title="Replace all matches"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RawViewer({ raw, filePath, onRawChange }) {
  const [findOpen,      setFindOpen]      = useState(false);
  const [mode,          setMode]          = useState("find");   // "find" | "replace"
  const [pattern,       setPattern]       = useState("");
  const [replace,       setReplace]       = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatch,   setActiveMatch]   = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState(null);

  const inputRef    = useRef(null);
  const scrollRef   = useRef(null);
  const activeRef   = useRef(null);

  // Build match index
  const matches   = useMemo(() => buildMatches(raw ?? "", pattern, caseSensitive), [raw, pattern, caseSensitive]);
  const lineIndex = useMemo(() => buildLineIndex(raw ?? ""), [raw]);
  const lines     = useMemo(() => (raw ?? "").split("\n"), [raw]);
  const isRegexValid = useMemo(() => {
    if (!pattern) return true;
    try { new RegExp(pattern); return true; } catch { return false; }
  }, [pattern]);

  // Map each match to its line
  const matchesByLine = useMemo(() => {
    const map = new Map(); // lineNum → [{ start, end, matchId }]
    matches.forEach((m, id) => {
      const lineNum   = charOffsetToLine(lineIndex, m.index);
      const lineStart = lineIndex[lineNum];
      if (!map.has(lineNum)) map.set(lineNum, []);
      map.get(lineNum).push({ start: m.index - lineStart, end: m.index - lineStart + m.length, matchId: id });
    });
    return map;
  }, [matches, lineIndex]);

  // Clamp activeMatch when matches change
  useEffect(() => {
    setActiveMatch((prev) => (matches.length ? Math.min(prev, matches.length - 1) : 0));
  }, [matches.length]);

  // Scroll active match into view
  useEffect(() => {
    if (!matches.length) return;
    // Find the DOM mark element with data-matchid
    const el = scrollRef.current?.querySelector(`[data-matchid="${activeMatch}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatch, matches.length]);

  // Keyboard shortcut — Ctrl+F / Ctrl+H
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); openBar("find"); }
      if (e.ctrlKey && e.key === "h") { e.preventDefault(); openBar("replace"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openBar = (m) => {
    setMode(m);
    setFindOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeBar = () => { setFindOpen(false); setPattern(""); setReplace(""); setSaveError(null); };

  const next = useCallback(() => {
    setActiveMatch((prev) => (prev + 1) % Math.max(matches.length, 1));
  }, [matches.length]);

  const prev = useCallback(() => {
    setActiveMatch((prev) => (prev - 1 + Math.max(matches.length, 1)) % Math.max(matches.length, 1));
  }, [matches.length]);

  // ── Replace helpers ─────────────────────────────────────────────────────
  const doWrite = async (newRaw) => {
    setSaving(true);
    setSaveError(null);
    try {
      await writeFile(filePath, newRaw);
      onRawChange?.(newRaw); // optimistic update in renderer
    } catch (err) {
      setSaveError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const doReplace = async () => {
    if (!matches.length || !isRegexValid) return;
    const m   = matches[activeMatch];
    const newRaw = (raw ?? "").slice(0, m.index) + replace + (raw ?? "").slice(m.index + m.length);
    await doWrite(newRaw);
  };

  const doReplaceAll = async () => {
    if (!matches.length || !isRegexValid) return;
    try {
      const flags  = caseSensitive ? "g" : "gi";
      const re     = new RegExp(pattern, flags);
      const newRaw = (raw ?? "").replace(re, replace);
      await doWrite(newRaw);
    } catch (err) {
      setSaveError("Replace failed: " + err.message);
    }
  };

  // ── Compute first match id on each line ─────────────────────────────────
  const lineMatchIdStart = useMemo(() => {
    const map = new Map();
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      map.set(i, count);
      count += matchesByLine.get(i)?.length ?? 0;
    }
    return map;
  }, [lines.length, matchesByLine]);

  return (
    <div className="rawviewer">

      {/* Floating find bar */}
      {findOpen && (
        <FindBar
          mode={mode}
          pattern={pattern}
          replace={replace}
          caseSensitive={caseSensitive}
          isRegexValid={isRegexValid}
          matchCount={matches.length}
          activeMatch={activeMatch}
          onPatternChange={(v) => { setPattern(v); setActiveMatch(0); }}
          onReplaceChange={setReplace}
          onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
          onNext={next}
          onPrev={prev}
          onReplace={doReplace}
          onReplaceAll={doReplaceAll}
          onClose={closeBar}
          inputRef={inputRef}
        />
      )}

      {/* Status bar for save errors */}
      {(saving || saveError) && (
        <div className={`rawviewer__status ${saveError ? "rawviewer__status--error" : ""}`}>
          {saving ? "Saving…" : saveError}
        </div>
      )}

      {/* Line table */}
      <div ref={scrollRef} className="filespage__raw">
        <table className="filespage__raw-table">
          <tbody>
            {lines.map((line, i) => {
              const lineMs  = matchesByLine.get(i);
              const idStart = lineMatchIdStart.get(i) ?? 0;
              const content = lineMs
                ? highlightLine(line, lineMs, activeMatch, idStart)
                : (line || " ");

              return (
                <tr key={i} className="filespage__raw-tr">
                  <td className="filespage__raw-lnum">{i + 1}</td>
                  <td className="filespage__raw-line">{content}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
