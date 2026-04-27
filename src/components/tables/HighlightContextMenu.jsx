/**
 * HighlightContextMenu
 *
 * Tool selector — sets the active highlight tool.
 * If right-clicked cell already has a highlight, selecting a tool
 * also applies it immediately (handled in useHighlight.onSelectTool).
 *
 * Props:
 *   x, y        {number}   cursor position
 *   current     {object}   highlight on the right-clicked cell { color?, symbol? }
 *   activeTool  {object}   currently active tool { type, value } | null
 *   onSelectTool{fn}       (type, value) => void
 *   onClearCell {fn}       clear this cell's highlight
 *   onClearAll  {fn}       clear all highlights for the file
 *   onClose     {fn}
 */
import { useEffect, useRef } from "react";
import { createPortal }      from "react-dom";

const COLORS = [
  { value: "yellow", label: "Yellow" },
  { value: "green",  label: "Green"  },
  { value: "blue",   label: "Blue"   },
  { value: "red",    label: "Red"    },
];

const SYMBOLS = [
  { value: "flag",  label: "Flag",  char: "⚑" },
  { value: "check", label: "Check", char: "✔" },
  { value: "dot",   label: "Dot",   char: "●" },
  { value: "warn",  label: "Warn",  char: "▲" },
];

export default function HighlightContextMenu({
  x, y, current, activeTool,
  onSelectTool, onClearCell, onClearAll, onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey  = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  // Clamp to viewport after mount
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (rect.right  > vw - 8) ref.current.style.left = `${vw - rect.width  - 8}px`;
    if (rect.bottom > vh - 8) ref.current.style.top  = `${vh - rect.height - 8}px`;
  }, []);

  const isActiveColor  = (v) => activeTool?.type === "color"  && activeTool?.value === v;
  const isActiveSymbol = (v) => activeTool?.type === "symbol" && activeTool?.value === v;
  const hasHighlight   = current?.color || current?.symbol;

  const menu = (
    <div
      ref={ref}
      className="hl-ctx"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="hl-ctx__section">Colour</div>
      {COLORS.map(({ value, label }) => (
        <button
          key={value}
          className={`hl-ctx__item ${isActiveColor(value) ? "hl-ctx__item--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelectTool("color", value); }}
        >
          <span className={`hl-ctx__swatch hl-ctx__swatch--${value}`} />
          <span className="hl-ctx__label">{label}</span>
          {/* active tool indicator */}
          {isActiveColor(value) && <span className="hl-ctx__active-dot" />}
          {/* applied to this cell */}
          {current?.color === value && <span className="hl-ctx__check">✓</span>}
        </button>
      ))}

      <div className="hl-ctx__divider" />
      <div className="hl-ctx__section">Symbol</div>
      {SYMBOLS.map(({ value, label, char }) => (
        <button
          key={value}
          className={`hl-ctx__item ${isActiveSymbol(value) ? "hl-ctx__item--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelectTool("symbol", value); }}
        >
          <span className={`hl-ctx__sym hl-ctx__sym--${value}`}>{char}</span>
          <span className="hl-ctx__label">{label}</span>
          {isActiveSymbol(value) && <span className="hl-ctx__active-dot" />}
          {current?.symbol === value && <span className="hl-ctx__check">✓</span>}
        </button>
      ))}

      <div className="hl-ctx__divider" />

      {/* Clear this cell — only if it has a highlight */}
      {hasHighlight && (
        <button
          className="hl-ctx__item hl-ctx__item--clear"
          onMouseDown={(e) => { e.preventDefault(); onClearCell(); }}
        >
          <span className="hl-ctx__clear-icon">✕</span>
          <span className="hl-ctx__label">Clear cell</span>
        </button>
      )}

      {/* Clear all — always shown */}
      <button
        className="hl-ctx__item hl-ctx__item--clear"
        onMouseDown={(e) => { e.preventDefault(); onClearAll(); }}
      >
        <span className="hl-ctx__clear-icon">⊘</span>
        <span className="hl-ctx__label">Clear all</span>
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
