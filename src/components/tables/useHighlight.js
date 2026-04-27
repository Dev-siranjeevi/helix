/**
 * useHighlight
 *
 * Interaction model:
 *   single click         → apply activeTool to cell
 *   shift + single click → extend selection from anchor, apply activeTool to all
 *   double click         → clear highlights from that cell
 *   right-click          → open context menu to select active tool
 *                          if cell already has a highlight → also apply new tool immediately
 *                          if cell is empty               → just set active tool, don't apply
 *
 * activeTool lives inside the hook — persists across clicks within same table instance.
 * Context menu "Clear all" is delegated to the parent via onClearAll prop.
 */
import { useState, useCallback, useEffect } from "react";

const SYM_CHARS = { flag: "⚑", check: "✔", dot: "●", warn: "▲" };

export const useHighlight = ({ filePath, highlights, onHighlightChange, onClearAll }) => {
  const [activeTool, setActiveTool] = useState(null); // { type, value } | null
  const [selection,  setSelection]  = useState(new Set());
  const [anchorKey,  setAnchorKey]  = useState(null);
  const [menuState,  setMenuState]  = useState(null); // { x, y, cellKey } | null

  // Reset when file changes
  useEffect(() => {
    setSelection(new Set());
    setAnchorKey(null);
    setMenuState(null);
    // keep activeTool — user shouldn't need to re-pick after switching files
  }, [filePath]);

  // Close menu on scroll
  useEffect(() => {
    if (!menuState) return;
    const close = () => setMenuState(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [menuState]);

  // ── Internal: write a highlight to a set of keys ──────────────────────
  const writeToKeys = useCallback((keys, tool) => {
    if (!filePath || !tool || keys.length === 0) return;
    onHighlightChange((prev) => {
      const fileMap = { ...(prev[filePath] ?? {}) };
      for (const key of keys) {
        const current = fileMap[key] ?? {};
        fileMap[key] = tool.type === "color"
          ? { ...current, color: tool.value }
          : { ...current, symbol: tool.value };
      }
      return { ...prev, [filePath]: fileMap };
    });
  }, [filePath, onHighlightChange]);

  // ── Single click — apply activeTool ──────────────────────────────────
  const onCellClick = useCallback((e, cellKey, allKeys) => {
    if (!activeTool) return;

    if (e.shiftKey && anchorKey && allKeys) {
      const anchorIdx = allKeys.indexOf(anchorKey);
      const thisIdx   = allKeys.indexOf(cellKey);
      if (anchorIdx !== -1 && thisIdx !== -1) {
        const lo   = Math.min(anchorIdx, thisIdx);
        const hi   = Math.max(anchorIdx, thisIdx);
        const keys = allKeys.slice(lo, hi + 1);
        setSelection(new Set(keys));
        writeToKeys(keys, activeTool);
        return;
      }
    }

    setAnchorKey(cellKey);
    setSelection(new Set([cellKey]));
    writeToKeys([cellKey], activeTool);
  }, [activeTool, anchorKey, writeToKeys]);

  // ── Double click — clear highlights from cell ─────────────────────────
  const onCellDoubleClick = useCallback((e, cellKey) => {
    e.preventDefault();
    if (!filePath) return;
    onHighlightChange((prev) => {
      const fileMap = { ...(prev[filePath] ?? {}) };
      delete fileMap[cellKey];
      return { ...prev, [filePath]: fileMap };
    });
    setSelection((prev) => { const n = new Set(prev); n.delete(cellKey); return n; });
  }, [filePath, onHighlightChange]);

  // ── Right-click — open menu ───────────────────────────────────────────
  const onCellContextMenu = useCallback((e, cellKey, allKeys) => {
    e.preventDefault();

    if (e.shiftKey && anchorKey && allKeys) {
      const anchorIdx = allKeys.indexOf(anchorKey);
      const thisIdx   = allKeys.indexOf(cellKey);
      if (anchorIdx !== -1 && thisIdx !== -1) {
        const lo = Math.min(anchorIdx, thisIdx);
        const hi = Math.max(anchorIdx, thisIdx);
        setSelection(new Set(allKeys.slice(lo, hi + 1)));
      }
    } else if (!selection.has(cellKey)) {
      setAnchorKey(cellKey);
      setSelection(new Set([cellKey]));
    }

    setMenuState({ x: e.clientX, y: e.clientY, cellKey });
  }, [anchorKey, selection]);

  // ── Called by context menu when user picks a tool ─────────────────────
  const onSelectTool = useCallback((type, value) => {
    const tool    = { type, value };
    const cellKey = menuState?.cellKey;
    const cellHl  = highlights?.[filePath]?.[cellKey];
    const hasHl   = cellHl?.color || cellHl?.symbol;

    setActiveTool(tool);

    // Apply immediately only if cell already has a highlight
    if (hasHl && cellKey) {
      writeToKeys([cellKey], tool);
    }

    setMenuState(null);
  }, [menuState, highlights, filePath, writeToKeys]);

  // ── Clear cell highlight (from context menu) ──────────────────────────
  const onClearCell = useCallback(() => {
    const cellKey = menuState?.cellKey;
    if (!filePath || !cellKey) return;
    onHighlightChange((prev) => {
      const fileMap = { ...(prev[filePath] ?? {}) };
      delete fileMap[cellKey];
      return { ...prev, [filePath]: fileMap };
    });
    setMenuState(null);
  }, [filePath, menuState, onHighlightChange]);

  // ── Getters ───────────────────────────────────────────────────────────
  const getCell = useCallback((cellKey) => {
    return highlights?.[filePath]?.[cellKey] ?? null;
  }, [highlights, filePath]);

  const getCellClass = useCallback((cellKey, baseClass) => {
    const hl       = getCell(cellKey);
    const selected = selection.has(cellKey);
    const classes  = [baseClass];
    if (hl?.color)           classes.push(`hl-${hl.color}`);
    if (hl?.symbol)          classes.push("hl-sym", `hl-sym-${hl.symbol}`);
    if (selected && activeTool) classes.push("hl-selected");
    return classes.join(" ");
  }, [getCell, selection, activeTool]);

  const getSymChar = useCallback((cellKey) => {
    const sym = getCell(cellKey)?.symbol;
    return sym ? SYM_CHARS[sym] : undefined;
  }, [getCell]);

  const closeMenu = useCallback(() => setMenuState(null), []);

  return {
    activeTool,
    menuState,
    onCellClick,
    onCellDoubleClick,
    onCellContextMenu,
    onSelectTool,
    onClearCell,
    getCellClass,
    getSymChar,
    getCell,
    closeMenu,
  };
};
