import { useState } from "react";

const SEGMENT_COLORS = { FINAL: "var(--accent)", MISSED: "var(--danger)" };
const segColor = (name) =>
  SEGMENT_COLORS[name] ??
  (name?.match(/^R\d/) ? "var(--accent2)" : "var(--text2)");

function Tip({ label, children }) {
  return (
    <div className="tooltip-wrap navrail__navbtn-wrap">
      {children}
      <div className="tooltip">{label}</div>
    </div>
  );
}

function CollapsedRail({
  tabs,
  activeTab,
  onActivateTab,
  onExpand,
  onToggleFiles,
}) {
  return (
    <div className="filepanel-rail">
      <Tip label="Expand sidebar">
        <button
          onClick={onExpand}
          className="icon-btn icon-btn--accent filepanel-rail__smallbtn"
        >
          <svg viewBox="0 0 10 10" fill="none" width="14" height="14">
            <path
              d="M3 2l4 3-4 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Tip>

      <div className="filepanel-rail__divider" />

      <div className="filepanel-rail__tabs">
        {tabs.map((tab, i) => {
          const isActive = activeTab === tab.path;
          const label = tab.airport
            ? `${tab.airport} · ${tab.procedureId}`
            : tab.name;
          return (
            <Tip key={tab.path} label={label}>
              <button
                onClick={() => onActivateTab(tab.path)}
                className={`icon-btn filepanel-rail__tabBtn ${isActive ? "filepanel-rail__tabBtn--active" : ""}`}
              >
                {isActive && (
                  <span className="filepanel-rail__tabBtn-indicator" />
                )}
                {tab.airport ? tab.airport[0] : String(i + 1)}
              </button>
            </Tip>
          );
        })}
      </div>

      <div className="filepanel-rail__divider" />

      <Tip label="Browse files">
        <button
          onClick={onToggleFiles}
          className="icon-btn icon-btn--accent filepanel-rail__smallbtn"
        >
          <svg viewBox="0 0 12 12" fill="none" width="14" height="14">
            <path
              d="M1 2.5h10M1 5.5h7M1 8.5h5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </Tip>
    </div>
  );
}
function FileList({
  ariFiles,
  scanning,
  folderPath,
  openTabs,
  newFilePaths = new Set(),
  onSelectFile,
  onBrowse,
  onCollapse,
}) {
  return (
    <div className="filelist">
      <div className="panel-header">
        <span className="panel-header-label">Files</span>
        <div className="flex items-center gap-1.5">
          {scanning ? (
            <span className="filelist__scanning">scanning…</span>
          ) : (
            <span className="badge">{ariFiles.length}</span>
          )}
          <button
            onClick={onCollapse}
            className="icon-btn icon-btn--accent filepanel-rail__smallbtn"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 10 10" fill="none" width="12" height="12">
              <path
                d="M7 2L3 5l4 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {folderPath && (
        <div className="filelist__folder" title={folderPath}>
          {folderPath.replace(/\\/g, "/").split("/").pop()}
        </div>
      )}

      <div className="filelist__scroll">
        {!scanning && ariFiles.length === 0 && (
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
            <p>No .ari files found</p>
            <button
              onClick={onBrowse}
              className="btn btn--primary filelist__browse-btn"
            >
              Browse folder
            </button>
          </div>
        )}
        {!scanning &&
          ariFiles
            .sort((a, b) => new Date(b.modified) - new Date(a.modified))
            .map((file) => {
              const isOpen = openTabs.some((t) => t.path === file.path);
              const isNew = newFilePaths.has(file.path);
              const hasErrors = file.validation?.errors?.length > 0;
              const hasWarn =
                !hasErrors && file.validation?.warnings?.length > 0;
              return (
                <button
                  key={file.path}
                  onClick={() => onSelectFile(file)}
                  className={`file-row ${isNew ? "filelist__filerow-new" : ""}`}
                  title={file.name}
                >
                  <svg
                    viewBox="0 0 14 16"
                    fill="none"
                    width="14"
                    height="16"
                    className="shrink-0"
                  >
                    <path
                      d="M1 1.5h8l4 4V14.5a1 1 0 01-1 1H1a1 1 0 01-1-1v-13A1 1 0 011 1.5z"
                      fill={
                        isOpen
                          ? "color-mix(in srgb,var(--accent) 10%,transparent)"
                          : "var(--surface)"
                      }
                      stroke={isOpen ? "var(--accent)" : "var(--border2)"}
                      strokeWidth="1.2"
                    />
                    <path
                      d="M9 1.5v4h4"
                      stroke={isOpen ? "var(--accent)" : "var(--border2)"}
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className={`file-row__name ${isOpen ? "file-row__name--open" : ""}`}
                    style={{
                      wordBreak: "break-all",
                      whiteSpace: "normal",
                      lineHeight: "1.3",
                    }}
                  >
                    {file.name}
                  </span>
                  <div className="file-row__icons">
                    {isOpen && <span className="filelist__filerow-open-dot" />}
                    {file.hasSav && (
                      <span className="file-row__icon-sav" title="SAV patch">
                        ⊕
                      </span>
                    )}
                    {hasErrors && (
                      <span className="file-row__icon-danger">⚠</span>
                    )}
                    {hasWarn && <span className="file-row__icon-warn">⚠</span>}
                  </div>
                </button>
              );
            })}
      </div>
    </div>
  );
}

function ProcedureTree({
  file,
  hiddenSegments,
  onToggleSegment,
  onShowFiles,
  onCollapse,
}) {
  const segments = file?.segments ?? [];
  const airport = file?.icao ?? "";
  const procId = file?.procedureId ?? "";
  const procType = file?.procedureType ?? "";
  const procedureType = file?.procstage ?? "";

  const allVisible = hiddenSegments.size === 0;
  const handleToggleAll = () => {
    if (allVisible) {
      // Hide all — show none
      segments.forEach((seg) => onToggleSegment(seg, true));
    } else {
      // Show all
      segments.forEach((seg) => onToggleSegment(seg, false));
    }
  };

  return (
    <div className="proctree">
      <div className="panel-header">
        <span className="panel-header-label">Nav</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onShowFiles}
            className="icon-btn icon-btn--accent filepanel-rail__smallbtn"
            title="All files"
          >
            <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
              <path
                d="M1 2.5h10M1 5.5h7M1 8.5h5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            onClick={onCollapse}
            className="icon-btn icon-btn--accent filepanel-rail__smallbtn"
            title="Collapse"
          >
            <svg viewBox="0 0 10 10" fill="none" width="12" height="12">
              <path
                d="M7 2L3 5l4 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="proctree__scroll">
        <div className="proctree__airport-row">
          <svg
            viewBox="0 0 12 12"
            fill="none"
            width="12"
            height="12"
            className="proctree__airport-icon"
          >
            <rect
              x="1"
              y="1"
              width="10"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M4 6h4M6 4v4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="proctree__airport-name">{airport}</span>
        </div>

        <div className="proctree__iac-row">
          <span className="proctree__iac-arrow">▼</span>
          <span className="proctree__iac-label">{procedureType}</span>
        </div>

        <div className="proctree__proc-row">
          <svg
            viewBox="0 0 10 12"
            fill="none"
            width="10"
            height="12"
            className="proctree__proc-icon"
          >
            <path d="M2 1l6 5-6 5V1z" fill="currentColor" />
          </svg>
          <span className="proctree__proc-id">{procId}</span>
          <span className="badge">{procType}</span>
        </div>

        {segments.length > 0 && (
          <div style={{ padding: "4px 8px 2px" }}>
            <button
              onClick={handleToggleAll}
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--muted2)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                textDecoration: "underline",
              }}
            >
              {allVisible ? "Hide all" : "Show all"}
            </button>
          </div>
        )}

        <div className="proctree__segs">
          {segments.map((seg, i) => {
            const isVisible = !hiddenSegments.has(seg);
            return (
              <button
                key={seg}
                onClick={() => onToggleSegment(seg, isVisible)}
                className={`seg-btn ${isVisible ? "seg-btn--active" : ""}`}
                title={isVisible ? "Click to hide" : "Click to show"}
                style={{ opacity: isVisible ? 1 : 0.4 }}
              >
                {/* Checkbox indicator */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    border: `1.5px solid ${isVisible ? "var(--accent)" : "var(--border2)"}`,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: isVisible ? "var(--accent)" : "transparent",
                    marginRight: 3,
                  }}
                >
                  {isVisible && (
                    <svg viewBox="0 0 8 8" fill="none" width="12" height="12">
                      <path
                        d="M1.5 4L3 5.5L6.5 2"
                        stroke="white"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                <span
                  className="proctree__seg-name"
                  style={{ color: isVisible ? segColor(seg) : "var(--muted2)" }}
                >
                  {seg}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function FilePanel({
  ariFiles,
  scanning,
  folderPath,
  onBrowse,
  tabs,
  activeTab,
  onActivateTab,
  activeFile,
  hiddenSegments,
  onToggleSegment,
  newFilePaths,
  onSelectFile,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState("decoded");

  const handleSelectFile = (file) => {
    onSelectFile(file);
    setMode("tree");
  };

  if (collapsed) {
    return (
      <CollapsedRail
        tabs={tabs ?? []}
        activeTab={activeTab}
        onActivateTab={onActivateTab}
        onExpand={() => setCollapsed(false)}
        onToggleFiles={() => {
          setCollapsed(false);
          setMode("decoded");
        }}
      />
    );
  }
  return (
    <div className="filepanel">
      {mode === "decoded" || !activeFile ? (
        <FileList
          ariFiles={ariFiles}
          scanning={scanning}
          folderPath={folderPath}
          openTabs={tabs ?? []}
          newFilePaths={newFilePaths}
          onSelectFile={handleSelectFile}
          onBrowse={onBrowse}
          onCollapse={() => setCollapsed(true)}
        />
      ) : (
        <ProcedureTree
          file={activeFile.procedures[0]}
          hiddenSegments={hiddenSegments}
          onToggleSegment={onToggleSegment}
          onShowFiles={() => setMode("decoded")}
          onCollapse={() => setCollapsed(true)}
        />
      )}
    </div>
  );
}
