import { DemoAppWindow } from "./DemoAppWindow";
import { DemoTerminal } from "./DemoTerminal";
import { scenes, SCENE_DURATION_MS } from "./demoStory";
import { useDemoPlayback } from "./useDemoPlayback";
import "./WorkflowDemo.css";
import "./WorkflowDemo.responsive.css";

export function WorkflowDemo() {
  const {
    sceneIndex,
    elapsed,
    playing,
    container,
    scene,
    selectScene,
    replay,
    togglePlayback,
    typedCount,
    visibleLines,
    complete,
    hasVariable,
    hasValue,
    linked,
    deployed,
  } = useDemoPlayback();

  return (
    <section
      className="workflow"
      id="demo"
      ref={container}
      aria-label="Kavranta 인터랙티브 제품 데모"
    >
      <div className="demo-stage">
        <div className="stage-caption">
          <span className="live-dot" /> YOUR FILES. YOUR FLOW.
          <span>INTERACTIVE PRODUCT DEMO</span>
        </div>
        <DemoAppWindow
          hasVariable={hasVariable}
          hasValue={hasValue}
          linked={linked}
          complete={complete}
          deployed={deployed}
          visibleLines={visibleLines}
        />
        <DemoTerminal
          scene={scene}
          typedCount={typedCount}
          visibleLines={visibleLines}
          complete={complete}
        />
        <div className="stage-seal">
          <span>↗</span> 요청은 자연스럽게.
          <br />
          반영은 정확하게.
        </div>
      </div>
      <div className="demo-controls">
        <div className="scene-buttons" aria-label="데모 시나리오">
          {scenes.map((item, index) => (
            <button
              key={item.label}
              aria-pressed={sceneIndex === index}
              onClick={() => selectScene(index)}
            >
              <span>0{index + 1}</span>
              {item.label}
              <i
                style={{
                  transform: `scaleX(${sceneIndex === index ? elapsed / SCENE_DURATION_MS : 0})`,
                }}
              />
            </button>
          ))}
        </div>
        <button
          className="playback-button"
          onClick={togglePlayback}
          aria-label={playing ? "데모 일시정지" : "데모 재생"}
        >
          {playing ? "Ⅱ" : "▷"}
        </button>
        <button
          className="playback-button"
          onClick={replay}
          aria-label="데모 처음부터 재생"
        >
          ↺
        </button>
      </div>
      <div className="demo-description">
        <div>
          <h3>{scene.title}</h3>
          <p>{scene.description}</p>
        </div>
        <span>
          합성 데이터로 재현한 데모입니다.
          <br />
          실제 파일 변경이나 외부 전송은 없습니다.
        </span>
      </div>
      <details className="demo-transcript">
        <summary>데모를 텍스트로 읽기</summary>
        {scenes.map((item) => (
          <div key={item.label}>
            <h4>{item.label}</h4>
            <p>요청: {item.prompt}</p>
            <p>결과: {item.lines.at(-1)}</p>
          </div>
        ))}
      </details>
    </section>
  );
}
