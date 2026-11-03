import { useState, type KeyboardEvent } from "react";
import compareFiles from "../../assets/screenshots/kavranta-compare-files.png";
import sourceView from "../../assets/screenshots/kavranta-source-view.png";
import commandPalette from "../../assets/screenshots/kavranta-command-palette.png";
import pushReview from "../../assets/screenshots/kavranta-push-review.png";
import { TrafficLights } from "./DemoWindowChrome";
import { useSiteLocale } from "./SiteLocale";
import "./Showcase.css";

const shots = [compareFiles, sourceView, commandPalette, pushReview];
const releaseNotes =
  "https://github.com/haechan1103/kavranta/releases/tag/v0.7.20";

/** Real 0.7.20 screenshots (synthetic data) behind an accessible tab list. */
export function Showcase() {
  const {
    copy: { showcase: c },
  } = useSiteLocale();
  const [active, setActive] = useState(0);
  const tab = c.tabs[active];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = c.tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? active === last ? 0 : active + 1
        : event.key === "ArrowLeft"
          ? active === 0 ? last : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`showcase-tab-${next}`)?.focus();
  };

  return (
    <section className="showcase section-shell" id="whats-new">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>
            {c.title[0]}
            <br />
            {c.title[1]}
          </h2>
        </div>
        <div className="showcase-intro">
          <p>{c.body}</p>
          <a className="text-link" href={releaseNotes}>
            {c.release} ↗
          </a>
        </div>
      </div>
      <div
        className="showcase-tabs"
        role="tablist"
        aria-label={c.eyebrow}
        onKeyDown={onKeyDown}
      >
        {c.tabs.map((item, index) => (
          <button
            key={item.label}
            id={`showcase-tab-${index}`}
            role="tab"
            aria-selected={active === index}
            aria-controls="showcase-panel"
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
          >
            <span>0{index + 1}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="showcase-panel"
        id="showcase-panel"
        role="tabpanel"
        aria-labelledby={`showcase-tab-${active}`}
      >
        <div className="showcase-copy">
          <h3>{tab?.title}</h3>
          <p>{tab?.body}</p>
          <small>{c.caption}</small>
        </div>
        <figure className="showcase-window">
          <div className="showcase-bar">
            <TrafficLights />
            <span>Kavranta</span>
          </div>
          <img
            key={active}
            src={shots[active]}
            alt={tab?.alt ?? ""}
            width={1440}
            height={940}
            loading="lazy"
          />
        </figure>
      </div>
    </section>
  );
}
