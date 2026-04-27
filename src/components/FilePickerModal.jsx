import { useEffect, useRef } from "react";

export default function FilePickerModal({
  ariFiles,
  openTabs,
  onSelect,
  onClose,
}) {
  const containerRef = useRef(null);
  const openPaths = new Set(openTabs.map((t) => t.path));

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 96,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "50%",
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "var(--radius-xl)",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          outline: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="panel-header" style={{ padding: "16px 20px" }}>
          <div>
            <p
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "var(--fs-md)",
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
              }}
            >
              Open file
            </p>
            <p
              className="font-mono"
              style={{
                fontSize: "var(--fs-2xs)",
                color: "var(--muted)",
                margin: "3px 0 0",
              }}
            >
              {ariFiles.length} file{ariFiles.length !== 1 ? "s" : ""} in
              watched folder
            </p>
          </div>
          <button
            onClick={onClose}
            className="icon-btn icon-btn--danger"
            style={{ width: 28, height: 28 }}
          >
            <svg viewBox="0 0 10 10" fill="none" width="12" height="12">
              <path
                d="M1.5 1.5l7 7M8.5 1.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-2">
          {ariFiles.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 40 40" fill="none" width="32" height="32">
                <path
                  d="M8 5h16l10 10v20H8V5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M24 5v10h10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <p>No files in watch folder yet</p>
            </div>
          )}

          {ariFiles.map((file) => {
            const alreadyOpen = openPaths.has(file.path);
            return (
              <button
                key={file.path}
                onClick={() => {
                  if (!alreadyOpen) {
                    onSelect(file);
                    onClose();
                  }
                }}
                disabled={alreadyOpen}
                className="file-row"
                style={{
                  padding: "10px 20px",

                  cursor: alreadyOpen ? "default" : "pointer",
                }}
              >
                <svg
                  viewBox="0 0 14 16"
                  fill="none"
                  width="16"
                  height="18"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M1 1.5h8l4 4V14.5a1 1 0 01-1 1H1a1 1 0 01-1-1v-13A1 1 0 011 1.5z"
                    fill={
                      alreadyOpen
                        ? "color-mix(in srgb,var(--accent) 10%,transparent)"
                        : "var(--surface)"
                    }
                    stroke={alreadyOpen ? "var(--accent)" : "var(--border2)"}
                    strokeWidth="1.2"
                  />
                  <path
                    d="M9 1.5v4h4"
                    stroke={alreadyOpen ? "var(--accent)" : "var(--border2)"}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="font-mono truncate"
                    style={{
                      fontSize: "var(--fs-sm)",
                      fontWeight: 500,
                      color: alreadyOpen ? "var(--accent)" : "var(--text2)",
                      margin: 0,
                    }}
                  >
                    {file.name}
                  </p>
                </div>

                {alreadyOpen ? (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "var(--fs-sm)",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    open
                  </span>
                ) : (
                  <svg
                    viewBox="0 0 8 8"
                    fill="none"
                    width="12"
                    height="12"
                    style={{ flexShrink: 0, color: "var(--muted)" }}
                  >
                    <path
                      d="M2 1l4 3-4 3"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
