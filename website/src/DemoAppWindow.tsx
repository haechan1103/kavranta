import type { DemoFrame } from "./demoStory";
import { TrafficLights } from "./DemoWindowChrome";
import { useSiteLocale } from "./SiteLocale";
export function DemoAppWindow({
  hasVariable,
  hasValue,
  linked,
  complete,
  deployed,
  visibleLines,
}: Pick<
  DemoFrame,
  | "hasVariable"
  | "hasValue"
  | "linked"
  | "complete"
  | "deployed"
  | "visibleLines"
>) {
  const {
    copy: { demo: c },
  } = useSiteLocale();
  return (
    <div className="app-window" aria-label={c.appLabel}>
      <div className="window-bar">
        <TrafficLights />
        <span>Kavranta</span>
        <span className="window-status">{c.localProject}</span>
      </div>
      <div className="demo-app-layout">
        <aside className="demo-sidebar">
          <div className="demo-brand">
            <img src="./brand/kavranta-logo.svg" alt="" /> Kavranta
          </div>
          <div className="demo-project">
            <span>S</span> sample-app <small>⌄</small>
          </div>
          <div className="demo-nav-item">
            ⌁ <span>{c.overview}</span>
          </div>
          <div className="demo-nav-item">
            ◇ <span>{c.connections}</span>
          </div>
          <div className="demo-nav-item">
            ◷ <span>{c.activity}</span>
            <i className="live-dot" />
          </div>
          <p className="demo-nav-label">ENV FILES</p>
          <div className="demo-nav-item selected">
            ▤ <span>Local</span>
            <small>{hasVariable ? 4 : 3}</small>
          </div>
          <div className={`demo-nav-item ${linked ? "linked-file" : ""}`}>
            ▤ <span>Development</span>
            {linked && <small>↗</small>}
          </div>
          <div className="demo-sidebar-footer">
            <span className="live-dot" /> {c.connected}
          </div>
        </aside>
        <div className="demo-editor">
          <div className="editor-breadcrumb">
            sample-app <span>/</span> {c.variables}
          </div>
          <div className="editor-heading">
            <div>
              <h3>Local environment</h3>
              <p>
                {hasVariable ? 4 : 3} {c.variables} · 2 {c.groups}
              </p>
            </div>
            <span className="demo-add-label">{c.add}</span>
          </div>
          <div className="editor-tabs">
            <span>{c.all}</span>
            <span>
              {c.linked} <b>{linked ? 1 : 0}</b>
            </span>
            <span>
              {c.missing} <b>{hasVariable && !hasValue ? 1 : 0}</b>
            </span>
          </div>
          <div className="demo-group">
            <header>
              <span>⌄ &nbsp; Application</span>
              <small>2 VARIABLES</small>
            </header>
            <DemoRow name="APP_NAME" description={c.appName} allowed />
            <DemoRow name="NODE_ENV" description={c.mode} allowed />
          </div>
          <div className="demo-group">
            <header>
              <span>⌄ &nbsp; Authentication</span>
              <small>{hasVariable ? 2 : 1} VARIABLES</small>
            </header>
            <DemoRow name="DATABASE_URL" description={c.database} />
            {hasVariable && (
              <div className="animated-variable">
                <DemoRow
                  name="AUTH_SECRET"
                  description={c.secret}
                  empty={!hasValue}
                  highlighted
                />
                {linked && (
                  <div className="demo-link-detail">
                    <span>↗ &nbsp; {c.twoLinked}</span>
                    <code>Local</code>
                    <code>Development</code>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="demo-save-status" role="status">
            {complete ? (
              <>
                <span>✓</span>{" "}
                {deployed ? c.pushed : linked ? c.twoSaved : c.saved}
              </>
            ) : (
              <>
                <span className="live-dot" />{" "}
                {visibleLines > 0 ? c.working : c.idle}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function DemoRow({
  name,
  description,
  allowed = false,
  empty = false,
  highlighted = false,
}: {
  name: string;
  description: string;
  allowed?: boolean;
  empty?: boolean;
  highlighted?: boolean;
}) {
  const {
    copy: { demo: c },
  } = useSiteLocale();
  return (
    <div className={`demo-variable ${highlighted ? "highlighted" : ""}`}>
      <div>
        <code>{name}</code>
        <small>{description}</small>
      </div>
      <span className={`masked-value ${empty ? "empty-value" : ""}`}>
        {empty ? c.required : "••••••••••••"}
        <span aria-hidden="true">◎</span>
      </span>
      <span className={`policy-pill ${allowed ? "allowed" : ""}`}>
        {allowed ? c.allowed : c.protected}
      </span>
    </div>
  );
}
