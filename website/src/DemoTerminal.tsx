import type { DemoFrame } from "./demoStory";
import { TrafficLights } from "./DemoWindowChrome";
export function DemoTerminal({
  scene,
  typedCount,
  visibleLines,
  complete,
}: Pick<DemoFrame, "scene" | "typedCount" | "visibleLines" | "complete">) {
  return (
    <div className="terminal-window">
      <div className="terminal-bar">
        <TrafficLights />
        <span>
          AI agent <i>/</i> sample-app
        </span>
        <span className="terminal-badge">Kavranta 연결됨</span>
      </div>
      <div className="terminal-content">
        <div className="terminal-intro">
          <span>✳</span>
          <div>
            <strong>좋은 흐름은, 끊기지 않으니까.</strong>
            <small>환경변수 작업을 자연스럽게 요청하세요.</small>
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
          <span>◇ 보호된 값은 대화에 반환되지 않습니다</span>
          <span>{complete ? "완료" : "작업 중"}</span>
        </div>
      </div>
    </div>
  );
}
