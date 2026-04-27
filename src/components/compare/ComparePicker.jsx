/**
 * ComparePicker — file + procedure selector bar.
 * Two slots (A and B), each with a file dropdown and procedure tab strip.
 */
export default function ComparePicker({
  ariFiles,
  fileA,
  fileB,
  procIdA,
  procIdB,
  onFileA,
  onFileB,
  onProcA,
  onProcB,
}) {
  const Slot = ({ label, mod, file, procId, onFile, onProc }) => {
    const procedures = file?.procedures ?? [];
    return (
      <div className="compare-picker__slot">
        <span className={`compare-picker__label compare-picker__label--${mod}`}>
          {label}
        </span>
        <select
          value={file?.path ?? ""}
          onChange={(e) =>
            onFile(ariFiles.find((f) => f.path === e.target.value) ?? null)
          }
          className="compare-picker__select"
        >
          <option value="">Select a file…</option>
          {ariFiles.map((f) => (
            <option key={f.path} value={f.path}>
              {f.name}
            </option>
          ))}
        </select>
        {procedures.length > 1 && (
          <div className="compare-picker__proc-row">
            {procedures.map((p) => (
              <button
                key={p.procedureId}
                onClick={() => onProc(p.procedureId)}
                className={`compare-picker__proc-btn ${procId === p.procedureId ? `compare-picker__proc-btn--active-${mod}` : ""}`}
              >
                {p.procedureId}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="compare-picker">
      <Slot
        label="File A — Base"
        mod="a"
        file={fileA}
        procId={procIdA}
        onFile={onFileA}
        onProc={onProcA}
      />
      <span className="compare-picker__sep">↔</span>
      <Slot
        label="File B — Compare"
        mod="b"
        file={fileB}
        procId={procIdB}
        onFile={onFileB}
        onProc={onProcB}
      />
    </div>
  );
}
