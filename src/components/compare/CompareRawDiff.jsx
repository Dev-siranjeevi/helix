/**
 * CompareRawDiff — raw line-by-line diff viewer.
 *
 * Same lines are collapsed with a "show N lines" toggle
 * so only changed context is visible by default.
 */
import { useState, useMemo } from "react";

const CONTEXT_LINES = 3; // how many same lines to show around a change

// Group consecutive same-lines into collapsible chunks
const groupLines = (rawDiff) => {
  const groups = [];
  let i = 0;

  while (i < rawDiff.length) {
    if (rawDiff[i].diff !== "same") {
      groups.push({ type: "diff", lines: [rawDiff[i]] });
      i++;
    } else {
      const start = i;
      while (i < rawDiff.length && rawDiff[i].diff === "same") i++;
      groups.push({ type: "same", lines: rawDiff.slice(start, i) });
    }
  }

  return groups;
};

function SameBlock({ lines }) {
  const [expanded, setExpanded] = useState(false);

  if (lines.length <= CONTEXT_LINES * 2 + 1 || expanded) {
    return lines.map((l, i) => (
      <tr key={i} className="ari-tr">
        <td className="raw-diff__lnum">{l.lineA}</td>
        <td className="raw-diff__lnum">{l.lineB}</td>
        <td className="raw-diff__text">{l.text || " "}</td>
      </tr>
    ));
  }

  const head = lines.slice(0, CONTEXT_LINES);
  const tail = lines.slice(-CONTEXT_LINES);
  const hiddenCount = lines.length - CONTEXT_LINES * 2;

  return [
    ...head.map((l, i) => (
      <tr key={`h${i}`} className="ari-tr">
        <td className="raw-diff__lnum">{l.lineA}</td>
        <td className="raw-diff__lnum">{l.lineB}</td>
        <td className="raw-diff__text">{l.text || " "}</td>
      </tr>
    )),
    <tr key="expand">
      <td colSpan={3}>
        <button className="raw-diff__show-same-btn" onClick={() => setExpanded(true)}>
          ▼ Show {hiddenCount} unchanged lines
        </button>
      </td>
    </tr>,
    ...tail.map((l, i) => (
      <tr key={`t${i}`} className="ari-tr">
        <td className="raw-diff__lnum">{l.lineA}</td>
        <td className="raw-diff__lnum">{l.lineB}</td>
        <td className="raw-diff__text">{l.text || " "}</td>
      </tr>
    )),
  ];
}

export default function CompareRawDiff({ rawDiff, diffOnly = false }) {
  const groups = useMemo(() => groupLines(rawDiff), [rawDiff]);
  const hasDiff = rawDiff.some((l) => l.diff !== "same");

  if (!hasDiff) {
    return (
      <div className="ari-td diff-val--same" style={{ padding: "16px" }}>
        Files are identical at the raw line level.
      </div>
    );
  }

  return (
    <div className="table-section__scroll">
      <table className="raw-diff">
        <thead>
          <tr>
            <th className="ari-th diff-th--a" style={{ width: 52 }}>A</th>
            <th className="ari-th diff-th--b" style={{ width: 52 }}>B</th>
            <th className="ari-th">Line</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) =>
            group.type === "same"
              ? diffOnly ? null : <SameBlock key={gi} lines={group.lines} />
              : group.lines.map((l, li) => (
                  <tr key={`${gi}-${li}`} className={`raw-diff__row--${l.diff}`}>
                    <td className="raw-diff__lnum">{l.lineA ?? ""}</td>
                    <td className="raw-diff__lnum">{l.lineB ?? ""}</td>
                    <td className="raw-diff__text">{l.text || " "}</td>
                  </tr>
                ))
          )}
        </tbody>
      </table>
    </div>
  );
}
