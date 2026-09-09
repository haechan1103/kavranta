import { useState } from "react";
import { useI18n } from "../../i18n";
import type { ProjectProjection } from "../../lib/types";
import "./VariableFinder.css";

const resultLimit = 40;

export function VariableFinder({
  projection,
  onOpenFile,
}: {
  projection: ProjectProjection;
  onOpenFile: (path: string, key?: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  // Search only the already-loaded, redacted projection. Values are never inspected.
  const matches = normalized
    ? projection.files.flatMap((file) =>
        file.groups.flatMap((group) =>
          group.variables
            .filter((variable) =>
              [variable.key, file.path, file.displayName, group.name].some(
                (text) => text.toLocaleLowerCase().includes(normalized),
              ),
            )
            .map((variable) => ({
              key: variable.key,
              file: file.path,
              state: variable.valueState,
            })),
        ),
      )
    : [];

  return (
    <section className="variable-finder" aria-label={t("finder.title")}>
      <label htmlFor="project-variable-search">{t("finder.title")}</label>
      <input
        id="project-variable-search"
        type="search"
        placeholder={t("finder.placeholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {normalized && (
        <>
          <p role="status">
            {t(
              matches.length > resultLimit ? "finder.limited" : "finder.count",
              {
                count: matches.length,
                limit: resultLimit,
              },
            )}
          </p>
          {matches.length === 0 && <p>{t("finder.noMatches")}</p>}
          <ul>
            {matches.slice(0, resultLimit).map((match, index) => (
              <li key={`${match.file}:${match.key}:${index}`}>
                <button onClick={() => onOpenFile(match.file, match.key)}>
                  <span>
                    <strong>{match.key}</strong>
                    <code>{match.file}</code>
                  </span>
                  <small>
                    {t(
                      match.state === "empty"
                        ? "finder.missing"
                        : "finder.present",
                    )}
                  </small>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
