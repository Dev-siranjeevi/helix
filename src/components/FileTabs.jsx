/**
 * FileTabs — unified tab bar for decoded files AND compare sessions.
 * Decoded tabs: accent-coloured dot indicator
 * Compare tabs: double-arrow (↔) icon, accent2-coloured
 */
import { useEffect, useRef, useCallback } from "react";

export default function FileTabs({ tabs, activeTab, onSelect, onClose, onAdd, unviewedTabs = new Set() }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey && e.key === "w") { e.preventDefault(); if (activeTab) onClose(activeTab); return; }
    if (e.ctrlKey && e.key === "Tab" && tabs.length >= 2) {
      e.preventDefault();
      const idx  = tabs.findIndex((t) => t.id === activeTab);
      const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
      onSelect(tabs[next].id);
    }
  }, [tabs, activeTab, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (tabs.length === 0) return null;

  return (
    <div className="filetabs">
      {tabs.map((tab) => {
        const active  = activeTab === tab.id;
        const isCmp   = tab.type === "compare";
        // Decoded: show ICAO + up to 2 procedure IDs. Compare: dynamic label with both IDs.
        let label;
        if (isCmp) {
          label = tab.label || "Compare";
        } else {
          const procs = tab.procedures ?? [];
          const icao = procs[0]?.icao ?? "";
          if (procs.length === 0) {
            label = tab.name;
          } else if (procs.length === 1) {
            label = `${icao} / ${procs[0].procedureId}`;
          } else {
            // Show first two procedure IDs
            label = `${icao} / ${procs[0].procedureId} · ${procs[1].procedureId}${procs.length > 2 ? " …" : ""}`;
          }
        }

        return (
          <div
            key={tab.id}
            ref={active ? activeRef : null}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab.id); } }}
            className={`filetabs__tab ${active ? "filetabs__tab--active" : "filetabs__tab--inactive"} ${isCmp ? "filetabs__tab--compare" : ""}`}
          >
            {isCmp ? (
              <span className="filetabs__cmp-icon">↔</span>
            ) : (
              <span className={`filetabs__dot ${active ? "filetabs__dot--active" : "filetabs__dot--inactive"}`} />
            )}
            {!isCmp && unviewedTabs.has(tab.id) && !active && (
              <span className="filetabs__unviewed" title="New — not yet viewed" />
            )}
            <span className="filetabs__label">{label}</span>
            {!isCmp && tab.header?.cycle && (
              <span className={`badge ${active ? "badge--accent" : ""}`}>{tab.header.cycle}</span>
            )}
            {isCmp && tab.cycleLabel && (
              <span className={`badge ${active ? "badge--accent2" : ""}`}>{tab.cycleLabel}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              tabIndex={-1}
              className="icon-btn icon-btn--danger filetabs__close"
            >
              <svg viewBox="0 0 8 8" fill="none" width="10" height="10">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        );
      })}

      <button onClick={onAdd} title="Open file (+)" className="icon-btn icon-btn--accent filetabs__add">
        <svg viewBox="0 0 10 10" fill="none" width="12" height="12">
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      {tabs.length >= 2 && <span className="filetabs__hint">Ctrl+Tab · Ctrl+W</span>}
    </div>
  );
}
