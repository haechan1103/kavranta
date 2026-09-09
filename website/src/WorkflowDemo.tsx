import { DemoAppWindow } from "./DemoAppWindow";
import { DemoTerminal } from "./DemoTerminal";
import { koreanScenes, scenes, SCENE_DURATION_MS } from "./demoStory";
import { useSiteLocale } from "./SiteLocale";
import { useDemoPlayback } from "./useDemoPlayback";
import "./WorkflowDemo.css";
import "./WorkflowDemo.responsive.css";

export function WorkflowDemo() {
  const { locale, copy } = useSiteLocale();
  const c = copy.demo;
  const stories = locale === "ko" ? koreanScenes : scenes;
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
  } = useDemoPlayback(stories);

  return (
    <section
      className="workflow"
      id="demo"
      ref={container}
      aria-label={c.label}
    >
      <div className="demo-stage">
        <div className="stage-caption">
          <span className="live-dot" /> YOUR FILES. YOUR FLOW.
          <span>{c.label}</span>
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
          <span>↗</span> {c.seal[0]}
          <br />
          {c.seal[1]}
        </div>
      </div>
      <div className="demo-controls">
        <div className="scene-buttons" aria-label={c.scenarios}>
          {stories.map((item, index) => (
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
          aria-label={playing ? c.pause : c.play}
        >
          {playing ? "Ⅱ" : "▷"}
        </button>
        <button
          className="playback-button"
          onClick={replay}
          aria-label={c.replay}
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
          {c.disclosure[0]}
          <br />
          {c.disclosure[1]}
        </span>
      </div>
      <details className="demo-transcript">
        <summary>{c.transcript}</summary>
        {stories.map((item) => (
          <div key={item.label}>
            <h4>{item.label}</h4>
            <p>
              {c.request}: {item.prompt}
            </p>
            <p>
              {c.result}: {item.lines.at(-1)}
            </p>
          </div>
        ))}
      </details>
    </section>
  );
}
