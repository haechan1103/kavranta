import "./SourceView.css";
import { useEffect, useState } from "react";

import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { RedactedSourceLine } from "../../lib/types";

interface Props {
  projectId: string;
  filePath: string;
  /** Changes whenever the file is rescanned, so the source reloads. */
  revision: unknown;
  draftKeys: ReadonlySet<string>;
  removalKeys: ReadonlySet<string>;
  onOpenKey: (key: string) => void;
  onError: (message: string) => void;
}

/** The file's own layout, read-only. The backend withholds every value (ADR-0044). */
export function SourceView({ projectId, filePath, revision, draftKeys, removalKeys, onOpenKey, onError }: Props) {
  const { locale, t } = useI18n();
  const [lines, setLines] = useState<RedactedSourceLine[] | null>(null);

  useEffect(() => {
    let current = true;
    api.readRedactedSource(projectId, filePath)
      .then((result) => {
        if (current) setLines(result);
      })
      .catch((error: unknown) => {
        if (current) onError(localizeError(error, locale, "error.source"));
      });
    return () => {
      current = false;
    };
  }, [filePath, locale, onError, projectId, revision]);

  if (!lines) return <p className="source-loading">{t("source.loading")}</p>;

  return (
    <div className="source-view" role="region" aria-label={t("source.label")}>
      <p className="source-note">{t("source.note")}</p>
      <ol className="source-lines">
        {lines.map((line) => (
          <li key={line.line} className={`source-line ${lineTone(line, draftKeys, removalKeys)}`}>
            <span className="source-number" aria-hidden="true">{line.line}</span>
            <SourceContent line={line} onOpenKey={onOpenKey} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function SourceContent({ line, onOpenKey }: { line: RedactedSourceLine; onOpenKey: (key: string) => void }) {
  const { t } = useI18n();
  switch (line.kind) {
    case "blank":
      return <code className="source-code" />;
    case "comment":
      return <code className="source-code comment">#{line.text}</code>;
    case "group":
      return <code className="source-code group"># @group {line.name}</code>;
    case "withheld-comment":
      return (
        <code className="source-code comment">
          # {line.key ? `${line.key}=` : ""}
          <span className="source-withheld">{t(line.key ? "source.commentedValue" : "source.secretComment")}</span>
        </code>
      );
    case "assignment":
      return (
        <code className="source-code">
          <button type="button" className="source-key" onClick={() => onOpenKey(line.key)}>{line.key}</button>=
          {line.valueState === "empty"
            ? <span className="source-empty">{t("source.empty")}</span>
            : <span className="source-mask" aria-label={t("source.hidden")}>••••••••</span>}
        </code>
      );
    case "unparsed":
      return (
        <code className="source-code">
          <span className="source-withheld">{t("source.unparsed")}</span>
        </code>
      );
  }
}

function lineTone(line: RedactedSourceLine, drafts: ReadonlySet<string>, removals: ReadonlySet<string>): string {
  if (line.kind !== "assignment") return "";
  if (removals.has(line.key)) return "pending-removal";
  if (drafts.has(line.key)) return "pending-replace";
  return "";
}
