import { useTheme } from "../context/ThemeContext";

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle__track" />
      <span className="toggle__thumb" />
    </label>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange }) {
  return (
    <div className="stepper">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="icon-btn stepper__btn"
      >
        <svg viewBox="0 0 10 2" fill="none" width="10" height="2">
          <path
            d="M1 1h8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="stepper__value">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="icon-btn stepper__btn"
      >
        <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
          <path
            d="M5 1v8M1 5h8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SettingsPage({
  filePath,
  folderPath,
  watching,
  scanning,
  onBrowse,
  onFileBrowse,
  onStart,
  onStop,
  tabCount,
  maxTabs,
  onMaxTabsChange,
  onCloseAllTabs,
  autoOpenExternal,
  onAutoOpenExternalChange,
}) {
  const { theme, toggle } = useTheme();

  return (
    <div className="settings">
      <div className="page-header">
        <h1 className="page-header__title">Settings</h1>
        <p className="page-header__sub">
          Watcher, tabs, external apps and appearance
        </p>
      </div>

      <div className="settings__body">
        {/* ── CIFP file selection ── */}
        <section>
          <p className="section-label settings__section-label">
            CIFP file data
          </p>
          <div className="flex flex-col gap-3">
            <div className="card settings__folder-row">
              <svg
                viewBox="0 0 16 14"
                fill="none"
                width="16"
                height="14"
                className="settings__folder-icon"
              >
                <path
                  d="M1 2h5l2 2h7v9H1V2z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="settings__file-path" title={filePath}>
                {filePath || "No file selected"}
              </span>
              <button
                onClick={onFileBrowse}
                className="btn btn--ghost settings__browse-btn"
              >
                Browse
              </button>
            </div>
          </div>
        </section>
        {/* ── Watch Folder ── */}
        <section>
          <p className="section-label settings__section-label">Watch Folder</p>
          <div className="flex flex-col gap-3">
            <div className="card settings__folder-row">
              <svg
                viewBox="0 0 16 14"
                fill="none"
                width="16"
                height="14"
                className="settings__folder-icon"
              >
                <path
                  d="M1 2h5l2 2h7v9H1V2z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="settings__folder-path" title={folderPath}>
                {folderPath || "No folder selected"}
              </span>
              <button
                onClick={onBrowse}
                className="btn btn--ghost settings__browse-btn"
              >
                Browse
              </button>
            </div>

            <div className="settings__watcher-row">
              <button
                onClick={onStart}
                disabled={!folderPath || watching || scanning}
                className="btn btn--primary settings__watcher-btn"
              >
                <span className="settings__status-dot settings__status-dot--on" />
                Start watching
              </button>
              <button
                onClick={onStop}
                disabled={!watching}
                className="btn btn--ghost settings__watcher-btn"
              >
                <span className="settings__status-dot settings__status-dot--off" />
                Stop
              </button>
            </div>

            <div
              className={`card settings__status-card ${watching ? "card--accent settings__status-card--on" : "settings__status-card--off"}`}
            >
              <span
                className={`settings__status-dot ${watching ? "settings__status-dot--on" : "settings__status-dot--off"} ${watching ? "animate-pulse" : ""}`}
              />
              {watching
                ? "Watching for changes…"
                : scanning
                  ? "Scanning…"
                  : "Not watching"}
            </div>
          </div>
        </section>

        {/* ── External App ── */}
        <section>
          <p className="section-label settings__section-label">External App</p>
          <div className="flex flex-col gap-3">
            <div className="card settings__card-row">
              <div className="settings__card-text">
                <p className="settings__card-title">Auto-open in default app</p>
                <p className="settings__card-sub">
                  When a file is added to the watched folder, also open it in
                  its default application
                </p>
              </div>
              <Toggle
                id="auto-open-external"
                checked={autoOpenExternal ?? false}
                onChange={onAutoOpenExternalChange}
              />
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <section>
          <p className="section-label settings__section-label">Tabs</p>
          <div className="flex flex-col gap-3">
            <div className="card settings__card-row">
              <div className="settings__card-text">
                <p className="settings__card-title">Max open tabs</p>
                <p className="settings__card-sub">
                  Oldest tab closes automatically when limit is reached
                </p>
              </div>
              <Stepper
                value={maxTabs}
                min={1}
                max={10}
                onChange={onMaxTabsChange}
              />
            </div>

            <div className="card settings__card-row">
              <div className="settings__card-text">
                <p className="settings__card-title">Open tabs</p>
                <p
                  className="settings__card-sub"
                  style={{ color: tabCount > 0 ? "var(--text2)" : undefined }}
                >
                  {tabCount} of {maxTabs} used
                </p>
              </div>
              <button
                onClick={onCloseAllTabs}
                disabled={tabCount === 0}
                className="btn btn--ghost"
              >
                Close all
              </button>
            </div>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <p className="section-label settings__section-label">Appearance</p>
          <div className="settings__theme-row">
            {[
              { val: "dark", emoji: "🌙", label: "Dark", sub: "Default" },
              { val: "light", emoji: "☀️", label: "Light", sub: "Clean" },
            ].map(({ val, emoji, label, sub }) => {
              const active = theme === val;
              return (
                <button
                  key={val}
                  onClick={() => !active && toggle()}
                  className={`card settings__theme-card ${active ? "settings__theme-card--active" : ""}`}
                >
                  <span className="settings__theme-emoji">{emoji}</span>
                  <div>
                    <p
                      className={`settings__theme-label ${active ? "settings__theme-label--active" : "settings__theme-label--inactive"}`}
                    >
                      {label}
                    </p>
                    <p className="settings__card-sub">{sub}</p>
                  </div>
                  {active && <span className="settings__theme-dot" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── About ── */}
        <section>
          <p className="section-label settings__section-label">About</p>
          <div className="card settings__about-card">
            <div className="settings__about-logo">
              <span className="settings__about-logo-letter">H</span>
            </div>
            <div>
              <p className="settings__about-name">Helix</p>
              <p className="settings__about-version">
                ARINC 424 file monitor · ARINC data visusalizer · Validator ·
                Comparision tool · v1.0.0
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
