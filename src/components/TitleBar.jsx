export default function TitleBar({ watching, isElectron }) {
  const api = () => window.electronAPI;

  return (
    <div className="titlebar">
      <div className="titlebar__left">
        {/* App name only — logo is in NavRail */}
        <span className="titlebar__app-name">Helix</span>

        {watching && (
          <span className="titlebar__live">
            <span className="titlebar__live-dot" />
            LIVE
          </span>
        )}
      </div>

      <div className="titlebar__right no-drag">
        {/* Minimize */}
        <button
          onClick={() => api()?.minimizeWindow()}
          className="icon-btn titlebar__winbtn"
          title="Minimize"
        >
          <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Maximize */}
        <button
          onClick={() => api()?.maximizeWindow()}
          className="icon-btn titlebar__winbtn"
          title="Maximize"
        >
          <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
            <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={() => api()?.closeWindow()}
          className="icon-btn titlebar__winbtn titlebar__winbtn--close"
          title="Close"
        >
          <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
