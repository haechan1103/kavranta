import { useState } from "react";
import { useSiteLocale } from "./SiteLocale";
import "./LinkPlayground.css";

const fileNames = ["Local", "Development", "Production"];

export function LinkPlayground() {
  const { copy } = useSiteLocale();
  const c = copy.playground;
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const reset = () => {
    setSelected([]);
    setPreview(null);
    setRevisions({});
    setSaved([]);
  };

  return (
    <section
      id="try"
      className="link-playground section-shell"
      aria-label={c.label}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
        </div>
        <p>{c.body}</p>
      </div>
      <div className="playground-files">
        {fileNames.map((name) => (
          <article
            key={name}
            className={
              preview?.includes(name)
                ? "playground-file will-change"
                : "playground-file"
            }
          >
            <header>
              <strong>{name}</strong>
              <span>
                {revisions[name]
                  ? `${c.revision} ${revisions[name]}`
                  : c.unchanged}
              </span>
            </header>
            <code>AUTH_SECRET</code>
            <span className="playground-mask" aria-label={copy.demo.protected}>
              ••••••••••••
            </span>
            {name === "Local" ? (
              <p>{c.source}</p>
            ) : (
              <label>
                <input
                  type="checkbox"
                  disabled={saved.length > 0}
                  checked={selected.includes(name)}
                  onChange={(event) => {
                    setSelected(
                      event.target.checked
                        ? [...selected, name]
                        : selected.filter((item) => item !== name),
                    );
                    setPreview(null);
                    setSaved([]);
                  }}
                />
                {name} · {c.choose}
              </label>
            )}
            {name !== "Local" && (
              <small>
                {name === "Production" ? c.production : c.independent}
              </small>
            )}
          </article>
        ))}
      </div>
      <div className="playground-actions">
        <button
          className="button"
          disabled={selected.length === 0 || saved.length > 0}
          onClick={() => {
            setPreview(["Local", ...selected]);
            setSaved([]);
          }}
        >
          {c.preview}
        </button>
        <button className="text-link" onClick={reset}>
          {c.reset}
        </button>
      </div>
      {preview && (
        <div className="playground-review">
          <div>
            <strong>{c.review}</strong>
            <ul>
              {preview.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <button
            className="button"
            onClick={() => {
              const revision = Math.max(0, ...Object.values(revisions)) + 1;
              setRevisions((current) => ({
                ...current,
                ...Object.fromEntries(preview.map((name) => [name, revision])),
              }));
              setSaved(preview);
              setPreview(null);
            }}
          >
            {c.apply}
          </button>
        </div>
      )}
      <p className="playground-result" role="status">
        {saved.length
          ? `${c.saved} ${saved.length} ${c.files}: ${saved.join(", ")}`
          : !selected.length
            ? c.ready
            : ""}
      </p>
      <p className="playground-disclosure">{c.disclosure}</p>
    </section>
  );
}
