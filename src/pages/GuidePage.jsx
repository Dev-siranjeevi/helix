/**
 * GuidePage — complete feature reference for Helix v1.0.
 * Covers: Files, Tabs, Tables, Highlighting, Compare (with new view toggle),
 * PDF Tools (Merge, Split, Organise, Rotate, Compress), Updates, Settings.
 */
import { useState, useEffect } from "react";

const SECTIONS = [
  { id: "overview",   title: "Overview",          icon: "◈" },
  { id: "files",      title: "Files & Watching",  icon: "⊡" },
  { id: "tabs",       title: "Tabs",              icon: "⊟" },
  { id: "tables",     title: "Table View",        icon: "⊞" },
  { id: "highlight",  title: "Highlighting",      icon: "✦" },
  { id: "compare",    title: "Compare",           icon: "↔" },
  { id: "pdf",        title: "PDF Tools",         icon: "⊕" },
  { id: "updates",    title: "Updates",           icon: "↑" },
  { id: "settings",   title: "Settings",          icon: "⚙" },
];

// ── Primitives ─────────────────────────────────────────────────────────────────

const SectionAnchor = ({ id }) => <div id={id} className="guide-anchor" />;

const SectionHeader = ({ icon, title }) => (
  <div className="guide-section__header">
    <span className="guide-section__icon">{icon}</span>
    <h2 className="guide-section__title">{title}</h2>
  </div>
);

const Lead  = ({ children }) => <p className="guide-lead">{children}</p>;
const Kbd   = ({ children }) => <kbd className="guide-kbd">{children}</kbd>;
const Tag   = ({ color, children }) => <span className={`guide-tag guide-tag--${color}`}>{children}</span>;
const Note  = ({ children }) => <div className="guide-note"><span className="guide-note__icon">ℹ</span><span>{children}</span></div>;
const Warn  = ({ children }) => <div className="guide-warn"><span className="guide-warn__icon">▲</span><span>{children}</span></div>;

const Step = ({ n, children }) => (
  <div className="guide-step">
    <span className="guide-step__num">{n}</span>
    <span className="guide-step__text">{children}</span>
  </div>
);

const ShortcutRow = ({ keys, description }) => (
  <div className="guide-shortcut">
    <div className="guide-shortcut__keys">
      {keys.map((k, i) => (
        <span key={i}><Kbd>{k}</Kbd>{i < keys.length - 1 && <span className="guide-shortcut__plus">+</span>}</span>
      ))}
    </div>
    <span className="guide-shortcut__desc">{description}</span>
  </div>
);

const DoList   = ({ items }) => <ul className="guide-dolist guide-dolist--do">{items.map((item, i) => <li key={i} className="guide-dolist__item"><span className="guide-dolist__icon guide-dolist__icon--do">✓</span>{item}</li>)}</ul>;
const DontList = ({ items }) => <ul className="guide-dolist guide-dolist--dont">{items.map((item, i) => <li key={i} className="guide-dolist__item"><span className="guide-dolist__icon guide-dolist__icon--dont">✕</span>{item}</li>)}</ul>;
const DoDont   = ({ dos, donts }) => (
  <div className="guide-dodont">
    <div className="guide-dodont__col"><div className="guide-dodont__label guide-dodont__label--do">Do</div><DoList items={dos} /></div>
    <div className="guide-dodont__col"><div className="guide-dodont__label guide-dodont__label--dont">Don't</div><DontList items={donts} /></div>
  </div>
);

const HlSwatch = ({ color }) => <span className={`guide-hl-swatch guide-hl-swatch--${color}`} />;
const HlSym    = ({ sym, char }) => <span className={`guide-hl-sym guide-hl-sym--${sym}`}>{char}</span>;

// ── Sections ───────────────────────────────────────────────────────────────────

function OverviewSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="overview" />
      <SectionHeader icon="◈" title="Overview" />
      <Lead>
        Helix is a desktop tool for monitoring, decoding, comparing and annotating
        ARINC 424 procedure files. It watches a folder on disk, decodes <Tag color="accent">.ari</Tag> and{" "}
        <Tag color="accent2">.sav</Tag> files as they arrive, and presents everything as structured,
        interactive tables — with a full cycle-diff engine and a built-in PDF toolkit.
      </Lead>
      <div className="guide-cards">
        {[
          { icon: "⊡", title: "Live watching",       body: "Monitors a folder in real time. Files are decoded the moment they land — no manual refresh." },
          { icon: "⊞", title: "Structured tables",   body: "Header, legs, waypoints, navaids and path-points decoded from fixed-width ARINC 424 records." },
          { icon: "↔", title: "Cycle compare",        body: "Diff two .ari files with a transition-aware engine. New (B) shown above old (A) struck-through." },
          { icon: "✦", title: "Highlighting",         body: "Annotate any cell with colour backgrounds and symbol markers for review workflows." },
          { icon: "⊕", title: "PDF tools",            body: "Merge, split, organise, rotate and compress PDF files — all without leaving the app." },
          { icon: "↑", title: "Auto updates",         body: "Background update checks with one-click download and install. No manual download needed." },
        ].map((c) => (
          <div key={c.title} className="guide-card">
            <div className="guide-card__icon">{c.icon}</div>
            <div className="guide-card__title">{c.title}</div>
            <div className="guide-card__body">{c.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilesSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="files" />
      <SectionHeader icon="⊡" title="Files & Watching" />
      <Lead>
        Helix watches a single folder recursively. Every <Tag color="accent">.ari</Tag> file found
        is decoded and listed in the sidebar. Paired <Tag color="accent2">.sav</Tag> patch files are
        detected and merged automatically.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Getting started</h3>
        <Step n={1}>Open <strong>Settings</strong> and click <strong>Browse</strong> to pick a watch folder.</Step>
        <Step n={2}>Click <strong>Start watching</strong>. The <Tag color="accent">LIVE</Tag> badge appears in the title bar.</Step>
        <Step n={3}>Drop any <strong>.ari</strong> file into the folder — it appears in the sidebar instantly.</Step>
        <Step n={4}>Click the file in the sidebar to open it in a tab.</Step>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">SAV patch files</h3>
        <p className="guide-body">
          When a <Tag color="accent2">.sav</Tag> file with the same stem as an <Tag color="accent">.ari</Tag> is
          detected, Helix merges them automatically. Records that come from the SAV appear with a blue left border.
          The <Tag color="accent2">SAV</Tag> badge shows in the file header when a merge is active.
        </p>
        <Note>SAV merge is record-level union — the ARI always wins on conflicts. The SAV only contributes records absent from the ARI.</Note>
      </div>
      <DoDont
        dos={["Watch the folder where your CIFP generator writes output", "Use sub-folders — Helix scans recursively", "Let the watcher run — it uses negligible CPU when idle"]}
        donts={["Watch a root drive (C:\\) — too many events", "Mix unrelated .ari files in the same folder"]}
      />
    </section>
  );
}

function TabsSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="tabs" />
      <SectionHeader icon="⊟" title="Tabs" />
      <Lead>
        Each decoded file and each compare session gets its own tab. Tabs persist while the app
        is running — switching never re-decodes the file. Highlights survive tab switches.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Opening tabs</h3>
        <Step n={1}>Click a file in the sidebar — opens in a new tab.</Step>
        <Step n={2}>Files arriving via the watcher open automatically with a <Tag color="warn">● new</Tag> dot.</Step>
        <Step n={3}>Click <strong>+</strong> in the tab bar to pick from loaded files.</Step>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Keyboard shortcuts</h3>
        <ShortcutRow keys={["Ctrl", "Tab"]}        description="Next tab" />
        <ShortcutRow keys={["Ctrl", "Shift", "Tab"]} description="Previous tab" />
        <ShortcutRow keys={["Ctrl", "W"]}          description="Close active tab" />
        <Note>Middle-click any tab to close it.</Note>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Tab limit</h3>
        <p className="guide-body">
          Default limit is <strong>5 tabs</strong>. When reached, the oldest tab closes automatically.
          Change the limit (1–10) in Settings.
        </p>
      </div>
      <DoDont
        dos={["Use Ctrl+Tab to quickly flip between two files you are comparing", "Increase the limit if you routinely review many files at once"]}
        donts={["Rely on tabs as permanent storage — they reset on app close", "Set the limit higher than you actually need"]}
      />
    </section>
  );
}

function TablesSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="tables" />
      <SectionHeader icon="⊞" title="Table View" />
      <Lead>
        Each decoded file is presented as stacked tables — Header, Procedure legs, Waypoints,
        Navaids, and Path Points. The original raw ARINC 424 text is available via the{" "}
        <strong>Raw</strong> toggle.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Header table</h3>
        <p className="guide-body">
          One row of procedure-level metadata: procedure ID, variation, vertical angle, TCH,
          GNSS/FMS capability, qualifiers, cycle and altitude units.
        </p>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Procedure table</h3>
        <p className="guide-body">
          One row per leg following the ARINC 424 field layout: Seq, Trans, CAT, FO, Path
          terminator, RNP, Fix attribute, Component, Fix, Altitude, Speed, Course, Turn,
          Distance, Radius, Recom navaid and coordinate fields.
        </p>
        <p className="guide-body">
          Legs are grouped by transition with a thin divider between segments. The missed
          approach starts at the first leg where <Tag color="warn">Comp = M</Tag> — all
          subsequent legs are labelled <Tag color="danger">MISSED</Tag>.
        </p>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Multiple procedures per file</h3>
        <p className="guide-body">
          A single .ari may contain multiple procedures. Selector tabs appear below the file
          header when more than one is present.
        </p>
      </div>
      <DoDont
        dos={["Switch to Raw view to verify a decoded value against the source record", "Check the SAV badge — blue-bordered rows came from the patch file"]}
        donts={["Assume empty cells are errors — many ARINC fields are conditional", "Try to edit data in the table — it is read-only"]}
      />
    </section>
  );
}

function HighlightSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="highlight" />
      <SectionHeader icon="✦" title="Highlighting" />
      <Lead>
        Any cell in any table — including the compare view — can be annotated with a colour
        background, a symbol marker, or both. Highlights survive tab switches but reset on app close.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Available tools</h3>
        <div className="guide-hl-palette">
          <div className="guide-hl-row">
            <span className="guide-hl-group-label">Colours</span>
            <div className="guide-hl-items">
              {[["yellow","Yellow"],["green","Green"],["blue","Blue"],["red","Red"]].map(([c,l]) => (
                <span key={c} className="guide-hl-item"><HlSwatch color={c} /> {l}</span>
              ))}
            </div>
          </div>
          <div className="guide-hl-row">
            <span className="guide-hl-group-label">Symbols</span>
            <div className="guide-hl-items">
              {[["flag","⚑","Flag"],["check","✔","Check"],["dot","●","Dot"],["warn","▲","Warn"]].map(([s,c,l]) => (
                <span key={s} className="guide-hl-item"><HlSym sym={s} char={c} /> {l}</span>
              ))}
            </div>
          </div>
        </div>
        <Note>Colour and symbol are independent — a cell can have both at the same time.</Note>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">How to highlight</h3>
        <Step n={1}><strong>Right-click</strong> any cell to open the highlight context menu.</Step>
        <Step n={2}>Pick a colour or symbol — this sets it as the <strong>active tool</strong>.</Step>
        <Step n={3}><strong>Single-click</strong> any cell to apply the active tool.</Step>
        <Step n={4}><strong>Shift + click</strong> a second cell to apply the tool to the entire range between them.</Step>
        <Step n={5}><strong>Double-click</strong> any cell to clear all highlights from it.</Step>
      </div>
      <DoDont
        dos={["Use colour for categories — yellow for review, red for errors", "Use symbols alongside colours to encode two dimensions at once", "Shift+click to mark a range of legs in one action"]}
        donts={["Rely on highlights as permanent record — they reset on close", "Apply the same highlight to everything — it loses meaning"]}
      />
      <Warn>Highlights are session-only. They are not saved to disk.</Warn>
    </section>
  );
}

function CompareSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="compare" />
      <SectionHeader icon="↔" title="Compare" />
      <Lead>
        The Compare view uses a <strong>transition-aware diff engine</strong> to compare two decoded{" "}
        <Tag color="accent">.ari</Tag> files cycle-by-cycle. All rows are shown by default — use the{" "}
        <strong>All / Diff only</strong> toggle in the header bar to hide identical rows when needed.
        Changed fields show the new value (B) above the old value (A) struck through, inline in the same cell.
      </Lead>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">How to compare</h3>
        <Step n={1}>Navigate to <strong>Compare</strong> in the nav rail.</Step>
        <Step n={2}>
          Select <strong>File A</strong> (base / older) and <strong>File B</strong> (newer) from the dropdowns.
          The engine automatically sorts by cycle number — load in any order.
        </Step>
        <Step n={3}>If a file has multiple procedures, procedure tabs appear — select which to diff.</Step>
        <Step n={4}>
          Use the <strong>transition tabs</strong> to narrow to a single transition (FINAL, MISSED, or a named
          transition). <strong>All</strong> compares every transition at once.
        </Step>
        <Step n={5}>
          Check the <strong>summary strip</strong> — shows changed / added / removed counts for Header, Legs,
          Waypoints, Navaids, Minima and Raw at a glance.
        </Step>
        <Step n={6}>
          Use the <strong>All / Diff only</strong> toggle (top-right of the header bar) to show or hide identical rows across all sections simultaneously.
        </Step>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">View toggle — All vs Diff only</h3>
        <p className="guide-body">
          By default <strong>All</strong> is active — every row is visible, including identical ones.
          This gives full context so nothing is hidden from you. Switch to <strong>Diff only</strong> to collapse
          unchanged rows and focus on exactly what changed. The toggle applies to every section (Header, Legs,
          Waypoints, Navaids, Minima, Raw) simultaneously.
        </p>
        <Note>
          A footnote note below each section shows how many identical rows are present, so you always know
          what "All" mode is showing you even when "Diff only" is off.
        </Note>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Reading the diff</h3>
        <div className="guide-diff-legend">
          <div className="guide-diff-row guide-diff-row--changed">
            <Tag color="warn">Changed</Tag>
            <span className="guide-body">Field differs — new value (B) above, old (A) struck through in the same cell</span>
          </div>
          <div className="guide-diff-row guide-diff-row--added">
            <Tag color="accent">Added</Tag>
            <span className="guide-body">Leg or record exists only in File B (newer)</span>
          </div>
          <div className="guide-diff-row guide-diff-row--removed">
            <Tag color="danger">Removed</Tag>
            <span className="guide-body">Leg or record exists only in File A (older)</span>
          </div>
        </div>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Highlighting in compare</h3>
        <p className="guide-body">
          All highlighting tools work identically in the compare view — right-click any cell, pick a tool,
          click to apply. Highlights are scoped to the compare session and persist across tab switches
          just like the decoded view.
        </p>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Multiple compare sessions</h3>
        <p className="guide-body">
          Use the <strong>+</strong> button in the tab bar to open additional independent compare sessions.
          Each session has its own file selection, procedure filter, transition filter, view toggle state,
          and highlights.
        </p>
      </div>

      <DoDont
        dos={[
          "Use 'All' mode by default — it gives full context; switch to 'Diff only' when the table is noisy",
          "Check the summary strip first — it tells you at a glance which sections changed",
          "Use transition tabs to focus on one segment when the full diff is large",
          "Open multiple Compare tabs to review several procedures simultaneously",
          "Highlight cells in the compare view just as you would in the decoded view",
        ]}
        donts={[
          "Compare files from different airports or different procedure types",
          "Ignore the procedure tabs — you may be diffing the wrong procedure",
          "Ignore the 'A·old / B·new' header labels — they tell you which side is which",
        ]}
      />
    </section>
  );
}

function PDFSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="pdf" />
      <SectionHeader icon="⊕" title="PDF Tools" />
      <Lead>
        The PDF Tools page provides five browser-side PDF operations powered by pdf-lib —
        no external service is used. Files are processed locally and saved to your chosen
        output folder.
      </Lead>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Merge</h3>
        <p className="guide-body">
          Combine multiple PDF files into one. Drag to reorder files in the list, or use the
          <strong> ▲ ▼</strong> buttons. Set a custom output filename and click <strong>Merge</strong>.
        </p>
        <Step n={1}>Drop or browse for two or more PDFs.</Step>
        <Step n={2}>Drag or use ▲ ▼ to set the page order.</Step>
        <Step n={3}>Type an output filename (optional) and click <strong>Merge</strong>.</Step>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Split</h3>
        <p className="guide-body">
          Extract pages from a PDF. Three modes are available:
        </p>
        <p className="guide-body">
          <strong>Every N pages</strong> — splits into chunks of N (e.g. every 1 page = one file per page).
          <br/>
          <strong>Page ranges</strong> — enter comma-separated ranges like <Tag color="accent2">1-3, 5, 7-9</Tag>.
          <br/>
          <strong>Extract pages</strong> — enter a comma-separated list of individual page numbers.
        </p>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Organise</h3>
        <p className="guide-body">
          Reorder, rotate and remove pages from a single PDF. Each page is shown as a thumbnail card with four controls:
        </p>
        <p className="guide-body">
          <strong>◀ ▶</strong> — move the page left or right.<br/>
          <strong>↺ ↻</strong> — rotate the page 90° counter-clockwise or clockwise.<br/>
          <strong>✕</strong> — mark the page for removal (greyed out). Click <strong>↩</strong> to restore it.
        </p>
        <p className="guide-body">
          Drag-and-drop also works between cards. Click <strong>Save organised PDF</strong> when done.
        </p>
        <Note>Removed pages are excluded from the saved file but are never deleted from the source PDF.</Note>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Rotate</h3>
        <p className="guide-body">
          Rotate all pages or a specific page range in a single PDF. Choose <strong>90° CW</strong>,{" "}
          <strong>180°</strong> or <strong>90° CCW</strong>. Leave the page range blank to rotate all pages.
          Rotation is applied on top of any existing rotation already embedded in the page.
        </p>
        <Step n={1}>Drop a PDF.</Step>
        <Step n={2}>Select the angle.</Step>
        <Step n={3}>Optionally enter a page range (e.g. <Tag color="accent2">2-4</Tag>).</Step>
        <Step n={4}>Click <strong>Rotate pages</strong>.</Step>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Compress</h3>
        <p className="guide-body">
          Lossless optimisation — strips embedded metadata (title, author, producer, keywords) and
          re-saves with compact object streams. No image quality is reduced. Supports batch processing:
          drop multiple files and process them all at once. Each file shows the space saved as a percentage.
        </p>
        <Warn>
          Compression is metadata-only. For significant size reduction on image-heavy PDFs, a dedicated
          tool with downsampling is needed.
        </Warn>
      </div>

      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Output folder</h3>
        <p className="guide-body">
          All PDF operations save to a configured output folder. Helix prompts you to choose one
          the first time you run any operation. Change it at any time via <strong>Settings → PDF output folder</strong>.
        </p>
      </div>

      <DoDont
        dos={[
          "Use Merge for daily cycle report bundles — drop all files, set the name, click Merge",
          "Use Organise's ◀ ▶ buttons for reliable reordering when drag-and-drop feels imprecise",
          "Use Rotate for PDFs generated in landscape that display sideways in viewers",
          "Use Compress on any PDF before emailing — often saves 10–40% with zero quality loss",
          "Batch-drop multiple PDFs onto Compress to optimise them all in one click",
        ]}
        donts={[
          "Use Compress to reduce scanned PDFs — image data is not touched",
          "Forget to set an output folder — you'll be prompted on first use",
        ]}
      />
    </section>
  );
}

function UpdatesSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="updates" />
      <SectionHeader icon="↑" title="Updates" />
      <Lead>
        Helix checks for updates automatically on startup (packaged builds only). A banner appears
        in the header bar when an update is available — you are always in control of whether to
        download and install it.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Update flow</h3>
        <Step n={1}><Tag color="accent2">Update available</Tag> — a banner shows the new version. Click <strong>Download</strong> to start.</Step>
        <Step n={2}>A progress bar shows download progress inline in the banner.</Step>
        <Step n={3}><Tag color="accent">Ready to install</Tag> — click <strong>Restart & Install</strong> to apply. Unsaved highlights will be lost.</Step>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Manual check</h3>
        <p className="guide-body">
          Go to <strong>Settings → Updates → Check now</strong> to trigger a manual check at any time.
          This works even if auto-check is disabled.
        </p>
      </div>
      <Note>
        Auto-update checks are silent — if the check fails (e.g. offline), the app starts normally
        with no error shown.
      </Note>
      <DoDont
        dos={["Keep auto-update enabled — updates are downloaded only when you confirm", "Use 'Check now' in Settings before a critical review session to ensure you have the latest decoder"]}
        donts={["Click 'Restart & Install' in the middle of a review session — your highlight annotations will be lost"]}
      />
    </section>
  );
}

function SettingsSection() {
  return (
    <section className="guide-section">
      <SectionAnchor id="settings" />
      <SectionHeader icon="⚙" title="Settings" />
      <Lead>
        All preferences are persisted automatically — you never need to save manually. Settings survive
        app restarts.
      </Lead>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Watch folder</h3>
        <p className="guide-body">
          The folder Helix monitors. The last folder is remembered and the watcher restarts automatically
          on next launch. Use <strong>Start</strong> / <strong>Stop</strong> to control the watcher
          without changing the folder.
        </p>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">PDF output folder</h3>
        <p className="guide-body">
          The folder where all PDF Tools operations save their output. Set it once; change it any time
          with the <strong>Change folder</strong> button.
        </p>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Max open tabs</h3>
        <p className="guide-body">
          Controls how many files can be open at once (1–10, default 5). When the limit is reached,
          the oldest tab closes automatically.
        </p>
      </div>
      <div className="guide-subsection">
        <h3 className="guide-subsection__title">Appearance</h3>
        <p className="guide-body">
          Switch between <strong>Dark</strong> (default) and <strong>Light</strong> themes. The theme
          also toggles via the moon/sun icon at the bottom of the nav rail.
        </p>
      </div>
      <DoDont
        dos={["Set the watch folder once and leave the watcher running", "Set the PDF output folder once — all five PDF tools share it", "Use the nav rail theme button for a quick switch without opening Settings"]}
        donts={["Enable auto-open in default app if files arrive frequently — it will open many windows", "Stop the watcher and forget — the LIVE badge disappears from the title bar when it is off"]}
      />
    </section>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────

function GuideNav({ active, onSelect }) {
  return (
    <nav className="guide-nav">
      <div className="guide-nav__label">On this page</div>
      {SECTIONS.map((s) => (
        <button key={s.id} onClick={() => onSelect(s.id)}
          className={`guide-nav__item ${active === s.id ? "guide-nav__item--active" : ""}`}>
          <span className="guide-nav__icon">{s.icon}</span>
          {s.title}
        </button>
      ))}
    </nav>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const [active, setActive] = useState("overview");

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  useEffect(() => {
    const container = document.getElementById("guide-scroll");
    if (!container) return;
    const onScroll = () => {
      const scrollTop = container.scrollTop;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop - container.offsetTop - 80 <= scrollTop) current = s.id;
      }
      setActive(current);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="guide">
      <div className="guide__header">
        <h1 className="guide__title">Helix — User Guide</h1>
        <p className="guide__subtitle">ARINC 424 file monitor · complete feature reference</p>
      </div>
      <div className="guide__body">
        <GuideNav active={active} onSelect={scrollTo} />
        <div id="guide-scroll" className="guide__content">
          <OverviewSection />
          <FilesSection />
          <TabsSection />
          <TablesSection />
          <HighlightSection />
          <CompareSection />
          <PDFSection />
          <UpdatesSection />
          <SettingsSection />
          <div className="guide-footer">Helix v1.0.0 · ARINC 424 file monitor</div>
        </div>
      </div>
    </div>
  );
}
