/**
 * UpdateManager — renders update availability banners and action buttons.
 * Consumes useUpdater() hook; should be mounted once near the root (e.g. App.jsx).
 *
 * Phases:
 *   idle          → nothing shown
 *   checking      → small spinner in titlebar
 *   available     → banner: "v1.2.3 is available — Download"
 *   downloading   → progress bar
 *   ready         → banner: "Restart to install"
 *   not-available → silent (no UI)
 *   error         → dismissable warning
 */
import { useUpdater } from "../hooks/useUpdater";

export default function UpdateManager() {
  const { phase, progress, version, error, check, download, install, dismiss } =
    useUpdater();

  if (phase === "idle" || phase === "not-available" || phase === "checking") {
    return null;
  }

  const bannerClass = `update-banner update-banner--${
    phase === "error"    ? "error"    :
    phase === "ready"    ? "ready"    :
    phase === "available" || phase === "downloading" ? "info" : "info"
  }`;

  return (
    <div className={bannerClass} role="status" aria-live="polite">
      {phase === "available" && (
        <>
          <span>Version {version} is available.</span>
          <button className="update-banner__btn" onClick={download}>Download</button>
          <button className="update-banner__dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
        </>
      )}

      {phase === "downloading" && (
        <>
          <span>Downloading update… {progress}%</span>
          <div className="update-banner__bar">
            <div className="update-banner__fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {phase === "ready" && (
        <>
          <span>Update ready — restart to install.</span>
          <button className="update-banner__btn update-banner__btn--primary" onClick={install}>
            Restart & Install
          </button>
          <button className="update-banner__dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
        </>
      )}

      {phase === "error" && (
        <>
          <span>Update check failed: {error}</span>
          <button className="update-banner__btn" onClick={check}>Retry</button>
          <button className="update-banner__dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
        </>
      )}
    </div>
  );
}
