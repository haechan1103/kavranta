import type { DemoFrame } from "./demoStory";
import { TrafficLights } from "./DemoWindowChrome";
import { useSiteLocale } from "./SiteLocale";
import "./DemoAppWindow.css";

/** A scaled illustration of the 0.7.20 desktop layout. Synthetic names only, never values. */
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
  const variableCount = hasVariable ? 4 : 3;
  const pending = hasVariable && !complete && !linked && !deployed;
  return (
    <div className="app-window" aria-label={c.appLabel}>
      <div className="window-bar">
        <TrafficLights />
        <span>Kavranta</span>
        <span className="window-status">{c.localProject}</span>
      </div>
      <div className="da-layout">
        <aside className="da-sidebar">
          <div className="da-brand">
            <img src="./brand/kavranta-logo.svg" alt="" /> Kavranta
          </div>
          <div className="da-project">
            <span>S</span> sample-app <small>{c.change}</small>
          </div>
          <p className="da-label">{c.envFiles}</p>
          <div className="da-nav da-file active">
            <i />
            <span>
              Local environment
              <code>.env.local</code>
            </span>
            {pending && <b className="da-badge">1</b>}
          </div>
          <div className={`da-nav da-file ${linked ? "linked" : ""}`}>
            <i />
            <span>
              Development
              <code>.env.development</code>
            </span>
            {linked && <b className="da-link-mark">↗</b>}
          </div>
          <p className="da-label">{c.views}</p>
          <div className="da-nav">
            <NavIcon kind="overview" /> {c.overview}
          </div>
          <div className="da-nav">
            <NavIcon kind="compare" /> {c.compare}
          </div>
          <div className="da-nav">
            <NavIcon kind="activity" /> {c.activity}
            {visibleLines > 0 && !complete && <i className="live-dot" />}
          </div>
          <p className="da-label">{c.share}</p>
          <div className={`da-nav ${deployed ? "pushed" : ""}`}>
            <NavIcon kind="push" /> {c.push}
          </div>
          <div className="da-footer">
            <span className="live-dot" /> {c.connected}
          </div>
        </aside>
        <div className="da-main">
          <div className="da-topbar">
            <span className="da-crumb">
              sample-app <span>/</span> <b>Local environment</b>
            </span>
            <span className="da-search">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              {c.search}
              <kbd>⌘K</kbd>
            </span>
            <span className="da-push">{c.push}</span>
          </div>
          <div className="da-content">
            <div className="da-heading">
              <div>
                <h3>Local environment</h3>
                <code>.env.local</code>
                <p>
                  {variableCount} {c.variables} · 2 {c.groups}
                </p>
              </div>
              <div className="da-actions">
                <span className="da-switch">
                  <b>{c.table}</b>
                  <span>{c.source}</span>
                </span>
                <span className="da-primary">{c.add}</span>
              </div>
            </div>
            <div className="da-chips">
              <span className="active">
                {c.all} <small>{variableCount}</small>
              </span>
              <span>
                {c.empty} <small>{hasVariable && !hasValue ? 1 : 0}</small>
              </span>
              <span>
                {c.pending} <small>{pending && hasValue ? 1 : 0}</small>
              </span>
              <span>
                {c.aiCannotRead} <small>{hasVariable ? 2 : 1}</small>
              </span>
            </div>
            <div className="da-table">
              <div className="da-head">
                <span>{c.colKey}</span>
                <span>{c.colValue}</span>
                <span>{c.colAccess}</span>
                <span>{c.colLinks}</span>
              </div>
              <div className="da-group">
                ⌄ Application <small>2</small>
              </div>
              <DemoRow name="APP_NAME" description={c.appName} allowed />
              <DemoRow name="NODE_ENV" description={c.mode} allowed />
              <div className="da-group">
                ⌄ Authentication <small>{hasVariable ? 2 : 1}</small>
              </div>
              <DemoRow name="DATABASE_URL" description={c.database} />
              {hasVariable && (
                <div className="animated-variable">
                  <DemoRow
                    name="AUTH_SECRET"
                    description={c.secret}
                    empty={!hasValue}
                    changed={pending && hasValue}
                    linked={linked}
                  />
                  {linked && (
                    <div className="demo-link-detail">
                      <span>↗ {c.twoLinked}</span>
                      <code>.env.local</code>
                      <code>.env.development</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            className={`demo-save-status ${pending && hasValue ? "pending" : ""}`}
            role="status"
          >
            {complete ? (
              <>
                <span className="da-check">✓</span>{" "}
                {deployed ? c.pushed : linked ? c.twoSaved : c.saved}
              </>
            ) : pending && hasValue ? (
              <>
                <span className="da-dot" /> <b>{c.pendingCount}</b>{" "}
                <small>{c.pendingDetail}</small>
                <span className="da-save-actions">
                  <span>{c.review}</span>
                  <span className="da-save">
                    {c.save} <kbd>⌘S</kbd>
                  </span>
                </span>
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
  changed = false,
  linked = false,
}: {
  name: string;
  description: string;
  allowed?: boolean;
  empty?: boolean;
  changed?: boolean;
  linked?: boolean;
}) {
  const {
    copy: { demo: c },
  } = useSiteLocale();
  return (
    <div className={`da-row ${changed ? "changed" : ""}`}>
      <div className="da-key">
        <code>{name}</code>
        <small>{description}</small>
      </div>
      <div className="da-value-cell">
        <span className={`da-value ${empty ? "empty" : ""}`}>
          {empty ? (
            c.required
          ) : (
            <>
              {c.valueSet} <i>••••</i>
            </>
          )}
        </span>
        {changed && <span className="da-changed">{c.changed}</span>}
      </div>
      <span className={`da-access ${allowed ? "allowed" : ""}`}>
        {allowed ? c.allowed : c.protected}
      </span>
      <span className={`da-links ${linked ? "linked" : ""}`}>
        {linked ? `↗ ${c.twoLinked}` : "—"}
      </span>
    </div>
  );
}

function NavIcon({ kind }: { kind: "overview" | "compare" | "activity" | "push" }) {
  return (
    <svg className="da-icon" viewBox="0 0 24 24" aria-hidden="true">
      {kind === "overview" && (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </>
      )}
      {kind === "compare" && (
        <>
          <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
          <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
        </>
      )}
      {kind === "activity" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3.2 2" />
        </>
      )}
      {kind === "push" && <path d="M12 16V4m0 0-4 4m4-4 4 4M5 14v5h14v-5" />}
    </svg>
  );
}
