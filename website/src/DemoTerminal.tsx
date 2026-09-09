import type { DemoFrame } from "./demoStory";
import { TrafficLights } from "./DemoWindowChrome";
import { useSiteLocale } from "./SiteLocale";
export function DemoTerminal({
  scene,
  typedCount,
  visibleLines,
  complete,
}: Pick<DemoFrame, "scene" | "typedCount" | "visibleLines" | "complete">) {
  const {
    copy: { demo: c },
  } = useSiteLocale();
  return (
    <div className="terminal-window">
      <div className="terminal-bar">
        <TrafficLights />
        <span>
          AI agent <i>/</i> sample-app
        </span>
        <span className="terminal-badge">{c.terminalConnected}</span>
      </div>
      <div className="terminal-content">
        <div className="terminal-intro">
          <span>✳</span>
          <div>
            <strong>{c.terminalTitle}</strong>
            <small>{c.terminalBody}</small>
          </div>
        </div>
        <div className="terminal-prompt" aria-label={scene.prompt}>
          <span aria-hidden="true">❯</span>
          <p aria-hidden="true">
            {scene.prompt.slice(0, typedCount)}
            <span
              className={`typing-cursor ${typedCount < scene.prompt.length ? "active" : ""}`}
            />
          </p>
        </div>
        <div className="terminal-results" aria-hidden="true">
          {scene.lines.slice(0, visibleLines).map((line, index) => (
            <div className="terminal-result" key={line}>
              <span>{index === 3 ? "✓" : "↳"}</span>
              {line}
            </div>
          ))}
        </div>
        <div className="terminal-foot">
          <span>◇ {c.terminalNote}</span>
          <span>{complete ? c.done : c.inProgress}</span>
        </div>
      </div>
    </div>
  );
}
