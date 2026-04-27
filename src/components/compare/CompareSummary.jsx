/**
 * CompareSummary — badge strip showing changed/added/removed counts per section.
 * Sections: header · legs · waypoints · navaids · minima · raw
 */
const SECTIONS = [
  { key: "header",    label: "Header"    },
  { key: "legs",      label: "Legs"      },
  { key: "waypoints", label: "Waypoints" },
  { key: "navaids",   label: "Navaids"   },
  { key: "minima",    label: "Minima"    },
  { key: "raw",       label: "Raw"       },
];

function SummaryBadge({ label, n, type }) {
  const hasDiff = n > 0;
  const cls = hasDiff
    ? `badge badge--${type === "added" ? "accent" : type === "removed" ? "danger" : "warn"}`
    : "badge";
  return <span className={cls}>{n} {label}</span>;
}

export default function CompareSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="compare-summary">
      {SECTIONS.map((sec, i) => {
        const s = summary[sec.key];
        if (!s) return null;
        return (
          <div key={sec.key} className="compare-summary__group">
            {i > 0 && <span className="compare-summary__divider" />}
            <span className="compare-summary__group-label">{sec.label}</span>
            {s.changed > 0 && <SummaryBadge label="changed" n={s.changed} type="changed" />}
            {s.added   > 0 && <SummaryBadge label="added"   n={s.added}   type="added"   />}
            {s.removed > 0 && <SummaryBadge label="removed" n={s.removed} type="removed" />}
            {s.changed === 0 && s.added === 0 && s.removed === 0 && (
              <span className="badge">identical</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
